# Technology Stack & Build System

## Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (development server on port 8080)
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query (@tanstack/react-query) for server state
- **Routing**: React Router DOM
- **UI Components**: Radix UI primitives with custom styling
- **Charts**: Recharts for data visualization
- **Face Detection**: MediaPipe for client-side face detection

## Backend Stack
- **Framework**: FastAPI with Python 3.11+
- **Database**: PostgreSQL 15+ with SQLAlchemy 2.0 (async)
- **Migrations**: Alembic for database schema management
- **Authentication**: JWT with python-jose and bcrypt
- **Face Recognition**: InsightFace with ONNX runtime
- **Image Processing**: OpenCV and Pillow
- **API Documentation**: Automatic Swagger/OpenAPI docs

## Development Commands

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev         # Start dev server (http://localhost:8080)
npm run build       # Production build
npm run preview     # Preview production build
```

### Backend
```bash
cd backend
python -m venv venv                    # Create virtual environment
source venv/bin/activate               # Activate (Linux/Mac)
.\venv\Scripts\activate               # Activate (Windows)
pip install -r requirements.txt       # Install dependencies
uvicorn app.main:app --reload         # Start dev server (http://localhost:8000)
alembic upgrade head                  # Run database migrations
alembic revision --autogenerate -m "description"  # Create new migration
```

### Docker Setup
```bash
docker-compose up -d                  # Start all services
docker-compose exec backend alembic upgrade head  # Run migrations in container
```

## Environment Configuration
- Frontend: Uses Vite proxy to route `/api` requests to backend
- Backend: Environment variables in `.env` file
- Database: PostgreSQL with async support via asyncpg
- CORS: Configured for localhost development ports

## Key Libraries
- **InsightFace**: Primary face recognition engine (replaces face_recognition)
- **SQLAlchemy 2.0**: Modern async ORM patterns
- **Pydantic**: Data validation and settings management
- **FastAPI**: High-performance async web framework
- **React Query**: Server state management and caching