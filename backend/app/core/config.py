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
    
    # Face engine (docs/system/face-verification.md §2-§3). Verification thresholds live in
    # the ``face_verification`` system setting, not here.
    face_recognition_tolerance: float = 0.6  # Legacy cosine threshold (compare_embeddings)
    insightface_det_size: int = 640  # SCRFD input size; 320-480 is faster for webcam selfies
    face_max_concurrency: int = 2  # Face-engine calls running at once (worker threads)
    antispoof_model_dir: str = ""  # MiniFASNet ONNX folder; empty = backend/models/anti_spoof
    # Deprecated and ignored (the mock face mode was removed). Kept only so existing .env
    # files that still set DEVELOPMENT_MODE keep loading (unknown .env keys are an error).
    development_mode: bool = False
    
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
    # Whether THIS process runs the background scheduler (env RUN_SCHEDULER). The auto-absent
    # job is additionally guarded by a PostgreSQL advisory lock, so several workers are safe.
    run_scheduler: bool = True

    # Clock: all "today/now" business decisions use this timezone (env APP_TIMEZONE)
    app_timezone: str = "Asia/Kathmandu"

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
