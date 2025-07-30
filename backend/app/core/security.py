from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, status
from app.core.config import settings
import warnings

# Suppress bcrypt warnings
warnings.filterwarnings("ignore", category=UserWarning, module="passlib")
warnings.filterwarnings("ignore", message=".*bcrypt.*", category=UserWarning)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash using direct bcrypt."""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        # Fallback to passlib for existing hashes
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password using direct bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """Verify and decode a JWT token."""
    try:
        print(f"[DEBUG VERIFY] Token: {token[:50]}...")
        print(f"[DEBUG VERIFY] Secret key: {settings.secret_key}")
        print(f"[DEBUG VERIFY] Algorithm: {settings.algorithm}")
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        print(f"[DEBUG VERIFY] Payload: {payload}")
        return payload
    except JWTError as e:
        print(f"[DEBUG VERIFY] JWT Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
