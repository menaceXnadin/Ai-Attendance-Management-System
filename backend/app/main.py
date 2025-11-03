from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.core.config import settings
from app.api.routes import auth, face_recognition, students, classes, attendance, analytics, comprehensive
from app.api.routes.faculties import router as faculties_router
from app.api.routes.subjects import router as subjects_router
from app.api.routes.admins import router as admins_router
from app.api.routes.teachers import router as teachers_router
from app.api.routes.teacher_dashboard import router as teacher_dashboard_router
from app.api.routes.schedules import router as schedules_router
from app.api.routes.face_testing import router as face_testing_router
from app.api.routes.event_sessions import router as event_sessions_router
from app.api.routes.academic_metrics import router as academic_metrics_router
from app.api.routes.student_attendance import router as student_attendance_router
from app.api.routes.session_metrics import router as session_metrics_router
from app.api.routes.admin_semester_config import router as admin_semester_config_router
from app.api.routes.admin_calendar_config import router as admin_calendar_config_router
from app.api.routes.student_calendar import router as student_calendar_router
from app.api.routes.calendar_generator import router as calendar_generator_router
from app.api.routes.streaks_badges import router as streaks_badges_router
from app.api.routes.auto_absent_trigger import router as auto_absent_trigger_router
from app.api.routes.system_settings import router as system_settings_router
from app.api.endpoints.notifications import router as notifications_router
from app.api.calendar import router as calendar_router
from app.middleware import ResponseTimeMiddleware
from app.services.scheduler_service import scheduler_service
import logging
import warnings
from contextlib import asynccontextmanager

# Suppress pkg_resources deprecation warning
warnings.filterwarnings("ignore", category=UserWarning, module="face_recognition_models")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context replacing deprecated on_event handlers.

    - Pre-yield: startup logic (configure, warm-up, start background tasks)
    - Post-yield: shutdown logic (cleanup, stop background tasks)
    """
    # Startup
    logger.info("Registered routes:")
    for route in app.routes:
        logger.info(f"Route: {getattr(route, 'path', str(route))} - Methods: {getattr(route, 'methods', set())}")

    # Load academic calendar override configuration
    logger.info("Loading academic calendar configuration...")
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.automatic_semester import AutomaticSemesterService

        async with AsyncSessionLocal() as session:
            override_active = await AutomaticSemesterService.load_override_from_db(session)
            if override_active:
                logger.info("✅ Academic calendar override loaded from database")
            else:
                logger.info("✅ Using default academic calendar dates")
    except Exception as e:
        logger.warning(f"Failed to load calendar override (using defaults): {e}")

    # Start the background scheduler for auto-absent processing
    logger.info("Starting background scheduler...")
    await scheduler_service.start()

    # Hand control to application runtime
    yield

    # Shutdown
    logger.info("Stopping background scheduler...")
    await scheduler_service.stop()

# Create FastAPI app with lifespan handler
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="AI-powered attendance management system with face recognition",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add CORS middleware with more permissive settings
app.add_middleware(
    CORSMiddleware,
    # When allow_credentials=True, '*' is not allowed. List explicit origins used by frontend.
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add response time tracking middleware
app.add_middleware(ResponseTimeMiddleware)

# Add debug middleware to see all requests
@app.middleware("http")
async def debug_requests(request, call_next):
    print(f"[MIDDLEWARE DEBUG] {request.method} {request.url}")
    print(f"[MIDDLEWARE DEBUG] Headers: {dict(request.headers)}")
    
    response = await call_next(request)
    
    print(f"[MIDDLEWARE DEBUG] Response status: {response.status_code}")
    return response

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost", "*"]
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(face_recognition.router, prefix="/api")
app.include_router(face_testing_router, prefix="/api")
app.include_router(students.router, prefix="/api")
app.include_router(classes.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(comprehensive.router, prefix="/api")
app.include_router(faculties_router, prefix="/api")
app.include_router(subjects_router, prefix="/api")
app.include_router(admins_router, prefix="/api")
app.include_router(teachers_router, prefix="/api")
app.include_router(teacher_dashboard_router, prefix="/api")
app.include_router(schedules_router, prefix="/api")
app.include_router(academic_metrics_router, prefix="/api")
app.include_router(session_metrics_router, prefix="/api")
app.include_router(student_attendance_router, prefix="/api")
app.include_router(student_calendar_router, prefix="/api")
app.include_router(calendar_generator_router, prefix="/api")
app.include_router(streaks_badges_router, prefix="/api")
app.include_router(admin_semester_config_router, prefix="/api")
app.include_router(admin_calendar_config_router)
app.include_router(auto_absent_trigger_router, prefix="/api")
app.include_router(system_settings_router, prefix="/api/system-settings", tags=["System Settings"])
app.include_router(notifications_router, prefix="/api")
app.include_router(calendar_router, prefix="/api")
app.include_router(event_sessions_router, prefix="/api")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Attendance Management System API",
        "version": settings.version,
        "docs": "/docs"
    }
    
# (startup/shutdown moved to lifespan above)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.version
    }

@app.get("/api/__routes")
async def list_routes():
    """Diagnostic endpoint: list all registered routes and methods."""
    routes_info = []
    for route in app.routes:
        try:
            methods = sorted(list(route.methods)) if hasattr(route, 'methods') else []
            path = getattr(route, 'path', str(route))
            routes_info.append({"path": path, "methods": methods})
        except Exception:
            continue
    return {"routes": routes_info}

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
 
