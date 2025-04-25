"""
Backup and Restore System for PersLM

This module provides backup and restore capabilities for PersLM deployments,
including model checkpoints, user profiles, configurations, and logs.
"""

import os
import sys
import json
import time
import shutil
import logging
import tarfile
import datetime
import threading
import tempfile
import subprocess
from typing import Dict, List, Optional, Any, Union, Tuple, Set
from pathlib import Path

logger = logging.getLogger(__name__)

class BackupManager:
    """
    Manages backup and restore operations for PersLM deployments.
    
    Features:
    - Scheduled automatic backups
    - Full and incremental backups
    - Restore from backup
    - Backup rotation and cleanup
    - Cloud storage integration
    """
    
    def __init__(
        self,
        base_dir: str,
        backup_dir: str,
        config_file: Optional[str] = None,
        auto_backup_interval: int = 24 * 60 * 60,  # Default: daily
        keep_backups: int = 10,  # Number of backups to keep
        compression: str = "gz"  # "gz", "bz2", "xz"
    ):
        """
        Initialize the backup manager.
        
        Args:
            base_dir: Base directory of the PersLM deployment
            backup_dir: Directory to store backups
            config_file: Backup configuration file path
            auto_backup_interval: Interval between automatic backups in seconds
            keep_backups: Number of backups to keep
            compression: Compression format for backups
        """
        self.base_dir = os.path.abspath(base_dir)
        self.backup_dir = os.path.abspath(backup_dir)
        self.config_file = config_file
        self.auto_backup_interval = auto_backup_interval
        self.keep_backups = keep_backups
        self.compression = compression
        
        # Create backup directory if it doesn't exist
        os.makedirs(self.backup_dir, exist_ok=True)
        
        # Load configuration
        self.config = self._load_config()
        
        # Set up backup state tracking
        self.last_backup_time = 0
        self.last_backup_path = None
        self.backup_history = []
        self._load_backup_history()
        
        # Track running backup/restore operations
        self.current_operation = None
        self.operation_status = {}
        
        # Automatic backup thread
        self._stop_auto_backups = False
        if self.auto_backup_interval > 0:
            self.auto_backup_thread = threading.Thread(
                target=self._auto_backup_loop, 
                daemon=True
            )
            self.auto_backup_thread.start()
            
        logger.info(f"Backup manager initialized (dir={backup_dir}, interval={auto_backup_interval}s)")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load backup configuration."""
        config = {
            "backup_paths": {
                "models": "models",
                "user_profiles": "data/profiles",
                "configs": "configs",
                "logs": "logs",
                # Add other important paths here
            },
            "exclude_patterns": [
                "*.tmp", 
                "*.log.*", 
                "*.pyc", 
                "__pycache__",
                ".git",
                "venv",
                "env",
                "node_modules"
            ],
            "cloud_storage": {
                "enabled": False,
                "provider": None,  # "s3", "gcs", "azure"
                "credentials_file": None,
                "bucket": None,
                "prefix": "perslm-backups"
            }
        }
        
        # Override with user configuration if available
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    user_config = json.load(f)
                    
                # Merge configs
                for key, value in user_config.items():
                    if key in config and isinstance(config[key], dict) and isinstance(value, dict):
                        config[key].update(value)
                    else:
                        config[key] = value
                        
                logger.info(f"Loaded backup configuration from {self.config_file}")
            except Exception as e:
                logger.error(f"Error loading backup configuration: {e}")
                
        return config
    
    def _load_backup_history(self) -> None:
        """Load backup history from metadata file."""
        history_file = os.path.join(self.backup_dir, "backup_history.json")
        
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as f:
                    history_data = json.load(f)
                    
                self.backup_history = history_data.get("backups", [])
                self.last_backup_time = history_data.get("last_backup_time", 0)
                self.last_backup_path = history_data.get("last_backup_path", None)
                
                logger.info(f"Loaded backup history: {len(self.backup_history)} backups")
            except Exception as e:
                logger.error(f"Error loading backup history: {e}")
    
    def _save_backup_history(self) -> None:
        """Save backup history to metadata file."""
        history_file = os.path.join(self.backup_dir, "backup_history.json")
        
        try:
            history_data = {
                "backups": self.backup_history,
                "last_backup_time": self.last_backup_time,
                "last_backup_path": self.last_backup_path
            }
            
            with open(history_file, 'w') as f:
                json.dump(history_data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving backup history: {e}")
    
    def _auto_backup_loop(self) -> None:
        """Background thread for automatic backups."""
        # Initial delay to avoid immediate backup on startup
        time.sleep(60)
        
        while not self._stop_auto_backups:
            try:
                current_time = time.time()
                
                # Check if it's time for a backup
                if current_time - self.last_backup_time >= self.auto_backup_interval:
                    logger.info("Starting scheduled automatic backup")
                    
                    # Create backup name with timestamp
                    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
                    backup_name = f"auto-backup-{timestamp}"
                    
                    # Perform backup
                    self.create_backup(backup_name)
                    
                    # Clean up old backups
                    self.cleanup_old_backups()
                    
            except Exception as e:
                logger.error(f"Error in automatic backup: {e}")
            
            # Sleep for a while before checking again
            for _ in range(600):  # Check every 10 minutes
                if self._stop_auto_backups:
                    break
                time.sleep(1)
    
    def create_backup(
        self,
        backup_name: str,
        backup_type: str = "full",
        include_paths: Optional[List[str]] = None,
        exclude_paths: Optional[List[str]] = None,
        description: str = ""
    ) -> Optional[str]:
        """
        Create a backup of the PersLM deployment.
        
        Args:
            backup_name: Name for the backup
            backup_type: Type of backup ("full" or "incremental")
            include_paths: Optional list of paths to include
            exclude_paths: Optional list of paths to exclude
            description: Optional description of the backup
            
        Returns:
            Path to the created backup or None if failed
        """
        # Set up operation tracking
        self.current_operation = "backup"
        self.operation_status = {
            "operation": "backup",
            "backup_name": backup_name,
            "start_time": time.time(),
            "status": "in_progress",
            "progress": 0.0,
            "message": "Starting backup"
        }
        
        try:
            # Sanitize backup name (remove special characters)
            backup_name = "".join(c for c in backup_name if c.isalnum() or c in "-_.")
            
            # Ensure backup name is unique
            timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
            if not backup_name:
                backup_name = f"backup-{timestamp}"
                
            # Create backup file path
            backup_file = os.path.join(
                self.backup_dir, 
                f"{backup_name}-{timestamp}.tar.{self.compression}"
            )
            
            # Determine which paths to back up
            paths_to_backup = {}
            
            if include_paths:
                # If specific paths are provided, use those
                for path in include_paths:
                    abs_path = os.path.join(self.base_dir, path)
                    if os.path.exists(abs_path):
                        paths_to_backup[path] = abs_path
            else:
                # Otherwise use configured paths
                for key, rel_path in self.config["backup_paths"].items():
                    abs_path = os.path.join(self.base_dir, rel_path)
                    if os.path.exists(abs_path):
                        paths_to_backup[key] = abs_path
                        
            # Apply exclusions
            exclusions = self.config["exclude_patterns"].copy()
            if exclude_paths:
                exclusions.extend(exclude_paths)
                
            # Start the backup
            logger.info(f"Starting backup to {backup_file}")
            self.operation_status["message"] = "Creating backup archive"
            
            # Create tar file with appropriate compression
            mode = f"w:{self.compression}"
            with tarfile.open(backup_file, mode) as tar:
                # Add a metadata file
                metadata = {
                    "backup_name": backup_name,
                    "backup_type": backup_type,
                    "created_at": time.time(),
                    "description": description,
                    "paths": list(paths_to_backup.keys()),
                    "exclusions": exclusions
                }
                
                # Create metadata file
                with tempfile.NamedTemporaryFile('w', delete=False) as tmp:
                    json.dump(metadata, tmp, indent=2)
                    metadata_file = tmp.name
                    
                # Add metadata to archive
                tar.add(metadata_file, arcname="backup_metadata.json")
                os.unlink(metadata_file)  # Clean up temp file
                
                # Add each path to the archive
                total_paths = len(paths_to_backup)
                for i, (key, path) in enumerate(paths_to_backup.items()):
                    logger.info(f"Adding {key} to backup: {path}")
                    self.operation_status["message"] = f"Adding {key} to backup"
                    self.operation_status["progress"] = (i / total_paths) * 100
                    
                    # Handle directories vs files
                    if os.path.isdir(path):
                        # Add directory contents
                        for root, dirs, files in os.walk(path, topdown=True):
                            # Filter out excluded directories
                            dirs[:] = [d for d in dirs if not any(
                                self._fnmatch(d, pattern) for pattern in exclusions
                            )]
                            
                            # Add files
                            for file in files:
                                if not any(self._fnmatch(file, pattern) for pattern in exclusions):
                                    file_path = os.path.join(root, file)
                                    arcname = os.path.relpath(file_path, self.base_dir)
                                    try:
                                        tar.add(file_path, arcname=arcname)
                                    except Exception as e:
                                        logger.warning(f"Error adding {file_path} to backup: {e}")
                    else:
                        # Add file directly
                        arcname = os.path.relpath(path, self.base_dir)
                        try:
                            tar.add(path, arcname=arcname)
                        except Exception as e:
                            logger.warning(f"Error adding {path} to backup: {e}")
            
            # Verify the archive
            self.operation_status["message"] = "Verifying backup archive"
            self.operation_status["progress"] = 95.0
            
            # Simple verification - check if the file exists and is not empty
            if not os.path.exists(backup_file) or os.path.getsize(backup_file) == 0:
                raise ValueError("Backup file is empty or does not exist")
                
            # Update backup history
            backup_info = {
                "name": backup_name,
                "path": backup_file,
                "type": backup_type,
                "timestamp": time.time(),
                "size": os.path.getsize(backup_file),
                "description": description
            }
            
            self.backup_history.append(backup_info)
            self.last_backup_time = time.time()
            self.last_backup_path = backup_file
            self._save_backup_history()
            
            # Upload to cloud storage if configured
            if self.config["cloud_storage"]["enabled"]:
                self.operation_status["message"] = "Uploading to cloud storage"
                self._upload_to_cloud_storage(backup_file)
            
            # Finish
            self.operation_status["status"] = "completed"
            self.operation_status["progress"] = 100.0
            self.operation_status["message"] = "Backup completed successfully"
            self.operation_status["end_time"] = time.time()
            
            logger.info(f"Backup completed: {backup_file}")
            return backup_file
            
        except Exception as e:
            self.operation_status["status"] = "failed"
            self.operation_status["message"] = f"Backup failed: {str(e)}"
            self.operation_status["end_time"] = time.time()
            
            logger.error(f"Backup failed: {e}")
            return None
            
        finally:
            self.current_operation = None
    
    def restore_from_backup(
        self,
        backup_path: str,
        target_dir: Optional[str] = None,
        include_paths: Optional[List[str]] = None,
        exclude_paths: Optional[List[str]] = None
    ) -> bool:
        """
        Restore from a backup.
        
        Args:
            backup_path: Path to the backup file
            target_dir: Directory to restore to (default: base_dir)
            include_paths: Optional list of paths to restore
            exclude_paths: Optional list of paths to exclude
            
        Returns:
            True if successful, False otherwise
        """
        # Set up operation tracking
        self.current_operation = "restore"
        self.operation_status = {
            "operation": "restore",
            "backup_path": backup_path,
            "target_dir": target_dir or self.base_dir,
            "start_time": time.time(),
            "status": "in_progress",
            "progress": 0.0,
            "message": "Starting restore"
        }
        
        # Use temporary directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                if not os.path.exists(backup_path):
                    raise FileNotFoundError(f"Backup file not found: {backup_path}")
                    
                target_dir = target_dir or self.base_dir
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir, exist_ok=True)
                    
                # Check if the file is a valid tar archive
                if not tarfile.is_tarfile(backup_path):
                    raise ValueError(f"Not a valid backup archive: {backup_path}")
                
                # Extract backup metadata
                self.operation_status["message"] = "Reading backup metadata"
                self.operation_status["progress"] = 5.0
                
                metadata = None
                with tarfile.open(backup_path, 'r:*') as tar:
                    try:
                        metadata_file = tar.extractfile("backup_metadata.json")
                        if metadata_file:
                            metadata = json.loads(metadata_file.read().decode('utf-8'))
                    except Exception:
                        logger.warning("No metadata found in backup, continuing without it")
                
                # Extract files
                self.operation_status["message"] = "Extracting backup files"
                self.operation_status["progress"] = 10.0
                
                # First extract to temp directory
                with tarfile.open(backup_path, 'r:*') as tar:
                    # Get file list
                    file_list = tar.getnames()
                    total_files = len(file_list)
                    
                    # Filter files based on include/exclude paths
                    filtered_list = self._filter_restore_files(
                        file_list, 
                        include_paths, 
                        exclude_paths
                    )
                    
                    # Extract filtered files
                    for i, member in enumerate(tar):
                        if member.name in filtered_list:
                            self.operation_status["progress"] = 10.0 + (i / total_files) * 70.0
                            self.operation_status["message"] = f"Extracting {member.name}"
                            
                            try:
                                tar.extract(member, path=temp_dir)
                            except Exception as e:
                                logger.warning(f"Error extracting {member.name}: {e}")
                
                # Move from temp dir to target dir
                self.operation_status["message"] = "Moving files to target directory"
                self.operation_status["progress"] = 80.0
                
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        if file == "backup_metadata.json":
                            continue  # Skip metadata file
                            
                        # Get relative path
                        source_path = os.path.join(root, file)
                        rel_path = os.path.relpath(source_path, temp_dir)
                        target_path = os.path.join(target_dir, rel_path)
                        
                        # Create directories if needed
                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        
                        # Move file
                        shutil.copy2(source_path, target_path)
                
                # Finish
                self.operation_status["status"] = "completed"
                self.operation_status["progress"] = 100.0
                self.operation_status["message"] = "Restore completed successfully"
                self.operation_status["end_time"] = time.time()
                
                logger.info(f"Restore completed to {target_dir}")
                return True
                
            except Exception as e:
                self.operation_status["status"] = "failed"
                self.operation_status["message"] = f"Restore failed: {str(e)}"
                self.operation_status["end_time"] = time.time()
                
                logger.error(f"Restore failed: {e}")
                return False
                
            finally:
                self.current_operation = None
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """
        List available backups.
        
        Returns:
            List of backup information dictionaries
        """
        # Make sure backup history is up to date
        self._refresh_backup_list()
        
        # Sort backups by timestamp (newest first)
        sorted_backups = sorted(
            self.backup_history, 
            key=lambda x: x.get("timestamp", 0), 
            reverse=True
        )
        
        return sorted_backups
    
    def get_backup_info(self, backup_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a specific backup.
        
        Args:
            backup_id: Backup ID or path
            
        Returns:
            Backup information or None if not found
        """
        # Check if it's a path or an ID
        if os.path.exists(backup_id):
            backup_path = backup_id
        else:
            # Find by name
            matching_backups = [b for b in self.backup_history if b.get("name") == backup_id]
            if not matching_backups:
                return None
                
            backup_path = matching_backups[0].get("path")
            
        # Extract metadata from the backup
        try:
            with tarfile.open(backup_path, 'r:*') as tar:
                metadata_file = tar.extractfile("backup_metadata.json")
                if not metadata_file:
                    return None
                    
                metadata = json.loads(metadata_file.read().decode('utf-8'))
                metadata["path"] = backup_path
                metadata["size"] = os.path.getsize(backup_path)
                
                return metadata
        except Exception as e:
            logger.error(f"Error reading backup metadata: {e}")
            return None
    
    def delete_backup(self, backup_id: str) -> bool:
        """
        Delete a backup.
        
        Args:
            backup_id: Backup ID or path
            
        Returns:
            True if successful, False otherwise
        """
        # Find the backup
        backup_to_delete = None
        
        if os.path.exists(backup_id):
            # It's a path
            backup_path = backup_id
            matching_backups = [b for b in self.backup_history if b.get("path") == backup_path]
            if matching_backups:
                backup_to_delete = matching_backups[0]
        else:
            # Find by name
            matching_backups = [b for b in self.backup_history if b.get("name") == backup_id]
            if matching_backups:
                backup_to_delete = matching_backups[0]
                
        if not backup_to_delete:
            logger.warning(f"Backup not found: {backup_id}")
            return False
            
        # Delete the file
        backup_path = backup_to_delete.get("path")
        try:
            if os.path.exists(backup_path):
                os.remove(backup_path)
                
            # Remove from history
            self.backup_history = [b for b in self.backup_history if b.get("path") != backup_path]
            self._save_backup_history()
            
            logger.info(f"Deleted backup: {backup_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting backup: {e}")
            return False
    
    def cleanup_old_backups(self, keep: Optional[int] = None) -> int:
        """
        Clean up old backups, keeping only the most recent ones.
        
        Args:
            keep: Number of backups to keep (default: self.keep_backups)
            
        Returns:
            Number of backups deleted
        """
        keep = keep or self.keep_backups
        
        # Make sure backup history is up to date
        self._refresh_backup_list()
        
        # Sort backups by timestamp (newest first)
        sorted_backups = sorted(
            self.backup_history, 
            key=lambda x: x.get("timestamp", 0), 
            reverse=True
        )
        
        # Keep the most recent, delete the rest
        backups_to_keep = sorted_backups[:keep]
        backups_to_delete = sorted_backups[keep:]
        
        deleted_count = 0
        for backup in backups_to_delete:
            if self.delete_backup(backup.get("path", "")):
                deleted_count += 1
                
        logger.info(f"Cleaned up {deleted_count} old backups, kept {len(backups_to_keep)}")
        return deleted_count
    
    def _refresh_backup_list(self) -> None:
        """Refresh the list of backups by scanning the backup directory."""
        # Get list of existing backup files
        backup_files = []
        for root, _, files in os.walk(self.backup_dir):
            for file in files:
                if file.endswith(f".tar.{self.compression}"):
                    backup_files.append(os.path.join(root, file))
        
        # Check which backups in history still exist
        existing_backup_paths = set()
        for backup in self.backup_history:
            path = backup.get("path", "")
            if os.path.exists(path) and path in backup_files:
                existing_backup_paths.add(path)
        
        # Find new backups not in history
        for file_path in backup_files:
            if file_path not in existing_backup_paths:
                # Try to extract metadata
                try:
                    with tarfile.open(file_path, 'r:*') as tar:
                        metadata_file = tar.extractfile("backup_metadata.json")
                        if metadata_file:
                            metadata = json.loads(metadata_file.read().decode('utf-8'))
                            
                            # Add to history
                            self.backup_history.append({
                                "name": metadata.get("backup_name", os.path.basename(file_path)),
                                "path": file_path,
                                "type": metadata.get("backup_type", "unknown"),
                                "timestamp": metadata.get("created_at", os.path.getmtime(file_path)),
                                "size": os.path.getsize(file_path),
                                "description": metadata.get("description", "")
                            })
                except Exception:
                    # If we can't extract metadata, add with basic info
                    self.backup_history.append({
                        "name": os.path.basename(file_path),
                        "path": file_path,
                        "type": "unknown",
                        "timestamp": os.path.getmtime(file_path),
                        "size": os.path.getsize(file_path),
                        "description": ""
                    })
        
        # Remove backups that no longer exist
        self.backup_history = [b for b in self.backup_history if os.path.exists(b.get("path", ""))]
        
        # Save updated history
        self._save_backup_history()
    
    def _upload_to_cloud_storage(self, file_path: str) -> bool:
        """
        Upload a backup to cloud storage.
        
        Args:
            file_path: Path to the backup file
            
        Returns:
            True if successful, False otherwise
        """
        cloud_config = self.config["cloud_storage"]
        if not cloud_config["enabled"] or not cloud_config["provider"]:
            return False
            
        provider = cloud_config["provider"].lower()
        bucket = cloud_config["bucket"]
        prefix = cloud_config["prefix"]
        
        if not bucket:
            logger.error("Cloud storage bucket not configured")
            return False
            
        filename = os.path.basename(file_path)
        remote_path = f"{prefix}/{filename}" if prefix else filename
        
        try:
            if provider == "s3":
                return self._upload_to_s3(file_path, bucket, remote_path, cloud_config)
            elif provider == "gcs":
                return self._upload_to_gcs(file_path, bucket, remote_path, cloud_config)
            elif provider == "azure":
                return self._upload_to_azure(file_path, bucket, remote_path, cloud_config)
            else:
                logger.error(f"Unsupported cloud provider: {provider}")
                return False
        except Exception as e:
            logger.error(f"Error uploading to cloud storage: {e}")
            return False
    
    def _upload_to_s3(
        self, 
        file_path: str, 
        bucket: str, 
        remote_path: str,
        config: Dict[str, Any]
    ) -> bool:
        """Upload to Amazon S3."""
        try:
            import boto3
            from botocore.exceptions import NoCredentialsError, ClientError
            
            # Get credentials
            if config.get("credentials_file"):
                boto3.Session(profile_name=config.get("profile_name"))
                
            s3_client = boto3.client('s3')
            
            # Upload file
            logger.info(f"Uploading to S3: {bucket}/{remote_path}")
            s3_client.upload_file(file_path, bucket, remote_path)
            
            logger.info(f"Upload to S3 complete: {bucket}/{remote_path}")
            return True
            
        except ImportError:
            logger.error("boto3 package required for S3 uploads")
            return False
        except (NoCredentialsError, ClientError) as e:
            logger.error(f"S3 authentication error: {e}")
            return False
        except Exception as e:
            logger.error(f"S3 upload error: {e}")
            return False
    
    def _upload_to_gcs(
        self, 
        file_path: str, 
        bucket: str, 
        remote_path: str,
        config: Dict[str, Any]
    ) -> bool:
        """Upload to Google Cloud Storage."""
        try:
            from google.cloud import storage
            
            # Set credentials if provided
            if config.get("credentials_file"):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = config["credentials_file"]
                
            # Create client and upload
            client = storage.Client()
            bucket_obj = client.bucket(bucket)
            blob = bucket_obj.blob(remote_path)
            
            logger.info(f"Uploading to GCS: {bucket}/{remote_path}")
            blob.upload_from_filename(file_path)
            
            logger.info(f"Upload to GCS complete: {bucket}/{remote_path}")
            return True
            
        except ImportError:
            logger.error("google-cloud-storage package required for GCS uploads")
            return False
        except Exception as e:
            logger.error(f"GCS upload error: {e}")
            return False
    
    def _upload_to_azure(
        self, 
        file_path: str, 
        container: str, 
        remote_path: str,
        config: Dict[str, Any]
    ) -> bool:
        """Upload to Azure Blob Storage."""
        try:
            from azure.storage.blob import BlobServiceClient
            
            # Get connection string
            conn_string = config.get("connection_string")
            account_name = config.get("account_name")
            
            if not conn_string and not account_name:
                logger.error("Azure connection string or account name required")
                return False
                
            # Create client
            if conn_string:
                blob_service_client = BlobServiceClient.from_connection_string(conn_string)
            else:
                # Use account key or SAS token
                account_key = config.get("account_key")
                sas_token = config.get("sas_token")
                
                if account_key:
                    from azure.storage.blob import BlobServiceClient
                    blob_service_client = BlobServiceClient(
                        account_url=f"https://{account_name}.blob.core.windows.net",
                        credential=account_key
                    )
                elif sas_token:
                    blob_service_client = BlobServiceClient(
                        account_url=f"https://{account_name}.blob.core.windows.net{sas_token}"
                    )
                else:
                    logger.error("Azure authentication information missing")
                    return False
            
            # Upload file
            container_client = blob_service_client.get_container_client(container)
            blob_client = container_client.get_blob_client(remote_path)
            
            logger.info(f"Uploading to Azure: {container}/{remote_path}")
            with open(file_path, "rb") as data:
                blob_client.upload_blob(data, overwrite=True)
                
            logger.info(f"Upload to Azure complete: {container}/{remote_path}")
            return True
            
        except ImportError:
            logger.error("azure-storage-blob package required for Azure uploads")
            return False
        except Exception as e:
            logger.error(f"Azure upload error: {e}")
            return False
    
    def get_backup_status(self) -> Dict[str, Any]:
        """
        Get status of current backup/restore operation.
        
        Returns:
            Status information dictionary
        """
        return self.operation_status.copy()
    
    def _filter_restore_files(
        self,
        file_list: List[str],
        include_paths: Optional[List[str]] = None,
        exclude_paths: Optional[List[str]] = None
    ) -> Set[str]:
        """
        Filter the list of files to restore based on include/exclude paths.
        
        Args:
            file_list: List of file paths in the backup
            include_paths: Paths to include (relative to base_dir)
            exclude_paths: Paths to exclude (relative to base_dir)
            
        Returns:
            Set of file paths to restore
        """
        # Start with all files
        filtered_set = set(file_list)
        
        # Handle includes
        if include_paths:
            included_set = set()
            for include in include_paths:
                for file in file_list:
                    if file.startswith(include):
                        included_set.add(file)
            filtered_set = included_set
        
        # Handle excludes
        if exclude_paths:
            for exclude in exclude_paths:
                filtered_set = {f for f in filtered_set if not f.startswith(exclude)}
                
        return filtered_set
    
    def _fnmatch(self, filename: str, pattern: str) -> bool:
        """Simple pattern matching for file names."""
        import fnmatch
        return fnmatch.fnmatch(filename, pattern)
    
    def stop(self) -> None:
        """Stop the backup manager."""
        self._stop_auto_backups = True
        if hasattr(self, 'auto_backup_thread') and self.auto_backup_thread.is_alive():
            self.auto_backup_thread.join(timeout=2.0)
            
        logger.info("Backup manager stopped")


