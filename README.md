# AttendAI - Smart Attendance Management System

An AI-powered student attendance system with facial recognition built with React, TypeScript, FastAPI, and PostgreSQL.

## Project Structure

- `frontend/`: React frontend built with Vite and TypeScript
  - `src/`: Source code
    - `components/`: UI components including face recognition
    - `contexts/`: React context providers
    - `hooks/`: Custom React hooks
    - `integrations/`: API client with mock data
    - `lib/`: Utility functions
    - `pages/`: Application pages
    - `types/`: TypeScript type definitions

## Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

The frontend will run on http://localhost:5173

## Features

- Face detection and recognition with webcam integration
- Student attendance tracking with real-time database integration
- Dashboard with attendance statistics and AI insights
- Responsive design with dark mode support
- Full-stack integration with FastAPI backend and PostgreSQL database

## Authentication

The system uses secure JWT-based authentication. Contact your system administrator for account credentials. Student accounts must be created by administrators through the admin panel.
