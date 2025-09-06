from pydantic_settings import BaseSettings
from typing import List, Optional
import os

class Settings(BaseSettings):
    # Database - PostgreSQL only
    database_url: str = "postgresql+asyncpg://user:password@localhost/attendance_db"
    database_url_sync: str = "postgresql+psycopg2://user:password@localhost/attendance_db"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production-please-make-this-secure"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS - More permissive for deployment
    allowed_origins: List[str] = ["*"]  # Allow all origins for now
    
    # Face Recognition (using InsightFace)
    face_recognition_tolerance: float = 0.6
    insightface_det_size: int = 640
    development_mode: bool = True  # Set to True to avoid ML issues on Heroku
    
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
    debug: bool = False  # Set to False for production
    
    class Config:
        env_file = ".env"
        case_sensitive = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Handle Heroku's DATABASE_URL
        heroku_db_url = os.getenv("DATABASE_URL")
        if heroku_db_url:
            # Heroku provides postgres:// but SQLAlchemy needs postgresql://
            if heroku_db_url.startswith("postgres://"):
                heroku_db_url = heroku_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
            
            self.database_url = heroku_db_url
            self.database_url_sync = heroku_db_url.replace("+asyncpg://", "+psycopg2://")

# Create settings instance
settings = Settings()

# Ensure upload directory exists (but handle permission errors gracefully)
try:
    os.makedirs(settings.upload_dir, exist_ok=True)
except (PermissionError, OSError):
    # On Heroku, we might not have write permissions to create directories
    # This is okay, we'll handle uploads differently in production
    pass