def backup_command(args: List[str] = None) -> int:
    """
    Command-line interface for backup and restore operations.
    
    Args:
        args: Command line arguments (for testing, uses sys.argv if None)
        
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="PersLM Backup and Restore Utility")
    parser.add_argument("--base-dir", default=".", help="Base directory of PersLM deployment")
    parser.add_argument("--backup-dir", default="backups", help="Directory to store backups")
    parser.add_argument("--config", help="Backup configuration file path")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Create backup command
    create_parser = subparsers.add_parser("create", help="Create a backup")
    create_parser.add_argument("--name", help="Backup name")
    create_parser.add_argument("--type", choices=["full", "incremental"], default="full", 
                             help="Backup type")
    create_parser.add_argument("--include", nargs="+", help="Paths to include")
    create_parser.add_argument("--exclude", nargs="+", help="Paths to exclude")
    create_parser.add_argument("--description", help="Backup description")
    
    # Restore backup command
    restore_parser = subparsers.add_parser("restore", help="Restore from backup")
    restore_parser.add_argument("backup", help="Backup file path or name")
    restore_parser.add_argument("--target-dir", help="Directory to restore to")
    restore_parser.add_argument("--include", nargs="+", help="Paths to include")
    restore_parser.add_argument("--exclude", nargs="+", help="Paths to exclude")
    
    # List backups command
    list_parser = subparsers.add_parser("list", help="List available backups")
    list_parser.add_argument("--json", action="store_true", help="Output in JSON format")
    
    # Delete backup command
    delete_parser = subparsers.add_parser("delete", help="Delete a backup")
    delete_parser.add_argument("backup", help="Backup file path or name")
    
    # Cleanup command
    cleanup_parser = subparsers.add_parser("cleanup", help="Clean up old backups")
    cleanup_parser.add_argument("--keep", type=int, default=10, help="Number of backups to keep")
    
    # Show backup info command
    info_parser = subparsers.add_parser("info", help="Show backup information")
    info_parser.add_argument("backup", help="Backup file path or name")
    
    # Parse arguments
    parsed_args = parser.parse_args(args)
    
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
    )
    
    # Create backup manager
    try:
        manager = BackupManager(
            base_dir=parsed_args.base_dir,
            backup_dir=parsed_args.backup_dir,
            config_file=parsed_args.config,
            auto_backup_interval=0  # Disable auto backups for CLI
        )
    except Exception as e:
        print(f"Error initializing backup manager: {e}", file=sys.stderr)
        return 1
    
    try:
        if parsed_args.command == "create":
            # Create backup
            backup_name = parsed_args.name or f"backup-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
            result = manager.create_backup(
                backup_name=backup_name,
                backup_type=parsed_args.type,
                include_paths=parsed_args.include,
                exclude_paths=parsed_args.exclude,
                description=parsed_args.description or ""
            )
            
            if result:
                print(f"Backup created successfully: {result}")
                return 0
            else:
                print("Backup failed, see logs for details", file=sys.stderr)
                return 1
                
        elif parsed_args.command == "restore":
            # Restore from backup
            backup = parsed_args.backup
            
            # If it's not a path, try to find it by name
            if not os.path.exists(backup):
                # Find by name
                backups = manager.list_backups()
                matching = [b for b in backups if b.get("name") == backup]
                if matching:
                    backup = matching[0].get("path")
                    
            if not os.path.exists(backup):
                print(f"Backup not found: {parsed_args.backup}", file=sys.stderr)
                return 1
                
            result = manager.restore_from_backup(
                backup_path=backup,
                target_dir=parsed_args.target_dir,
                include_paths=parsed_args.include,
                exclude_paths=parsed_args.exclude
            )
            
            if result:
                print("Restore completed successfully")
                return 0
            else:
                print("Restore failed, see logs for details", file=sys.stderr)
                return 1
                
        elif parsed_args.command == "list":
            # List backups
            backups = manager.list_backups()
            
            if parsed_args.json:
                import json
                print(json.dumps(backups, indent=2))
            else:
                if not backups:
                    print("No backups found")
                else:
                    print("\nAvailable backups:\n")
                    print(f"{'Name':<30} {'Date':<20} {'Type':<10} {'Size':<10}")
                    print("-" * 70)
                    
                    for backup in backups:
                        name = backup.get("name", "Unknown")
                        timestamp = backup.get("timestamp", 0)
                        date_str = datetime.datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
                        backup_type = backup.get("type", "unknown")
                        
                        # Format size
                        size = backup.get("size", 0)
                        if size < 1024:
                            size_str = f"{size} B"
                        elif size < 1024 * 1024:
                            size_str = f"{size/1024:.1f} KB"
                        elif size < 1024 * 1024 * 1024:
                            size_str = f"{size/(1024*1024):.1f} MB"
                        else:
                            size_str = f"{size/(1024*1024*1024):.1f} GB"
                            
                        print(f"{name:<30} {date_str:<20} {backup_type:<10} {size_str:<10}")
                
            return 0
            
        elif parsed_args.command == "delete":
            # Delete backup
            result = manager.delete_backup(parsed_args.backup)
            
            if result:
                print(f"Backup deleted: {parsed_args.backup}")
                return 0
            else:
                print(f"Failed to delete backup: {parsed_args.backup}", file=sys.stderr)
                return 1
                
        elif parsed_args.command == "cleanup":
            # Clean up old backups
            deleted = manager.cleanup_old_backups(parsed_args.keep)
            remaining = len(manager.list_backups())
            
            print(f"Deleted {deleted} old backups, kept {remaining} most recent backups")
            return 0
            
        elif parsed_args.command == "info":
            # Show backup info
            info = manager.get_backup_info(parsed_args.backup)
            
            if not info:
                print(f"Backup not found: {parsed_args.backup}", file=sys.stderr)
                return 1
                
            print("\nBackup Information:\n")
            for key, value in info.items():
                if key == "created_at" and isinstance(value, (int, float)):
                    date_str = datetime.datetime.fromtimestamp(value).strftime("%Y-%m-%d %H:%M:%S")
                    print(f"{key.capitalize():<15}: {date_str}")
                elif key == "size":
                    # Format size
                    if value < 1024:
                        size_str = f"{value} B"
                    elif value < 1024 * 1024:
                        size_str = f"{value/1024:.1f} KB"
                    elif value < 1024 * 1024 * 1024:
                        size_str = f"{value/(1024*1024):.1f} MB"
                    else:
                        size_str = f"{value/(1024*1024*1024):.1f} GB"
                        
                    print(f"{key.capitalize():<15}: {size_str}")
                elif key == "paths" and isinstance(value, list):
                    print(f"\nIncluded paths:")
                    for path in value:
                        print(f"  - {path}")
                elif key == "exclusions" and isinstance(value, list):
                    print(f"\nExcluded patterns:")
                    for path in value:
                        print(f"  - {path}")
                else:
                    print(f"{key.capitalize():<15}: {value}")
                    
            return 0
            
        else:
            parser.print_help()
            return 1
            
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
        return 130
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        manager.stop()


if __name__ == "__main__":
    sys.exit(backup_command()) 