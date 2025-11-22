from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import socketio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import os

from app.config import get_settings
from app.models import User, Case, Exam, ExamSession
from app.routes import auth_router, cases_router, exams_router, sessions_router, admin_router
from app.socket.exam_session import sio

settings = get_settings()

# Create uploads directory before mounting
os.makedirs(settings.upload_dir, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB connection
    client = AsyncIOMotorClient(settings.mongodb_url)
    await init_beanie(
        database=client[settings.database_name],
        document_models=[User, Case, Exam, ExamSession]
    )
    yield
    # Shutdown
    client.close()

app = FastAPI(
    title="IRExam API",
    description="Medical Education Exam Platform API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Include routers
app.include_router(auth_router)
app.include_router(cases_router)
app.include_router(exams_router)
app.include_router(sessions_router)
app.include_router(admin_router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "IRExam FastAPI Server Running"}

@app.get("/api/health")
async def api_health_check():
    return {"status": "ok", "message": "IRExam FastAPI Server Running"}

# Wrap FastAPI with Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:socket_app", host="0.0.0.0", port=5000, reload=True)
