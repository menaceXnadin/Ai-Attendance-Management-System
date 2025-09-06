from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./attendance_system.db"
    database_url_sync: str = "sqlite:///./attendance_system.db"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]
    
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
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create settings instance
settings = Settings()

# Handle Heroku DATABASE_URL
if os.getenv("DATABASE_URL"):
    settings.database_url = os.getenv("DATABASE_URL")
    settings.database_url_sync = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+psycopg2://")

# Add Heroku app URL to allowed origins if deployed on Heroku
heroku_app_name = os.getenv("HEROKU_APP_NAME")
if heroku_app_name:
    heroku_url = f"https://{heroku_app_name}.herokuapp.com"
    if heroku_url not in settings.allowed_origins:
        settings.allowed_origins.append(heroku_url)

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)
