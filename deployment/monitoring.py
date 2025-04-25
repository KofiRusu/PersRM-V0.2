"""
Monitoring and Logging Infrastructure for PersLM

This module provides monitoring and logging capabilities for PersLM deployments,
including metrics collection, logging configuration, and health checks.
"""

import os
import time
import json
import logging
import threading
import socket
import platform
from typing import Dict, List, Optional, Any, Union, Callable
from dataclasses import dataclass, field
from datetime import datetime
import psutil

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    import prometheus_client
    from prometheus_client import Counter, Gauge, Histogram, Summary
    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False

logger = logging.getLogger(__name__)

@dataclass
class SystemStats:
    """System resource usage statistics."""
    timestamp: float = field(default_factory=time.time)
    cpu_percent: float = 0.0
    memory_used_gb: float = 0.0
    memory_total_gb: float = 0.0
    gpu_utilization: List[float] = field(default_factory=list)
    gpu_memory_used_gb: List[float] = field(default_factory=list)
    gpu_memory_total_gb: List[float] = field(default_factory=list)
    disk_usage_percent: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "timestamp": self.timestamp,
            "cpu_percent": self.cpu_percent,
            "memory_used_gb": self.memory_used_gb,
            "memory_total_gb": self.memory_total_gb,
            "memory_percent": (self.memory_used_gb / self.memory_total_gb * 100) if self.memory_total_gb > 0 else 0,
            "gpu_utilization": self.gpu_utilization,
            "gpu_memory_used_gb": self.gpu_memory_used_gb,
            "gpu_memory_total_gb": self.gpu_memory_total_gb,
            "disk_usage_percent": self.disk_usage_percent
        }


