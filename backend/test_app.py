from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Simple FastAPI app for testing without database
app = FastAPI(
    title="AI Attendance Management System - Test Mode",
    version="1.0.0",
    description="Testing FastAPI setup without database dependencies"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8085"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint - Test if FastAPI is working"""
    return {
        "message": "🎉 FastAPI Backend is running successfully!",
        "status": "healthy",
        "version": "1.0.0",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "test": "/test"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Backend is running correctly",
        "service": "AI Attendance Management System"
    }

@app.get("/test")
async def test_endpoint():
    """Test endpoint to verify API is working"""
    return {
        "test": "success",
        "message": "API endpoints are working correctly!",
        "backend": "FastAPI",
        "database": "Not connected (test mode)"
    }

@app.get("/api/test-auth")
async def test_auth():
    """Test authentication endpoint (mock)"""
    return {
        "auth": "working",
        "message": "Authentication endpoints will work once database is connected",
        "next_steps": [
            "1. Setup PostgreSQL database",
            "2. Run database migrations",
            "3. Start full backend with database"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FastAPI Test Server...")
    print("📖 Visit: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
