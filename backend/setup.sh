#!/bin/bash

# AI Attendance Management System Setup Script

echo "🚀 Setting up AI Attendance Management System Backend..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+"
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not found. Please install PostgreSQL or use Docker."
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✏️  Please edit .env file with your database credentials"
fi

# Setup database (if PostgreSQL is available)
if command -v psql &> /dev/null; then
    echo "🗄️  Setting up database..."
    createdb ai_attendance_db 2>/dev/null || echo "Database might already exist"
    
    # Run migrations
    echo "🔄 Running database migrations..."
    alembic upgrade head
fi

echo "✅ Backend setup complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Edit .env file with your database credentials"
echo "2. Run 'alembic upgrade head' to setup database"
echo "3. Run 'uvicorn app.main:app --reload' to start the server"
echo ""
echo "📖 API Documentation will be available at: http://localhost:8000/docs"
