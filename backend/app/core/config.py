from pydantic_settings import BaseSettings
from typing import List
import os

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
    # Frontend base URL for building links (used in reset links)
    # If empty, will be constructed from frontend_port.
    frontend_base_url: str = ""
    frontend_port: int = 8080
    
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
settings = Settings()

# Derive frontend_base_url dynamically if not explicitly provided
if not settings.frontend_base_url:
    settings.frontend_base_url = f"http://localhost:{settings.frontend_port}"

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)
