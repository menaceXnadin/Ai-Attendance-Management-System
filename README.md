# Face Recognition Attendance System

A student attendance system with facial recognition built with React, TypeScript, and Vite.

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
- Student attendance tracking with mock data
- Dashboard with attendance statistics
- Responsive design with dark mode support
- No backend required - all data is mocked in the frontend

## Mock Login

Use these credentials to login:
- Email: `admin@example.com` or `teacher1@example.com`
- Password: `password`
