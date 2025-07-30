@echo off
echo 🚀 AI Attendance Management System - Backend Startup
echo ================================================

cd /d "c:\Users\MenaceXnadin\Documents\FinalYearProject\backend"
echo 📍 Working directory: %CD%

echo.
echo 📦 Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo 📚 Installing required dependencies...
pip install fastapi uvicorn sqlalchemy asyncpg alembic pydantic-settings python-dotenv psycopg2-binary python-jose[cryptography] passlib[bcrypt]

echo.
echo 🧪 Testing backend import...
python -c "print('Testing imports...'); from app.main import app; print('✅ Backend imports successfully!')"

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Import failed. Check dependencies.
    pause
    exit /b 1
)

echo.
echo 🌟 Starting FastAPI server...
echo 📖 API Documentation will be at: http://localhost:8000/docs
echo 🔍 Health check at: http://localhost:8000/health
echo.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause
