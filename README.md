
# AttendAI - AI-Powered Attendance Management System

A full-stack attendance system using facial recognition, built with React (Vite, TypeScript) for the frontend and FastAPI (Python) for the backend, with PostgreSQL as the database. InsightFace is used for robust, deep learning-based face recognition.

## Features

- AI-powered face detection and recognition (InsightFace)
- Real-time student attendance tracking and analytics
- Secure JWT-based authentication (admin and student roles)
- Responsive, modern frontend with React, Vite, and Tailwind CSS
- RESTful API backend with FastAPI and PostgreSQL
- Database migrations with Alembic
- Docker support for easy deployment

## Project Structure

- `frontend/`: React + Vite + TypeScript frontend
- `backend/`: FastAPI backend with InsightFace and PostgreSQL

## Quick Start

### Backend

1. Navigate to the backend directory:
  ```
  cd backend
  ```
2. Create and activate a virtual environment:
  ```
  python -m venv venv
  # Windows:
  .\venv\Scripts\activate
  # Linux/Mac:
  source venv/bin/activate
  ```
3. Install dependencies:
  ```
  pip install -r requirements.txt
  ```
4. Configure environment variables:
  - Copy `.env.example` to `.env` and update with your settings.
5. Set up the database:
  ```
  createdb ai_attendance_db
  alembic upgrade head
  ```
6. Run the backend server:
  ```
  uvicorn app.main:app --reload
  ```

### Frontend

1. Navigate to the frontend directory:
  ```
  cd frontend
  ```
2. Install dependencies:
  ```
  npm install
  ```
3. Run the development server:
  ```
  npm run dev
  ```
  The frontend will run on http://localhost:5173

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python, InsightFace, OpenCV, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Authentication:** JWT (python-jose)
- **Containerization:** Docker (optional)

## Authentication

- Secure JWT-based authentication for all users.
- Admins can create student accounts and manage attendance.

## Testing

- Test files are included for backend and frontend to ensure code quality and reliability.
