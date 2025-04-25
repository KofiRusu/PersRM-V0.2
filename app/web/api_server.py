#!/usr/bin/env python3
"""
PersLM API Server

This script provides a FastAPI-based web API for interacting with the PersLM assistant.
It enables web-based interactions and serves as a backend for web/mobile applications.
"""

import os
import sys
import time
import json
import uuid
import logging
import asyncio
import argparse
import threading
from typing import Dict, List, Any, Optional
from pathlib import Path

# Add the project root to the Python path
script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
root_dir = script_dir.parent.parent
sys.path.insert(0, str(root_dir))

# Import application components
from app.common import config, persistence, notification

# Import FastAPI components
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, BackgroundTasks, Depends, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Import PersLM core components
try:
    from src.realtime.realtime_loop import RealtimeLoop
    from src.loop.autonomy_loop import AutonomyLoop
    from src.personalization import personalization_manager
except ImportError as e:
    print(f"Error importing PersLM components: {e}")
    print("Make sure you're running from the correct directory.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(os.path.join("logs", "api_server.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("api_server")

# Create FastAPI app
app = FastAPI(
    title="PersLM API",
    description="API for interacting with PersLM personal assistant",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# API models
class MessageRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    session_id: Optional[str] = None
    voice_mode: bool = False
    stream: bool = False

class TaskRequest(BaseModel):
    action: str
    parameters: Dict[str, Any] = {}
    user_id: str = "default_user"
    schedule: Optional[Dict[str, Any]] = None

class ConfigUpdateRequest(BaseModel):
    changes: Dict[str, Any]
    user_id: str = "default_user"

# Global instances
realtime_loop = None
autonomy_loop = None
app_config = {}
connection_manager = None


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        logger.info(f"Client {client_id} connected, {len(self.active_connections[client_id])} active connections")
        
    def disconnect(self, websocket: WebSocket, client_id: str):
        if client_id in self.active_connections:
            if websocket in self.active_connections[client_id]:
                self.active_connections[client_id].remove(websocket)
                logger.info(f"Client {client_id} disconnected, {len(self.active_connections[client_id])} connections remaining")
                
            # Clean up if no connections left
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
                
    async def broadcast_to_client(self, message: Dict[str, Any], client_id: str):
        if client_id in self.active_connections:
            for connection in self.active_connections[client_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to client {client_id}: {str(e)}")
                    
    async def broadcast(self, message: Dict[str, Any]):
        for client_id in self.active_connections:
            await self.broadcast_to_client(message, client_id)


# Initialize global components
def initialize_components(args):
    global realtime_loop, autonomy_loop, app_config, connection_manager
    
    # Initialize connection manager
    connection_manager = ConnectionManager()
    
    try:
        # Create necessary directories
        os.makedirs("logs", exist_ok=True)
        
        # Load configuration
        app_config = config.load_config(args.config)
        
        # Initialize persistence system
        persistence.initialize(app_config.get("persistence", {}))
        
        # Initialize notification system
        notification.initialize(
            app_config.get("notification", {}),
            handler=handle_notification
        )
        
        # Initialize real-time interaction loop
        logger.info("Initializing real-time interaction loop...")
        realtime_loop = RealtimeLoop(
            config_path=args.realtime_config,
            model_provider=create_model_provider()
        )
        
        # Initialize autonomy loop
        logger.info("Initializing autonomy loop...")
        autonomy_loop = AutonomyLoop(
            config_path=args.autonomy_config,
            autonomy_level=args.autonomy_level
        )
        
        # Start autonomy loop if enabled
        if not args.no_autonomy:
            start_autonomy_loop()
        
        logger.info("Components initialized successfully")
        
    except Exception as e:
        logger.error(f"Error initializing components: {e}")
        raise e


def handle_notification(title, message, notification_type):
    """Handle notifications by broadcasting to connected clients."""
    if connection_manager:
        asyncio.create_task(
            connection_manager.broadcast({
                "type": "notification",
                "title": title,
                "message": message,
                "notification_type": notification_type
            })
        )


def create_model_provider():
    """Create model provider function for PersLM."""
    def model_provider(prompt, streaming=False, client_id=None, message_id=None):
        """Model provider with WebSocket streaming support."""
        if streaming and client_id and connection_manager:
            # Use WebSocket for streaming
            async def stream_to_client():
                # This would normally stream from the model
                # For now, we'll just simulate with a simple implementation
                response = f"This is a simulated streaming response for: {prompt}"
                tokens = response.split()
                
                for i, token in enumerate(tokens):
                    await connection_manager.broadcast_to_client({
                        "type": "token",
                        "token": token + " ",
                        "message_id": message_id,
                        "is_final": (i == len(tokens) - 1)
                    }, client_id)
                    await asyncio.sleep(0.05)  # Simulate processing time
            
            # Start streaming in background
            asyncio.create_task(stream_to_client())
            return None  # Streaming handled by WebSocket
            
        else:
            # Return complete response
            return f"This is a simulated response for: {prompt}"
    
    return model_provider


def start_autonomy_loop():
    """Start the autonomy loop in a background thread."""
    global autonomy_loop
    
    if not autonomy_loop:
        logger.warning("Autonomy loop not initialized")
        return False
    
    try:
        autonomy_loop.start()
        logger.info("Autonomy loop started successfully")
        return True
    except Exception as e:
        logger.error(f"Error starting autonomy loop: {e}")
        return False


def stop_autonomy_loop():
    """Stop the autonomy loop."""
    global autonomy_loop
    
    if not autonomy_loop:
        logger.warning("Autonomy loop not initialized")
        return False
    
    try:
        autonomy_loop.stop()
        logger.info("Autonomy loop stopped successfully")
        return True
    except Exception as e:
        logger.error(f"Error stopping autonomy loop: {e}")
        return False


# Dependency for authenticated requests (placeholder)
async def get_current_user(request: Request):
    # This would validate auth tokens in a real implementation
    # For now, just return the user ID from header or default
    user_id = request.headers.get("X-User-ID", "default_user")
    return {"user_id": user_id}


# API endpoints
@app.get("/")
async def root():
    """Health check and API info."""
    return {
        "status": "ok",
        "name": "PersLM API",
        "version": "1.0.0",
        "autonomy_active": autonomy_loop is not None and getattr(autonomy_loop, 'running', False)
    }


@app.post("/message")
async def send_message(
    request: MessageRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict = Depends(get_current_user)
):
    """Send a message to PersLM and get a response."""
    user_id = request.user_id or current_user["user_id"]
    session_id = request.session_id or str(uuid.uuid4())
    
    try:
        if request.stream:
            # For streaming, return message ID and stream via WebSocket
            message_id = str(uuid.uuid4())
            
            # Process in background (client will receive via WebSocket)
            # In a real implementation, this would use the actual model
            # and stream the result to the connected client
            if realtime_loop and realtime_loop._model_provider:
                realtime_loop._model_provider(
                    request.message,
                    streaming=True,
                    client_id=user_id,
                    message_id=message_id
                )
            
            return {
                "message_id": message_id, 
                "session_id": session_id,
                "status": "streaming"
            }
        else:
            # For non-streaming, return complete response
            response = "This is a simulated response from PersLM API."
            
            # In a real implementation, this would use the actual model
            if realtime_loop and realtime_loop._model_provider:
                response = realtime_loop._model_provider(request.message, streaming=False)
            
            return {
                "response": response,
                "session_id": session_id
            }
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )


@app.post("/task")
async def create_task(
    request: TaskRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Create and execute a task."""
    user_id = request.user_id or current_user["user_id"]
    
    if not autonomy_loop:
        raise HTTPException(
            status_code=500,
            detail="Autonomy system not initialized"
        )
    
    try:
        # In a real implementation, this would create and execute a task
        # through the autonomy loop
        task_id = str(uuid.uuid4())
        
        return {
            "task_id": task_id,
            "status": "submitted",
            "user_id": user_id,
            "action": request.action
        }
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating task: {str(e)}"
        )


@app.get("/tasks")
async def list_tasks(
    current_user: Dict = Depends(get_current_user)
):
    """List active and scheduled tasks."""
    user_id = current_user["user_id"]
    
    if not autonomy_loop:
        raise HTTPException(
            status_code=500,
            detail="Autonomy system not initialized"
        )
    
    try:
        # In a real implementation, this would fetch tasks from the autonomy loop
        return {
            "active_tasks": [],  # Placeholder
            "scheduled_tasks": []  # Placeholder
        }
    except Exception as e:
        logger.error(f"Error listing tasks: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error listing tasks: {str(e)}"
        )


@app.post("/config")
async def update_config(
    request: ConfigUpdateRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Update configuration values."""
    user_id = request.user_id or current_user["user_id"]
    
    try:
        # Update configuration
        for key, value in request.changes.items():
            config.set_config_value(key, value)
        
        # Apply changes to components
        if "autonomy_level" in request.changes and autonomy_loop:
            autonomy_loop.set_autonomy_level(request.changes["autonomy_level"])
        
        return {
            "status": "success",
            "updated_keys": list(request.changes.keys())
        }
    except Exception as e:
        logger.error(f"Error updating configuration: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error updating configuration: {str(e)}"
        )


@app.get("/config")
async def get_config(
    current_user: Dict = Depends(get_current_user)
):
    """Get current configuration values."""
    try:
        # In a real implementation, this would safely return configuration
        # filtered by user permissions
        return {
            "config": {
                "ui": app_config.get("ui", {}),
                "notification": app_config.get("notification", {})
                # Don't include sensitive settings like API keys
            }
        }
    except Exception as e:
        logger.error(f"Error getting configuration: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting configuration: {str(e)}"
        )


@app.post("/autonomy/start")
async def api_start_autonomy(
    current_user: Dict = Depends(get_current_user)
):
    """Start the autonomy loop."""
    success = start_autonomy_loop()
    
    if success:
        return {"status": "success", "message": "Autonomy loop started"}
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to start autonomy loop"
        )


@app.post("/autonomy/stop")
async def api_stop_autonomy(
    current_user: Dict = Depends(get_current_user)
):
    """Stop the autonomy loop."""
    success = stop_autonomy_loop()
    
    if success:
        return {"status": "success", "message": "Autonomy loop stopped"}
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to stop autonomy loop"
        )


@app.get("/status")
async def get_status():
    """Get system status."""
    return {
        "status": "ok",
        "autonomy_active": autonomy_loop is not None and getattr(autonomy_loop, 'running', False),
        "uptime": time.time() - startup_time,
        "version": "1.0.0"
    }


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time communication."""
    await connection_manager.connect(websocket, client_id)
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection_status",
            "status": "connected",
            "client_id": client_id
        })
        
        # Process messages
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            if data.get("type") == "message":
                # Handle chat message
                message = data.get("message", "")
                user_id = data.get("user_id", client_id)
                session_id = data.get("session_id", str(uuid.uuid4()))
                message_id = data.get("message_id", str(uuid.uuid4()))
                
                # Process message (simulate for now)
                if realtime_loop and realtime_loop._model_provider:
                    realtime_loop._model_provider(
                        message,
                        streaming=True,
                        client_id=client_id,
                        message_id=message_id
                    )
                
            elif data.get("type") == "ping":
                # Respond to ping
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
                
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"Error in WebSocket: {str(e)}")
    finally:
        connection_manager.disconnect(websocket, client_id)


# Static file serving (for web UI)
@app.on_event("startup")
async def startup_event():
    global startup_time
    startup_time = time.time()
    
    # Mount static files directory if it exists
    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/ui", StaticFiles(directory=str(static_dir), html=True), name="ui")


@app.get("/ui", include_in_schema=False)
async def serve_ui():
    """Serve the web UI."""
    static_dir = Path(__file__).parent / "static"
    index_path = static_dir / "index.html"
    
    if index_path.exists():
        return FileResponse(str(index_path))
    else:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": "Web UI not available"}
        )


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    if autonomy_loop:
        stop_autonomy_loop()
    
    persistence.save()
    logger.info("API server shutting down")


def main():
    """Main entry point for the API server."""
    parser = argparse.ArgumentParser(description="PersLM API Server")
    
    # Configuration options
    parser.add_argument("--config", type=str, help="Path to application configuration file")
    parser.add_argument("--realtime-config", type=str, help="Path to real-time interaction configuration")
    parser.add_argument("--autonomy-config", type=str, help="Path to autonomy loop configuration")
    
    # Server options
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to listen on")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    
    # Feature flags
    parser.add_argument("--no-autonomy", action="store_true", help="Disable autonomy loop")
    parser.add_argument("--autonomy-level", type=str, choices=["disabled", "assisted", "supervised", "full"],
                      default="supervised", help="Autonomy level")
    
    # Parse arguments
    args = parser.parse_args()
    
    try:
        # Initialize components
        initialize_components(args)
        
        # Start server
        import uvicorn
        uvicorn.run(app, host=args.host, port=args.port)
        
    except Exception as e:
        logger.error(f"Error starting API server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 