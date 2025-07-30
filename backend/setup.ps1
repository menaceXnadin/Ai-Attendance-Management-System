# AI Attendance Management System Setup Script for Windows

Write-Host "🚀 Setting up AI Attendance Management System Backend..." -ForegroundColor Green

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Found Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed. Please install Python 3.11+" -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL is installed
try {
    $pgVersion = psql --version 2>&1
    Write-Host "✅ Found PostgreSQL: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PostgreSQL is not found. Please install PostgreSQL or use Docker." -ForegroundColor Yellow
}

# Create virtual environment
Write-Host "📦 Creating virtual environment..." -ForegroundColor Blue
python -m venv venv

# Activate virtual environment
Write-Host "🔄 Activating virtual environment..." -ForegroundColor Blue
& .\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "📚 Installing dependencies..." -ForegroundColor Blue
python -m pip install --upgrade pip
pip install -r requirements.txt

# Copy environment file
if (!(Test-Path .env)) {
    Write-Host "📝 Creating environment file..." -ForegroundColor Blue
    Copy-Item .env.example .env -ErrorAction SilentlyContinue
    Write-Host "✏️  Please edit .env file with your database credentials" -ForegroundColor Yellow
}

# Setup database (if PostgreSQL is available)
try {
    Write-Host "🗄️  Setting up database..." -ForegroundColor Blue
    createdb ai_attendance_db 2>$null
    
    # Run migrations
    Write-Host "🔄 Running database migrations..." -ForegroundColor Blue
    alembic upgrade head
} catch {
    Write-Host "⚠️  Database setup skipped. Please setup manually." -ForegroundColor Yellow
}

Write-Host "✅ Backend setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your database credentials"
Write-Host "2. Run 'alembic upgrade head' to setup database"
Write-Host "3. Run 'uvicorn app.main:app --reload' to start the server"
Write-Host ""
Write-Host "📖 API Documentation will be available at: http://localhost:8000/docs" -ForegroundColor Green
