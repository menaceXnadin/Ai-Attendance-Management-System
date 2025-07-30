# Admin Management System Documentation

## Overview
This document describes the complete admin management system with the newly added `name` column and proper synchronization across all system components.

## Database Schema

### Admin Table Structure
```sql
admins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    admin_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,  -- NEW: Direct admin name field
    department VARCHAR(255),
    permissions TEXT[],  -- Array of permission strings
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)
```

### Key Changes Made
1. **Added `name` column** to the `admins` table for direct access to admin names
2. **Fixed permissions column type** from JSON to `ARRAY(String)` for proper PostgreSQL compatibility
3. **Ensured synchronization** between `admin.name` and `user.full_name`

## API Endpoints

All admin management endpoints are available under `/api/admins/` with admin authentication required.

### 1. Get All Admins
- **Method**: GET
- **Endpoint**: `/api/admins/`
- **Parameters**: 
  - `skip` (optional): Pagination offset (default: 0)
  - `limit` (optional): Max results (default: 100)
- **Response**: List of admin objects with user information

### 2. Get Specific Admin
- **Method**: GET  
- **Endpoint**: `/api/admins/{admin_id}`
- **Parameters**: `admin_id` (path parameter)
- **Response**: Single admin object with user information

### 3. Create New Admin
- **Method**: POST
- **Endpoint**: `/api/admins/`
- **Body**: AdminCreate schema
- **Validation**: Checks for duplicate emails and admin IDs
- **Response**: Created admin object

### 4. Update Admin
- **Method**: PUT
- **Endpoint**: `/api/admins/{admin_id}`
- **Body**: AdminBase schema
- **Features**: 
  - Updates both admin.name and user.full_name for synchronization
  - Validates unique admin_id constraints
- **Response**: Updated admin object

### 5. Delete Admin
- **Method**: DELETE
- **Endpoint**: `/api/admins/{admin_id}`
- **Protections**: 
  - Prevents self-deletion
  - Cascades to delete associated user
- **Response**: Success message

### 6. Get Current Admin Info
- **Method**: GET
- **Endpoint**: `/api/admins/me`
- **Response**: Current admin's information

## Data Models

### Updated Admin Model
```python
class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    admin_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)  # NEW FIELD
    department = Column(String(255), nullable=True)
    permissions = Column(ARRAY(String), nullable=True)  # FIXED TYPE
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    user = relationship("User", back_populates="admin_profile")
```

### Updated Schemas
```python
class AdminBase(BaseModel):
    admin_id: Optional[str] = None
    name: str  # NEW FIELD
    department: Optional[str] = None
    permissions: Optional[List[str]] = None

class AdminCreate(AdminBase):
    user: UserCreate
    admin_id: str
    name: str  # REQUIRED

class Admin(AdminBase):
    id: int
    user_id: int
    user: User
    created_at: datetime
    updated_at: datetime
```

## Current Admin Users

The system currently has 5 admin users properly configured:

1. **ADMIN0003** - Admin User (admin@attendance.com)
2. **ADM002** - Deo Narayan Yadav (dny10@gmail.com)
3. **ADM003** - Dadhi Ram Ghimire (drg12@gmail.com)  
4. **ADM004** - Subash Pariyar (sp14@gmail.com)
5. **ADM005** - Nawaraj Poudel (npoudel13@gmail.com)

All users have proper name synchronization and comprehensive permissions.

## Synchronization Features

### 1. Name Synchronization
- When updating an admin's name via API, both `admin.name` and `user.full_name` are updated
- Ensures consistency across the system
- Prevents data drift between related fields

### 2. Permission Management
- Permissions stored as PostgreSQL text arrays
- Default permissions include:
  - `manage_students`
  - `manage_faculty`
  - `manage_subjects`
  - `view_reports`
  - `manage_attendance`
  - `manage_users`
  - `system_settings`

### 3. Data Integrity
- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicate admin IDs
- Cascade deletion removes associated users when admin is deleted

## Security Features

1. **Authentication Required**: All endpoints require valid admin authentication
2. **Self-Protection**: Admins cannot delete their own accounts
3. **Role Verification**: Only users with admin role can access admin endpoints
4. **Input Validation**: All inputs validated through Pydantic schemas

## Testing and Verification

A comprehensive test script (`test_admin_name_sync.py`) verifies:
- Name synchronization between admin and user tables
- API endpoint structure and availability
- Database schema compliance
- Data integrity checks

## Usage Examples

### Creating a New Admin via API
```python
POST /api/admins/
{
    "admin_id": "ADM006",
    "name": "New Admin Name",
    "department": "IT Department", 
    "permissions": ["manage_students", "view_reports"],
    "user": {
        "email": "newadmin@example.com",
        "full_name": "New Admin Name",
        "password": "securepassword"
    }
}
```

### Updating Admin Information
```python
PUT /api/admins/{admin_id}
{
    "name": "Updated Admin Name",
    "department": "Updated Department",
    "permissions": ["manage_students", "manage_faculty", "view_reports"]
}
```

## Migration History

1. **Initial Schema**: Basic admin table with JSON permissions
2. **Type Fix**: Changed permissions from JSON to ARRAY(String)
3. **Name Addition**: Added name column with proper synchronization
4. **API Enhancement**: Created comprehensive admin management endpoints

## Best Practices

1. **Always use the API endpoints** for admin management rather than direct database manipulation
2. **Ensure name consistency** by using the update endpoints that sync both fields
3. **Use proper permissions** arrays rather than custom permission structures
4. **Test changes** using the provided test scripts before deploying

## Future Enhancements

- Role-based permission templates
- Admin activity logging
- Bulk admin operations
- Advanced permission hierarchy
- Admin delegation features

---

This documentation reflects the complete implementation of the admin management system with proper name field synchronization as requested.
