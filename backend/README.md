# AI Attendance Management System - Backend

FastAPI-based backend for the AI Attendance Management System with PostgreSQL database and face recognition capabilities.

## 🚀 Features

- **Face Recognition Authentication**: Advanced face recognition for attendance marking
- **Role-Based Access Control**: Admin and Student roles with appropriate permissions
- **Real-time Attendance Tracking**: Live attendance monitoring and analytics
- **AI-Powered Insights**: Predictive analytics and smart recommendations
- **RESTful API**: Comprehensive API with automatic documentation
- **Database Migrations**: Alembic for database schema management
- **Security**: JWT authentication with password hashing
- **Docker Support**: Easy deployment with Docker containers

## 🛠️ Tech Stack

- **Framework**: FastAPI 0.104.1
- **Database**: PostgreSQL with SQLAlchemy 2.0
- **Authentication**: JWT with python-jose
- **Face Recognition**: OpenCV + face-recognition library
- **Async Support**: AsyncPG for database operations
- **API Documentation**: Automatic Swagger/OpenAPI docs
- **Containerization**: Docker & Docker Compose

## 📋 Prerequisites

- Python 3.11+
- PostgreSQL 15+ (or Docker)
- OpenCV dependencies
- Git

## ⚡ Quick Start

### Option 1: Automated Setup (Recommended)

**Windows (PowerShell):**
```powershell
.\setup.ps1
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

1. **Clone and navigate to backend:**
```bash
cd backend
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate  # Windows
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

5. **Setup database:**
```bash
# Create PostgreSQL database
createdb ai_attendance_db

# Run migrations
alembic upgrade head
```

6. **Start the server:**
```bash
uvicorn app.main:app --reload
```

### Option 3: Docker Setup

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend alembic upgrade head
```

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI application
│   ├── core/
│   │   ├── config.py          # Application settings
│   │   ├── database.py        # Database configuration
│   │   └── security.py        # Authentication utilities
│   ├── models/
│   │   └── __init__.py        # SQLAlchemy models
│   ├── schemas/
│   │   └── __init__.py        # Pydantic schemas
│   ├── api/
│   │   ├── dependencies.py    # Route dependencies
│   │   └── routes/
│   │       ├── auth.py        # Authentication routes
│   │       └── face_recognition.py
│   ├── services/
│   │   └── face_recognition.py # Face recognition service
│   └── utils/
├── alembic/                    # Database migrations
├── requirements.txt
├── docker-compose.yml
├── Dockerfile
└── .env                       # Environment variables
```

## 🔧 Configuration

Key environment variables in `.env`:

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/ai_attendance_db
DATABASE_URL_SYNC=postgresql://postgres:password@localhost:5432/ai_attendance_db

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Face Recognition
FACE_RECOGNITION_TOLERANCE=0.6
FACE_ENCODING_MODEL=large

# CORS
ALLOWED_ORIGINS=["http://localhost:3000", "http://localhost:8085"]
```

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register-student` - Register student (admin only)
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - User logout

### Face Recognition
- `POST /api/face-recognition/mark-attendance` - Mark attendance with face
- `POST /api/face-recognition/register-face` - Register student's face
- `GET /api/face-recognition/my-attendance` - Get student's attendance
- `POST /api/face-recognition/verify-face` - Verify face image quality

## 📖 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🗄️ Database Schema

### Core Models:
- **User**: Base user information and authentication
- **Student**: Student-specific profile and face encoding
- **Admin**: Administrator profile and permissions
- **Subject**: Course/subject information
- **AttendanceRecord**: Attendance tracking with face recognition data
- **Mark**: Academic marks and grades
- **AIInsight**: AI-generated insights and predictions

## 🤖 Face Recognition

The system uses advanced face recognition with:
- **Encoding Storage**: Face encodings stored as JSON in PostgreSQL
- **Real-time Recognition**: Live face comparison during attendance
- **Quality Validation**: Image quality checks before registration
- **Confidence Scoring**: Recognition confidence levels
- **Security**: Tolerance-based matching for accuracy

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password hashing
- **Role-Based Access**: Admin/Student permission separation
- **CORS Protection**: Configurable cross-origin policies
- **Input Validation**: Pydantic schema validation
- **SQL Injection Protection**: SQLAlchemy ORM protection

## 🚀 Deployment

### Production Environment

1. **Environment Setup:**
```bash
# Use production database URL
DATABASE_URL=postgresql+asyncpg://user:pass@prod-host:5432/ai_attendance_db

# Use strong secret key
SECRET_KEY=your-production-secret-key

# Disable debug mode
DEBUG=False
```

2. **Docker Deployment:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

3. **Database Migration:**
```bash
alembic upgrade head
```

## 📊 Monitoring & Logging

- **Health Check**: `/health` endpoint for monitoring
- **Structured Logging**: Comprehensive request/error logging
- **Performance Metrics**: Built-in FastAPI metrics
- **Error Tracking**: Detailed error reporting

## 🧪 Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app tests/
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the API documentation at `/docs`
- Review the logs for error details

## 🔄 Version History

- **v1.0.0**: Initial release with face recognition and basic attendance
- **v1.1.0**: Added AI insights and predictions
- **v1.2.0**: Enhanced security and performance optimizations
