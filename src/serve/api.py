"""
PersLM API Server

This module provides a web API for deploying PersLM models.
"""

import os
import time
import json
import logging
import argparse
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field, asdict

import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse
import uvicorn
import psutil
import prometheus_client
from prometheus_client import Counter, Gauge, Histogram

# Import PersLM components
try:
    from deployment.optimize_inference import OptimizedInference
except ImportError:
    # Adjust import path based on deployment structure
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
    from deployment.optimize_inference import OptimizedInference

# Configure logging
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="PersLM API",
    description="API for Personal Language Model inference",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
REQUESTS = Counter("perslm_requests_total", "Total number of requests", ["endpoint"])
LATENCY = Histogram("perslm_request_latency_seconds", "Request latency", ["endpoint"])
TOKEN_COUNTER = Counter("perslm_tokens_generated_total", "Total tokens generated")
SYSTEM_MEMORY = Gauge("perslm_memory_usage_bytes", "Memory usage in bytes")
GPU_MEMORY = Gauge("perslm_gpu_memory_usage_bytes", "GPU memory usage in bytes")
LOAD_AVG = Gauge("perslm_load_average", "Load average", ["interval"])
INFERENCE_WORKERS = Gauge("perslm_inference_workers", "Number of inference workers")


# Request and response models
class GenerationRequest(BaseModel):
    prompt: str
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.95, ge=0.0, le=1.0)
    stream: bool = Field(default=False)
    stop_sequences: Optional[List[str]] = Field(default=None)
    additional_params: Optional[Dict[str, Any]] = Field(default=None)


class GenerationResponse(BaseModel):
    text: str
    tokens_generated: int
    elapsed_time: float
    model_info: Dict[str, Any]


class BatchRequest(BaseModel):
    prompts: List[str]
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.95, ge=0.0, le=1.0)
    additional_params: Optional[Dict[str, Any]] = Field(default=None)


class BatchResponse(BaseModel):
    texts: List[str]
    tokens_generated: int
    elapsed_time: float
    model_info: Dict[str, Any]


# Global variables
inference_engine = None
inference_config = {}


def create_inference_engine(args):
    """Create the inference engine from command-line arguments."""
    global inference_engine, inference_config
    
    inference_config = {
        "model_path": args.model,
        "quantization": args.quantization,
        "device": args.device,
        "use_vllm": args.use_vllm,
    }
    
    # Set up response caching if enabled
    cache_dir = None
    if args.enable_cache:
        cache_dir = os.path.join("cache", "responses")
        os.makedirs(cache_dir, exist_ok=True)
    
    logger.info(f"Creating inference engine with config: {inference_config}")
    
    # Initialize inference engine
    inference_engine = OptimizedInference(
        model_path=args.model,
        quantization=args.quantization,
        cache_dir=cache_dir,
        device=args.device,
        use_vllm=args.use_vllm,
        trust_remote_code=args.trust_remote_code,
    )
    
    logger.info("Inference engine created successfully")


