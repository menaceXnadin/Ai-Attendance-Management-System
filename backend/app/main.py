from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.core.config import settings
from app.api.routes import auth, face_recognition, students, classes, attendance, analytics, comprehensive
from app.api.routes.faculties import router as faculties_router
from app.api.routes.subjects import router as subjects_router
from app.api.routes.admins import router as admins_router
from app.middleware import ResponseTimeMiddleware
import logging
import warnings

# Suppress pkg_resources deprecation warning
warnings.filterwarnings("ignore", category=UserWarning, module="face_recognition_models")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="AI-powered attendance management system with face recognition",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware with more permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins since we're using a proxy
    allow_credentials=True,  # Allow credentials
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Add response time tracking middleware
app.add_middleware(ResponseTimeMiddleware)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost"]
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(face_recognition.router, prefix="/api")
app.include_router(students.router, prefix="/api")
app.include_router(classes.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(comprehensive.router, prefix="/api")
app.include_router(faculties_router, prefix="/api")
app.include_router(subjects_router, prefix="/api")
app.include_router(admins_router, prefix="/api")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Attendance Management System API",
        "version": settings.version,
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.version
    }

# Exception handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=404,
        content={"detail": "The requested resource was not found"}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {exc}")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.debug
    )