class MetricsCollector:
    """
    Collects and optionally exports system and application metrics.
    
    Features:
    - System resource monitoring (CPU, memory, GPU, disk)
    - Application metrics (request counts, latencies, tokens)
    - Prometheus export support
    - JSON export support
    """
    
    def __init__(
        self,
        export_prometheus: bool = False,
        prometheus_port: int = 8000,
        collect_interval: int = 10,  # seconds
        log_dir: Optional[str] = None,
        enable_gpu_metrics: bool = True
    ):
        """
        Initialize the metrics collector.
        
        Args:
            export_prometheus: Whether to export metrics via Prometheus
            prometheus_port: Port for Prometheus HTTP server
            collect_interval: Interval for metrics collection in seconds
            log_dir: Directory to save metrics logs
            enable_gpu_metrics: Whether to collect GPU metrics
        """
        self.collect_interval = collect_interval
        self.export_prometheus = export_prometheus and HAS_PROMETHEUS
        self.enable_gpu_metrics = enable_gpu_metrics and HAS_TORCH
        
        # Set up log directory
        self.log_dir = log_dir
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        
        # Initialize system metrics
        self.current_stats = SystemStats()
        self.stats_history: List[SystemStats] = []
        self.max_history_items = 1000  # Keep the last 1000 measurements
        
        # Initialize application metrics
        self.app_metrics = {
            "requests_total": 0,
            "requests_success": 0,
            "requests_error": 0,
            "tokens_input_total": 0,
            "tokens_output_total": 0,
            "request_latencies": []  # List of (timestamp, latency) tuples
        }
        
        # Initialize Prometheus metrics if enabled
        if self.export_prometheus:
            self._setup_prometheus(prometheus_port)
        
        # Start metrics collection background thread
        self._stop_collection = False
        self.collection_thread = threading.Thread(target=self._collect_metrics_loop, daemon=True)
        self.collection_thread.start()
        
        logger.info(f"Metrics collector initialized (prometheus={export_prometheus}, interval={collect_interval}s)")
    
    def _setup_prometheus(self, port: int) -> None:
        """Set up Prometheus metrics and start HTTP server."""
        # System metrics
        self.prom_cpu_usage = Gauge('system_cpu_usage_percent', 'CPU usage percentage')
        self.prom_memory_usage = Gauge('system_memory_usage_gb', 'Memory usage in GB')
        self.prom_memory_total = Gauge('system_memory_total_gb', 'Total memory in GB')
        self.prom_disk_usage = Gauge('system_disk_usage_percent', 'Disk usage percentage')
        
        # GPU metrics
        if self.enable_gpu_metrics:
            self.prom_gpu_util = Gauge('system_gpu_utilization_percent', 'GPU utilization percentage', ['gpu'])
            self.prom_gpu_memory = Gauge('system_gpu_memory_usage_gb', 'GPU memory usage in GB', ['gpu'])
            self.prom_gpu_memory_total = Gauge('system_gpu_memory_total_gb', 'Total GPU memory in GB', ['gpu'])
        
        # Application metrics
        self.prom_requests = Counter('perslm_requests_total', 'Total number of requests')
        self.prom_requests_success = Counter('perslm_requests_success', 'Successful requests')
        self.prom_requests_error = Counter('perslm_requests_error', 'Failed requests')
        self.prom_tokens_in = Counter('perslm_tokens_input_total', 'Total input tokens processed')
        self.prom_tokens_out = Counter('perslm_tokens_output_total', 'Total output tokens generated')
        self.prom_request_latency = Histogram(
            'perslm_request_latency_seconds', 'Request latency in seconds',
            buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0)
        )
        
        # Start HTTP server for Prometheus scraping
        prometheus_client.start_http_server(port)
        logger.info(f"Prometheus metrics server started on port {port}")
    
    def _collect_system_metrics(self) -> SystemStats:
        """Collect system resource metrics."""
        stats = SystemStats()
        
        # CPU usage
        stats.cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # Memory usage
        memory = psutil.virtual_memory()
        stats.memory_used_gb = memory.used / (1024 ** 3)
        stats.memory_total_gb = memory.total / (1024 ** 3)
        
        # Disk usage
        disk = psutil.disk_usage('/')
        stats.disk_usage_percent = disk.percent
        
        # GPU metrics
        if self.enable_gpu_metrics and HAS_TORCH and torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                # For PyTorch 1.x, get_device_properties is the way to get memory info
                device_props = torch.cuda.get_device_properties(i)
                
                # For utilization, we need nvidia-smi via pynvml or subprocess
                # This is a placeholder; actual implementation would use pynvml
                utilization = 0.0  # Placeholder
                
                total_memory = device_props.total_memory / (1024 ** 3)  # Convert to GB
                
                # Get free memory and calculate used memory
                free_memory = torch.cuda.memory_reserved(i) - torch.cuda.memory_allocated(i)
                free_memory_gb = free_memory / (1024 ** 3)
                used_memory_gb = total_memory - free_memory_gb
                
                stats.gpu_utilization.append(utilization)
                stats.gpu_memory_used_gb.append(used_memory_gb)
                stats.gpu_memory_total_gb.append(total_memory)
        
        return stats
    
    def _collect_metrics_loop(self) -> None:
        """Background thread for periodic metrics collection."""
        while not self._stop_collection:
            try:
                # Collect system metrics
                stats = self._collect_system_metrics()
                self.current_stats = stats
                
                # Add to history
                self.stats_history.append(stats)
                if len(self.stats_history) > self.max_history_items:
                    self.stats_history.pop(0)
                
                # Update Prometheus metrics if enabled
                if self.export_prometheus:
                    self._update_prometheus_metrics(stats)
                
                # Log to file if enabled
                if self.log_dir:
                    self._write_metrics_log(stats)
                
            except Exception as e:
                logger.error(f"Error collecting metrics: {e}")
            
            # Sleep until next collection
            time.sleep(self.collect_interval)
    
    def _update_prometheus_metrics(self, stats: SystemStats) -> None:
        """Update Prometheus metrics with latest values."""
        if not self.export_prometheus:
            return
        
        # Update system metrics
        self.prom_cpu_usage.set(stats.cpu_percent)
        self.prom_memory_usage.set(stats.memory_used_gb)
        self.prom_memory_total.set(stats.memory_total_gb)
        self.prom_disk_usage.set(stats.disk_usage_percent)
        
        # Update GPU metrics
        if self.enable_gpu_metrics:
            for i, (util, mem_used, mem_total) in enumerate(zip(
                stats.gpu_utilization, 
                stats.gpu_memory_used_gb, 
                stats.gpu_memory_total_gb
            )):
                self.prom_gpu_util.labels(gpu=str(i)).set(util)
                self.prom_gpu_memory.labels(gpu=str(i)).set(mem_used)
                self.prom_gpu_memory_total.labels(gpu=str(i)).set(mem_total)
    
    def _write_metrics_log(self, stats: SystemStats) -> None:
        """Write metrics to log file."""
        if not self.log_dir:
            return
            
        # Create a daily log file
        date_str = datetime.fromtimestamp(stats.timestamp).strftime('%Y-%m-%d')
        log_file = os.path.join(self.log_dir, f"system_metrics_{date_str}.jsonl")
        
        try:
            with open(log_file, 'a') as f:
                f.write(json.dumps(stats.to_dict()) + '\n')
        except Exception as e:
            logger.error(f"Error writing metrics log: {e}")
    
    def record_request(
        self, 
        success: bool, 
        input_tokens: int, 
        output_tokens: int,
        latency: float
    ) -> None:
        """
        Record metrics for a request.
        
        Args:
            success: Whether the request was successful
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens generated
            latency: Request latency in seconds
        """
        # Update internal metrics
        self.app_metrics["requests_total"] += 1
        if success:
            self.app_metrics["requests_success"] += 1
        else:
            self.app_metrics["requests_error"] += 1
            
        self.app_metrics["tokens_input_total"] += input_tokens
        self.app_metrics["tokens_output_total"] += output_tokens
        self.app_metrics["request_latencies"].append((time.time(), latency))
        
        # Trim request latencies history if needed
        if len(self.app_metrics["request_latencies"]) > self.max_history_items:
            self.app_metrics["request_latencies"] = self.app_metrics["request_latencies"][-self.max_history_items:]
        
        # Update Prometheus metrics if enabled
        if self.export_prometheus:
            self.prom_requests.inc()
            if success:
                self.prom_requests_success.inc()
            else:
                self.prom_requests_error.inc()
                
            self.prom_tokens_in.inc(input_tokens)
            self.prom_tokens_out.inc(output_tokens)
            self.prom_request_latency.observe(latency)
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get latest system statistics."""
        return self.current_stats.to_dict()
    
    def get_application_metrics(self) -> Dict[str, Any]:
        """Get application metrics."""
        metrics = self.app_metrics.copy()
        
        # Calculate derived metrics
        if metrics["requests_total"] > 0:
            metrics["success_rate"] = metrics["requests_success"] / metrics["requests_total"]
        else:
            metrics["success_rate"] = 0.0
            
        # Calculate average latency from the last 100 requests
        recent_latencies = [lat for _, lat in metrics["request_latencies"][-100:]]
        if recent_latencies:
            metrics["avg_latency"] = sum(recent_latencies) / len(recent_latencies)
        else:
            metrics["avg_latency"] = 0.0
            
        # Don't return the full latency history in the response
        metrics["request_latencies"] = len(metrics["request_latencies"])
        
        return metrics
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """Get all metrics (system and application)."""
        return {
            "system": self.get_system_stats(),
            "application": self.get_application_metrics(),
            "timestamp": time.time()
        }
    
    def stop(self) -> None:
        """Stop metrics collection."""
        self._stop_collection = True
        if self.collection_thread.is_alive():
            self.collection_thread.join(timeout=2.0)
            
        logger.info("Metrics collector stopped")


class LoggingManager:
    """
    Manages application logging configuration and log rotation.
    
    Features:
    - Log file configuration and rotation
    - Log level management
    - Request logging
    - Error aggregation
    """
    
    def __init__(
        self,
        log_dir: str,
        log_level: str = "INFO",
        log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        max_log_size_mb: int = 100,
        backup_count: int = 10,
        enable_request_logging: bool = True,
        enable_console_logging: bool = True
    ):
        """
        Initialize the logging manager.
        
        Args:
            log_dir: Directory for log files
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            log_format: Log message format
            max_log_size_mb: Maximum log file size before rotation
            backup_count: Number of backup files to keep
            enable_request_logging: Whether to log all requests
            enable_console_logging: Whether to log to console
        """
        self.log_dir = log_dir
        self.log_level = logging.getLevelName(log_level)
        self.log_format = log_format
        self.max_log_size_bytes = max_log_size_mb * 1024 * 1024
        self.backup_count = backup_count
        self.enable_request_logging = enable_request_logging
        
        # Create log directory
        os.makedirs(log_dir, exist_ok=True)
        
        # Configure root logger
        self._setup_logging(enable_console_logging)
        
        # Error aggregation
        self.recent_errors = []
        self.max_recent_errors = 100
        
        logger.info(f"Logging configured (level={log_level}, dir={log_dir})")
    
    def _setup_logging(self, enable_console: bool) -> None:
        """Set up logging configuration."""
        # Reset root logger
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Set log level
        root_logger.setLevel(self.log_level)
        
        # Create formatter
        formatter = logging.Formatter(self.log_format)
        
        # Add file handler with rotation
        from logging.handlers import RotatingFileHandler
        
        # Main log file
        main_log_path = os.path.join(self.log_dir, "perslm.log")
        file_handler = RotatingFileHandler(
            main_log_path,
            maxBytes=self.max_log_size_bytes,
            backupCount=self.backup_count
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
        
        # Error log file (separate file for errors)
        error_log_path = os.path.join(self.log_dir, "error.log")
        error_handler = RotatingFileHandler(
            error_log_path,
            maxBytes=self.max_log_size_bytes,
            backupCount=self.backup_count
        )
        error_handler.setFormatter(formatter)
        error_handler.setLevel(logging.ERROR)
        root_logger.addHandler(error_handler)
        
        # Request log file (if enabled)
        if self.enable_request_logging:
            request_log_path = os.path.join(self.log_dir, "requests.log")
            request_handler = RotatingFileHandler(
                request_log_path,
                maxBytes=self.max_log_size_bytes,
                backupCount=self.backup_count
            )
            request_handler.setFormatter(formatter)
            
            # Create a separate logger for requests
            request_logger = logging.getLogger("perslm.requests")
            request_logger.propagate = False  # Don't send to root logger
            request_logger.addHandler(request_handler)
            request_logger.setLevel(logging.INFO)
        
        # Console handler (if enabled)
        if enable_console:
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            root_logger.addHandler(console_handler)
    
    def set_log_level(self, level: str) -> None:
        """
        Change the logging level.
        
        Args:
            level: New logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        """
        numeric_level = logging.getLevelName(level.upper())
        if isinstance(numeric_level, int):
            logging.getLogger().setLevel(numeric_level)
            self.log_level = numeric_level
            logger.info(f"Log level changed to {level}")
        else:
            logger.error(f"Invalid log level: {level}")
    
    def log_request(
        self,
        request_id: str,
        endpoint: str,
        method: str,
        client_ip: str,
        status_code: int,
        processing_time: float,
        request_size: int = 0,
        response_size: int = 0,
        user_id: Optional[str] = None
    ) -> None:
        """
        Log a request to the request log.
        
        Args:
            request_id: Unique request identifier
            endpoint: API endpoint
            method: HTTP method
            client_ip: Client IP address
            status_code: HTTP status code
            processing_time: Request processing time in seconds
            request_size: Size of request in bytes
            response_size: Size of response in bytes
            user_id: User identifier (if available)
        """
        if not self.enable_request_logging:
            return
            
        request_logger = logging.getLogger("perslm.requests")
        
        log_data = {
            "request_id": request_id,
            "timestamp": time.time(),
            "endpoint": endpoint,
            "method": method,
            "client_ip": client_ip,
            "status_code": status_code,
            "processing_time": processing_time,
            "request_size": request_size,
            "response_size": response_size
        }
        
        if user_id:
            log_data["user_id"] = user_id
            
        request_logger.info(json.dumps(log_data))
        
        # Record error if status code indicates an error
        if status_code >= 400:
            self._record_error(
                error_type="request_error",
                error_message=f"Request error: {status_code}",
                details=log_data
            )
    
    def _record_error(
        self,
        error_type: str,
        error_message: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Record an error for aggregation.
        
        Args:
            error_type: Type of error
            error_message: Error message
            details: Additional error details
        """
        error_record = {
            "timestamp": time.time(),
            "type": error_type,
            "message": error_message,
            "details": details or {}
        }
        
        self.recent_errors.append(error_record)
        
        # Limit the number of recorded errors
        if len(self.recent_errors) > self.max_recent_errors:
            self.recent_errors.pop(0)
    
    def log_exception(
        self,
        exc: Exception,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log an exception with context.
        
        Args:
            exc: Exception instance
            context: Context information about when/where the exception occurred
        """
        # Log to error log
        if context:
            logger.error(f"Exception: {str(exc)}", exc_info=exc, extra=context)
        else:
            logger.error(f"Exception: {str(exc)}", exc_info=exc)
            
        # Record for aggregation
        self._record_error(
            error_type=exc.__class__.__name__,
            error_message=str(exc),
            details=context
        )
    
    def get_recent_errors(
        self,
        limit: int = 50,
        error_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent errors for monitoring.
        
        Args:
            limit: Maximum number of errors to return
            error_type: Filter by error type
            
        Returns:
            List of recent error records
        """
        if error_type:
            filtered = [e for e in self.recent_errors if e["type"] == error_type]
            return filtered[-limit:]
        else:
            return self.recent_errors[-limit:]


class HealthCheck:
    """
    Performs system health checks and provides system status information.
    
    Features:
    - Basic system checks (CPU, memory, disk)
    - Model loading checks
    - API endpoint checks
    - Database connection checks
    """
    
    def __init__(
        self,
        check_interval: int = 60,  # seconds
        alert_thresholds: Optional[Dict[str, float]] = None,
        alert_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None
    ):
        """
        Initialize the health check service.
        
        Args:
            check_interval: Interval between automatic health checks in seconds
            alert_thresholds: Thresholds for alerts, e.g., {"cpu_percent": 90, "memory_percent": 85}
            alert_callback: Function to call when an alert is triggered
        """
        self.check_interval = check_interval
        self.alert_thresholds = alert_thresholds or {
            "cpu_percent": 90.0,
            "memory_percent": 85.0,
            "disk_percent": 90.0,
            "gpu_memory_percent": 90.0
        }
        self.alert_callback = alert_callback
        
        # Health check results
        self.last_check_time = 0.0
        self.last_check_result = {}
        self.system_info = self._get_system_info()
        
        # Service status tracking
        self.services_status = {}
        
        # Start background thread if interval > 0
        self._stop_checks = False
        if check_interval > 0:
            self.check_thread = threading.Thread(target=self._check_loop, daemon=True)
            self.check_thread.start()
            
        logger.info(f"Health check initialized (interval={check_interval}s)")
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Get basic system information."""
        info = {
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(logical=True),
            "physical_cpu_count": psutil.cpu_count(logical=False),
            "memory_total_gb": psutil.virtual_memory().total / (1024 ** 3),
            "start_time": time.time()
        }
        
        # Add GPU information if available
        if HAS_TORCH and torch.cuda.is_available():
            info["gpu_count"] = torch.cuda.device_count()
            info["gpu_info"] = []
            
            for i in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(i)
                info["gpu_info"].append({
                    "name": props.name,
                    "total_memory_gb": props.total_memory / (1024 ** 3),
                    "compute_capability": f"{props.major}.{props.minor}"
                })
                
        return info
    
    def _check_system_health(self) -> Dict[str, Any]:
        """Perform system health checks."""
        health = {
            "timestamp": time.time(),
            "status": "healthy",  # Will be changed to "warning" or "critical" if needed
            "checks": {}
        }
        
        # Check CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.5)
        health["checks"]["cpu"] = {
            "status": "healthy",
            "value": cpu_percent,
            "threshold": self.alert_thresholds.get("cpu_percent")
        }
        
        if cpu_percent > self.alert_thresholds.get("cpu_percent", 90.0):
            health["checks"]["cpu"]["status"] = "warning"
            if cpu_percent > 95.0:
                health["checks"]["cpu"]["status"] = "critical"
            
            health["status"] = self._update_overall_status(health["status"], health["checks"]["cpu"]["status"])
            
            # Trigger alert if callback provided
            if self.alert_callback:
                self.alert_callback("cpu_usage", {"value": cpu_percent, "threshold": health["checks"]["cpu"]["threshold"]})
        
        # Check memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_used_gb = memory.used / (1024 ** 3)
        memory_total_gb = memory.total / (1024 ** 3)
        
        health["checks"]["memory"] = {
            "status": "healthy",
            "value": memory_percent,
            "used_gb": memory_used_gb,
            "total_gb": memory_total_gb,
            "threshold": self.alert_thresholds.get("memory_percent")
        }
        
        if memory_percent > self.alert_thresholds.get("memory_percent", 85.0):
            health["checks"]["memory"]["status"] = "warning"
            if memory_percent > 95.0:
                health["checks"]["memory"]["status"] = "critical"
                
            health["status"] = self._update_overall_status(health["status"], health["checks"]["memory"]["status"])
            
            # Trigger alert if callback provided
            if self.alert_callback:
                self.alert_callback("memory_usage", {"value": memory_percent, "threshold": health["checks"]["memory"]["threshold"]})
        
        # Check disk usage
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        
        health["checks"]["disk"] = {
            "status": "healthy",
            "value": disk_percent,
            "used_gb": disk.used / (1024 ** 3),
            "total_gb": disk.total / (1024 ** 3),
            "threshold": self.alert_thresholds.get("disk_percent")
        }
        
        if disk_percent > self.alert_thresholds.get("disk_percent", 90.0):
            health["checks"]["disk"]["status"] = "warning"
            if disk_percent > 98.0:
                health["checks"]["disk"]["status"] = "critical"
                
            health["status"] = self._update_overall_status(health["status"], health["checks"]["disk"]["status"])
            
            # Trigger alert if callback provided
            if self.alert_callback:
                self.alert_callback("disk_usage", {"value": disk_percent, "threshold": health["checks"]["disk"]["threshold"]})
        
        # Check GPU usage if available
        if HAS_TORCH and torch.cuda.is_available():
            health["checks"]["gpu"] = []
            
            for i in range(torch.cuda.device_count()):
                # Get memory usage
                total_memory = torch.cuda.get_device_properties(i).total_memory
                memory_reserved = torch.cuda.memory_reserved(i)
                memory_allocated = torch.cuda.memory_allocated(i)
                
                total_memory_gb = total_memory / (1024 ** 3)
                used_memory_gb = memory_allocated / (1024 ** 3)
                memory_percent = (memory_allocated / total_memory) * 100
                
                gpu_status = "healthy"
                if memory_percent > self.alert_thresholds.get("gpu_memory_percent", 90.0):
                    gpu_status = "warning"
                    if memory_percent > 95.0:
                        gpu_status = "critical"
                        
                    health["status"] = self._update_overall_status(health["status"], gpu_status)
                    
                    # Trigger alert if callback provided
                    if self.alert_callback:
                        self.alert_callback("gpu_memory", {
                            "device": i,
                            "value": memory_percent,
                            "threshold": self.alert_thresholds.get("gpu_memory_percent")
                        })
                
                health["checks"]["gpu"].append({
                    "device": i,
                    "status": gpu_status,
                    "memory_percent": memory_percent,
                    "memory_used_gb": used_memory_gb,
                    "memory_total_gb": total_memory_gb,
                    "threshold": self.alert_thresholds.get("gpu_memory_percent")
                })
        
        # Add service status checks
        health["checks"]["services"] = self.services_status
        
        # Check if any service is down
        for service, status in self.services_status.items():
            if status["status"] != "healthy":
                health["status"] = self._update_overall_status(health["status"], status["status"])
        
        return health
    
    def _update_overall_status(self, current_status: str, check_status: str) -> str:
        """Update the overall status based on check status."""
        status_priority = {"healthy": 0, "warning": 1, "critical": 2}
        
        if status_priority.get(check_status, 0) > status_priority.get(current_status, 0):
            return check_status
            
        return current_status
    
    def _check_loop(self) -> None:
        """Background thread for periodic health checks."""
        while not self._stop_checks:
            try:
                self.check_health()
            except Exception as e:
                logger.error(f"Error performing health check: {e}")
            
            # Sleep until next check
            time.sleep(self.check_interval)
    
    def check_health(self) -> Dict[str, Any]:
        """
        Perform a health check and return the results.
        
        Returns:
            Health check results
        """
        health = self._check_system_health()
        self.last_check_time = health["timestamp"]
        self.last_check_result = health
        return health
    
    def register_service(self, service_name: str, check_function: Callable[[], Dict[str, Any]]) -> None:
        """
        Register a service for health checks.
        
        Args:
            service_name: Name of the service
            check_function: Function that returns service status
        """
        self.services_status[service_name] = {
            "status": "unknown",
            "last_check": 0.0,
            "check_function": check_function
        }
        
        # Perform initial check
        self.check_service(service_name)
    
    def check_service(self, service_name: str) -> Dict[str, Any]:
        """
        Check a specific service.
        
        Args:
            service_name: Name of the service to check
            
        Returns:
            Service status information
        """
        if service_name not in self.services_status:
            return {"status": "unknown", "error": "Service not registered"}
            
        service_info = self.services_status[service_name]
        
        try:
            check_result = service_info["check_function"]()
            service_info.update(check_result)
            service_info["last_check"] = time.time()
        except Exception as e:
            service_info["status"] = "critical"
            service_info["error"] = str(e)
            service_info["last_check"] = time.time()
            
            logger.error(f"Error checking service {service_name}: {e}")
        
        # Update the stored service status
        self.services_status[service_name] = service_info
        
        return service_info
    
    def get_health_status(self) -> Dict[str, Any]:
        """
        Get the current health status.
        
        Returns:
            Health status information
        """
        # Check if we need to update
        current_time = time.time()
        if current_time - self.last_check_time > self.check_interval:
            return self.check_health()
        else:
            return self.last_check_result
    
    def get_system_info(self) -> Dict[str, Any]:
        """
        Get system information.
        
        Returns:
            System information
        """
        # Update uptime
        self.system_info["uptime_seconds"] = time.time() - self.system_info["start_time"]
        
        return self.system_info
    
    def stop(self) -> None:
        """Stop health checks."""
        self._stop_checks = True
        if hasattr(self, 'check_thread') and self.check_thread.is_alive():
            self.check_thread.join(timeout=2.0)
            
        logger.info("Health check stopped")


def setup_monitoring(
    log_dir: str = "logs",
    enable_metrics: bool = True,
    enable_prometheus: bool = False,
    prometheus_port: int = 8000,
    log_level: str = "INFO",
    health_check_interval: int = 60
) -> Dict[str, Any]:
    """
    Set up monitoring infrastructure.
    
    Args:
        log_dir: Directory for logs
        enable_metrics: Whether to enable metrics collection
        enable_prometheus: Whether to export metrics via Prometheus
        prometheus_port: Port for Prometheus HTTP server
        log_level: Logging level
        health_check_interval: Interval for health checks in seconds
        
    Returns:
        Dictionary containing monitoring components
    """
    os.makedirs(log_dir, exist_ok=True)
    
    # Set up logging
    logging_manager = LoggingManager(
        log_dir=os.path.join(log_dir, "app_logs"),
        log_level=log_level
    )
    
    # Set up metrics collection
    metrics_collector = None
    if enable_metrics:
        metrics_collector = MetricsCollector(
            export_prometheus=enable_prometheus,
            prometheus_port=prometheus_port,
            collect_interval=10,
            log_dir=os.path.join(log_dir, "metrics"),
            enable_gpu_metrics=True
        )
    
    # Set up health checks
    health_check = HealthCheck(
        check_interval=health_check_interval
    )
    
    logger.info(f"Monitoring infrastructure initialized (metrics={enable_metrics}, prometheus={enable_prometheus})")
    
    return {
        "logging_manager": logging_manager,
        "metrics_collector": metrics_collector,
        "health_check": health_check
    }


if __name__ == "__main__":
    """Command-line interface for monitoring utilities."""
    import argparse
    
    parser = argparse.ArgumentParser(description="PersLM Monitoring Utilities")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Metrics collection command
    metrics_parser = subparsers.add_parser("metrics", help="Collect system metrics")
    metrics_parser.add_argument("--log-dir", default="logs/metrics", help="Directory for metrics logs")
    metrics_parser.add_argument("--prometheus", action="store_true", help="Export metrics with Prometheus")
    metrics_parser.add_argument("--port", type=int, default=8000, help="Prometheus server port")
    metrics_parser.add_argument("--interval", type=int, default=10, help="Collection interval in seconds")
    
    # Health check command
    health_parser = subparsers.add_parser("health", help="Run system health checks")
    health_parser.add_argument("--interval", type=int, default=60, help="Check interval in seconds")
    health_parser.add_argument("--check-once", action="store_true", help="Run once and exit")
    health_parser.add_argument("--json", action="store_true", help="Output in JSON format")
    
    # Logging setup command
    log_parser = subparsers.add_parser("logging", help="Configure application logging")
    log_parser.add_argument("--log-dir", default="logs/app_logs", help="Directory for log files")
    log_parser.add_argument("--level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                          help="Logging level")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Set up basic logging for the CLI
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
    )
    
    if args.command == "metrics":
        # Create metrics collector
        collector = MetricsCollector(
            export_prometheus=args.prometheus,
            prometheus_port=args.port,
            collect_interval=args.interval,
            log_dir=args.log_dir,
            enable_gpu_metrics=True
        )
        
        print(f"Metrics collector started (prometheus={args.prometheus}, interval={args.interval}s)")
        print("Press Ctrl+C to stop")
        
        try:
            # Keep running until interrupted
            while True:
                time.sleep(1)
                
                # Periodically print metrics
                if not args.prometheus and time.time() % args.interval < 1:
                    stats = collector.get_system_stats()
                    print(f"\nSystem Stats: CPU {stats['cpu_percent']:.1f}%, "
                          f"Memory {stats['memory_used_gb']:.1f}/{stats['memory_total_gb']:.1f} GB")
                    
                    if 'gpu_utilization' in stats and stats['gpu_utilization']:
                        for i, (util, mem_used, mem_total) in enumerate(zip(
                            stats['gpu_utilization'], 
                            stats['gpu_memory_used_gb'], 
                            stats['gpu_memory_total_gb']
                        )):
                            print(f"GPU {i}: {util:.1f}% util, "
                                  f"{mem_used:.1f}/{mem_total:.1f} GB memory")
        except KeyboardInterrupt:
            print("\nStopping metrics collector...")
            collector.stop()
    
    elif args.command == "health":
        # Create health check
        health_checker = HealthCheck(
            check_interval=0 if args.check_once else args.interval
        )
        
        if args.check_once:
            # Run once and print results
            health = health_checker.check_health()
            
            if args.json:
                print(json.dumps(health, indent=2))
            else:
                print(f"\nHealth Status: {health['status'].upper()}")
                print(f"Timestamp: {datetime.fromtimestamp(health['timestamp']).strftime('%Y-%m-%d %H:%M:%S')}")
                
                for check_name, check_data in health["checks"].items():
                    if check_name == "gpu" and isinstance(check_data, list):
                        for i, gpu in enumerate(check_data):
                            print(f"GPU {gpu['device']}: {gpu['status'].upper()} - "
                                  f"{gpu['memory_percent']:.1f}% memory used "
                                  f"({gpu['memory_used_gb']:.1f}/{gpu['memory_total_gb']:.1f} GB)")
                    elif check_name != "services":
                        print(f"{check_name.upper()}: {check_data['status'].upper()} - "
                              f"{check_data.get('value', 'N/A')}")
                
                if "services" in health["checks"] and health["checks"]["services"]:
                    print("\nServices:")
                    for service, status in health["checks"]["services"].items():
                        print(f"  {service}: {status.get('status', 'unknown').upper()}")
        else:
            print(f"Health checker started (interval={args.interval}s)")
            print("Press Ctrl+C to stop")
            
            try:
                # Keep running until interrupted
                while True:
                    time.sleep(args.interval)
                    
                    # Get and print health status
                    health = health_checker.get_health_status()
                    status_emoji = "✅" if health["status"] == "healthy" else "⚠️" if health["status"] == "warning" else "❌"
                    
                    print(f"\n{status_emoji} Health Status: {health['status'].upper()} - "
                          f"{datetime.fromtimestamp(health['timestamp']).strftime('%H:%M:%S')}")
                    
                    for check_name, check_data in health["checks"].items():
                        if check_name == "gpu" and isinstance(check_data, list):
                            for gpu in check_data:
                                gpu_emoji = "✅" if gpu['status'] == "healthy" else "⚠️" if gpu['status'] == "warning" else "❌"
                                print(f"{gpu_emoji} GPU {gpu['device']}: {gpu['memory_percent']:.1f}% memory")
                        elif check_name == "cpu":
                            cpu_emoji = "✅" if check_data['status'] == "healthy" else "⚠️" if check_data['status'] == "warning" else "❌"
                            print(f"{cpu_emoji} CPU: {check_data['value']:.1f}%")
                        elif check_name == "memory":
                            mem_emoji = "✅" if check_data['status'] == "healthy" else "⚠️" if check_data['status'] == "warning" else "❌"
                            print(f"{mem_emoji} Memory: {check_data['value']:.1f}% ({check_data['used_gb']:.1f}/{check_data['total_gb']:.1f} GB)")
                        elif check_name == "disk":
                            disk_emoji = "✅" if check_data['status'] == "healthy" else "⚠️" if check_data['status'] == "warning" else "❌"
                            print(f"{disk_emoji} Disk: {check_data['value']:.1f}% ({check_data['used_gb']:.1f}/{check_data['total_gb']:.1f} GB)")
            except KeyboardInterrupt:
                print("\nStopping health checker...")
                health_checker.stop()
    
    elif args.command == "logging":
        # Configure logging
        logging_manager = LoggingManager(
            log_dir=args.log_dir,
            log_level=args.level
        )
        
        print(f"Logging configured (level={args.level}, dir={args.log_dir})")
        print("Example log messages:")
        
        # Generate sample log messages
        for level in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            logger.log(logging.getLevelName(level), f"This is a {level} message")
        
        # Show log file locations
        print(f"\nLog files can be found in: {args.log_dir}")
        print("- perslm.log - Main application log")
        print("- error.log - Error-only log")
        print("- requests.log - API request log")
    
    else:
        parser.print_help() 