@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return {
        "name": "PersLM API",
        "version": "1.0.0",
        "model": inference_config.get("model_path", "not_loaded"),
        "status": "ready" if inference_engine is not None else "not_ready",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    if inference_engine is None:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    return {"status": "healthy"}


@app.post("/generate", response_model=GenerationResponse)
async def generate(request: GenerationRequest):
    """Generate text based on a prompt."""
    if inference_engine is None:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    
    REQUESTS.labels(endpoint="generate").inc()
    
    with LATENCY.labels(endpoint="generate").time():
        start_time = time.time()
        
        # Get additional parameters
        additional_params = request.additional_params or {}
        if request.stop_sequences:
            additional_params["stop_sequences"] = request.stop_sequences
        
        # Generate text
        generated_text = inference_engine.generate(
            prompt=request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            stream=False,
            **additional_params
        )
        
        # Calculate metrics
        elapsed_time = time.time() - start_time
        # Simple token count estimation
        tokens_generated = len(generated_text.split()) * 1.3  # Rough approximation
        TOKEN_COUNTER.inc(tokens_generated)
        
        # Update system metrics
        update_system_metrics()
        
        return GenerationResponse(
            text=generated_text,
            tokens_generated=int(tokens_generated),
            elapsed_time=elapsed_time,
            model_info={
                "model": inference_config.get("model_path", "unknown"),
                "quantization": inference_config.get("quantization", "none"),
                "device": inference_config.get("device", "auto"),
            }
        )


@app.post("/generate_stream")
async def generate_stream(request: GenerationRequest):
    """Generate text with streaming response."""
    if inference_engine is None:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    
    if not request.stream:
        # If streaming is not requested, use the regular endpoint
        return await generate(request)
    
    REQUESTS.labels(endpoint="generate_stream").inc()
    
    # Get additional parameters
    additional_params = request.additional_params or {}
    if request.stop_sequences:
        additional_params["stop_sequences"] = request.stop_sequences
    
    async def event_generator():
        """Generate streaming events."""
        start_time = time.time()
        
        try:
            # Keep track of total text for token counting
            total_text = ""
            
            # Generate with streaming
            for text_chunk in inference_engine.generate(
                prompt=request.prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                stream=True,
                **additional_params
            ):
                total_text += text_chunk
                yield json.dumps({"text": text_chunk, "done": False})
            
            # Send final message with metrics
            elapsed_time = time.time() - start_time
            tokens_generated = len(total_text.split()) * 1.3  # Rough approximation
            TOKEN_COUNTER.inc(tokens_generated)
            
            yield json.dumps({
                "text": "",
                "done": True,
                "tokens_generated": int(tokens_generated),
                "elapsed_time": elapsed_time,
                "model_info": {
                    "model": inference_config.get("model_path", "unknown"),
                    "quantization": inference_config.get("quantization", "none"),
                }
            })
            
        except Exception as e:
            logger.error(f"Error during streaming generation: {str(e)}")
            yield json.dumps({"error": str(e), "done": True})
        
        # Update system metrics after generation
        update_system_metrics()
    
    return EventSourceResponse(event_generator())


@app.post("/batch_generate", response_model=BatchResponse)
async def batch_generate(request: BatchRequest):
    """Generate text for multiple prompts in a batch."""
    if inference_engine is None:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    
    REQUESTS.labels(endpoint="batch_generate").inc()
    
    with LATENCY.labels(endpoint="batch_generate").time():
        start_time = time.time()
        
        # Get additional parameters
        additional_params = request.additional_params or {}
        
        # Generate text in batch
        results = inference_engine.batch_generate(
            prompts=request.prompts,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            **additional_params
        )
        
        # Calculate metrics
        elapsed_time = time.time() - start_time
        # Simple token count estimation for all texts
        tokens_generated = sum(len(text.split()) * 1.3 for text in results)  # Rough approximation
        TOKEN_COUNTER.inc(tokens_generated)
        
        # Update system metrics
        update_system_metrics()
        
        return BatchResponse(
            texts=results,
            tokens_generated=int(tokens_generated),
            elapsed_time=elapsed_time,
            model_info={
                "model": inference_config.get("model_path", "unknown"),
                "quantization": inference_config.get("quantization", "none"),
                "batch_size": len(request.prompts),
            }
        )


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    update_system_metrics()
    return Response(content=prometheus_client.generate_latest(), media_type="text/plain")


def update_system_metrics():
    """Update system metrics for Prometheus."""
    # Memory usage
    memory = psutil.virtual_memory()
    SYSTEM_MEMORY.set(memory.used)
    
    # Load average
    load1, load5, load15 = psutil.getloadavg()
    LOAD_AVG.labels(interval="1m").set(load1)
    LOAD_AVG.labels(interval="5m").set(load5)
    LOAD_AVG.labels(interval="15m").set(load15)
    
    # GPU memory if available
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            gpu_memory = torch.cuda.memory_allocated(i)
            GPU_MEMORY.set(gpu_memory)


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="PersLM API Server")
    parser.add_argument("--model", type=str, required=True, help="Path to model or model ID")
    parser.add_argument("--quantization", type=str, default="none", 
                       choices=["none", "4bit", "8bit", "gptq"], help="Quantization type")
    parser.add_argument("--device", type=str, default="auto", help="Device to use (cpu, cuda, auto)")
    parser.add_argument("--port", type=int, default=5000, help="Port to run the API server on")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the API server on")
    parser.add_argument("--use-vllm", action="store_true", help="Use vLLM for faster inference")
    parser.add_argument("--enable-cache", action="store_true", help="Enable response caching")
    parser.add_argument("--trust-remote-code", action="store_true", help="Trust remote code when loading models")
    parser.add_argument("--max-context-length", type=int, default=4096, help="Maximum context length")
    parser.add_argument("--workers", type=int, default=1, help="Number of worker processes")
    parser.add_argument("--log-level", type=str, default="info", 
                       choices=["debug", "info", "warning", "error"], help="Logging level")
    
    return parser.parse_args()


def main():
    """Main entry point for the API server."""
    args = parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    
    # Create inference engine
    create_inference_engine(args)
    
    # Set number of workers metric
    INFERENCE_WORKERS.set(args.workers)
    
    # Run API server
    uvicorn.run(
        "src.serve.api:app",
        host=args.host,
        port=args.port,
        workers=args.workers,
        log_level=args.log_level.lower(),
    )


if __name__ == "__main__":
    main() 