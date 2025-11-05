from pydantic_settings import BaseSettings
from typing import List
import os
import logging
from pydantic import ValidationError

class Settings(BaseSettings):
    # Database
    database_url: str
    database_url_sync: str
    
    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    allowed_origins: List[str]
    
    # Face Recognition (using InsightFace)
    face_recognition_tolerance: float = 0.6  # Cosine similarity threshold
    insightface_det_size: int = 640  # Detection size for InsightFace
    development_mode: bool = False  # Enable real face detection for production
    
    # File Storage
    upload_dir: str = "uploads"
    max_file_size: int = 10485760  # 10MB
    
    # Email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    
    # Application
    project_name: str = "AttendAI"
    version: str = "1.0.0"
    debug: bool = True
    
    # Scheduler
    enable_auto_absent_scheduler: bool = True  # Enable automatic absent marking
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create settings instance
logger = logging.getLogger(__name__)

try:
    settings = Settings()
except ValidationError as e:
    # If required environment variables aren't set (e.g. on a bare Heroku deploy),
    # create a safe fallback Settings instance so the app can start and return
    # helpful logs. For production, set the required config vars in the environment.
    logger.warning("Settings validation failed: %s. Falling back to safe defaults.", e)
    settings = Settings.construct(
        database_url="sqlite:///./attendance.db",
        database_url_sync="sqlite:///./attendance.db",
        secret_key="dev-secret",
        allowed_origins=["http://localhost:5173", "http://localhost:3000"],
        project_name="AttendAI",
        version="1.0.0",
        debug=True,
    )

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)
