# Project Structure & Organization

## Root Directory Layout
```
AttendAI/
├── frontend/           # React TypeScript frontend
├── backend/            # FastAPI Python backend
├── *.md               # Documentation files
├── *.py               # Root-level utility scripts
└── *.html             # Debug/testing pages
```

## Backend Structure (`backend/`)
```
backend/
├── app/
│   ├── main.py                    # FastAPI application entry point
│   ├── database.py               # Database connection setup
│   ├── middleware.py             # Custom middleware
│   ├── core/
│   │   ├── config.py            # Application settings (Pydantic)
│   │   ├── database.py          # Database configuration
│   │   └── security.py          # Authentication utilities
│   ├── models/                   # SQLAlchemy database models
│   ├── schemas/                  # Pydantic request/response schemas
│   ├── api/
│   │   ├── routes/              # API route handlers
│   │   ├── endpoints/           # Additional endpoint modules
│   │   └── dependencies.py      # Route dependencies
│   ├── services/                # Business logic layer
│   └── utils/                   # Utility functions
├── alembic/                     # Database migrations
├── uploads/                     # File upload storage
├── requirements.txt             # Python dependencies
├── docker-compose.yml           # Container orchestration
├── Dockerfile                   # Container definition
└── .env                        # Environment variables
```

## Frontend Structure (`frontend/`)
```
frontend/
├── src/
│   ├── main.tsx                 # Application entry point
│   ├── App.tsx                  # Main app component
│   ├── components/              # Reusable UI components
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── attendance/         # Attendance-specific components
│   │   └── [feature]/          # Feature-specific components
│   ├── pages/                   # Route page components
│   ├── hooks/                   # Custom React hooks
│   ├── contexts/                # React context providers
│   ├── integrations/
│   │   └── api/                # API client and types
│   ├── lib/                     # Utility libraries
│   ├── services/                # Business logic services
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Helper functions
│   └── styles/                  # Global styles
├── public/                      # Static assets
├── package.json                 # Node.js dependencies
├── vite.config.ts              # Vite configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## Architecture Patterns

### Backend Patterns
- **Layered Architecture**: Routes → Services → Models
- **Dependency Injection**: FastAPI's dependency system
- **Repository Pattern**: SQLAlchemy models with service layer
- **Async/Await**: Throughout for database and I/O operations
- **Pydantic Schemas**: Separate request/response validation

### Frontend Patterns
- **Component Composition**: Reusable UI components with shadcn/ui
- **Custom Hooks**: Business logic abstraction
- **API Client Pattern**: Centralized API calls in `integrations/api/`
- **Context Providers**: Global state management
- **Route-Based Code Splitting**: Page-level components

## File Naming Conventions
- **Backend**: Snake_case for Python files and variables
- **Frontend**: PascalCase for components, camelCase for functions/variables
- **API Routes**: Kebab-case URLs (`/api/face-recognition/mark-attendance`)
- **Database**: Snake_case for table and column names

## Key Directories
- `backend/app/api/routes/`: All API endpoint definitions
- `frontend/src/components/`: Reusable UI components
- `frontend/src/pages/`: Route-level page components
- `backend/alembic/versions/`: Database migration files
- Root level: Utility scripts and documentation