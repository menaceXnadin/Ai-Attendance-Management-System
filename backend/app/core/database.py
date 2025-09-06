from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings
import os

# Fix database URL for Heroku PostgreSQL
def get_database_urls():
    """Get properly formatted PostgreSQL database URLs"""
    db_url = settings.database_url
    db_url_sync = settings.database_url_sync
    
    # Handle Heroku DATABASE_URL conversion
    heroku_db_url = os.getenv("DATABASE_URL")
    if heroku_db_url:
        # Convert postgres:// to postgresql:// for SQLAlchemy 2.0+
        if heroku_db_url.startswith("postgres://"):
            heroku_db_url = heroku_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif not heroku_db_url.startswith("postgresql"):
            heroku_db_url = heroku_db_url.replace("://", "+asyncpg://", 1)
        
        db_url = heroku_db_url
        # Sync version for migrations
        db_url_sync = heroku_db_url.replace("+asyncpg://", "+psycopg2://")
    
    return db_url, db_url_sync

# Get the corrected URLs
async_db_url, sync_db_url = get_database_urls()

# Async engine for FastAPI
async_engine = create_async_engine(
    async_db_url,
    echo=settings.debug,
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True
)

# Sync engine for Alembic migrations
sync_engine = create_engine(
    sync_db_url,
    echo=settings.debug
)

# Session makers
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine
)

# Base class for models
Base = declarative_base()

# Dependency to get async database session
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Dependency to get sync database session (for migrations)
def get_sync_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
