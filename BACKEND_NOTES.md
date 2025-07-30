# Backend Implementation Notes

## Authentication System Refactoring

The backend needs to be refactored to disable public student registration and implement proper role-based access controls.

### Required Changes

1. **Remove or Disable Public Registration Endpoint**
   - Remove or restrict the `/api/register` or `/register` endpoint
   - Only allow authenticated admin users to create new student accounts

2. **Update Student Creation API**
   - Move student registration to a protected endpoint: `POST /api/students/`
   - Add middleware to verify admin role before allowing student creation
   - Example:
   ```python
   # Django Example
   @api_view(['POST'])
   @permission_classes([IsAuthenticated, IsAdmin])  # Custom permission to check admin role
   def create_student(request):
       # Validate request data
       serializer = StudentSerializer(data=request.data)
       if serializer.is_valid():
           serializer.save()
           # Create user account for the student
           User.objects.create_user(
               username=serializer.validated_data['email'],
               email=serializer.validated_data['email'],
               password=serializer.validated_data['password'],
               # Additional data like first_name, last_name, etc.
           )
           return Response(serializer.data, status=status.HTTP_201_CREATED)
       return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
   ```

3. **Login API Enhancement**
   - Update the login endpoint to return the user's role with the auth token
   - Example response:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "user_id",
       "name": "John Doe",
       "email": "john@example.com",
       "role": "student"  // or "admin"
     }
   }
   ```

4. **Role-Based Access Control**
   - Implement middleware to validate user roles for protected routes
   - Use decorators or middleware to secure each endpoint with appropriate role checks
   - Example:
   ```python
   # Django Example - Custom Permission Class
   class IsAdmin(BasePermission):
       def has_permission(self, request, view):
           return request.user.is_authenticated and request.user.role == 'admin'

   class IsStudent(BasePermission):
       def has_permission(self, request, view):
           return request.user.is_authenticated and request.user.role == 'student'
   ```

5. **Validation**
   - Add thorough validation for all student fields (name, faculty, email, password, face image)
   - Ensure passwords meet complexity requirements
   - Validate email format and uniqueness
   - Check that face images are valid and in the proper format

6. **Security Considerations**
   - Use HTTPS for all API requests
   - Implement rate limiting to prevent brute force attacks
   - Add CSRF protection if using cookie-based authentication
   - Use secure password hashing (bcrypt, Argon2, etc.)
   - Implement proper JWT token handling with expiration

7. **Logging**
   - Add comprehensive logging for authentication attempts
   - Log student creation events (who created which account and when)
   - Track failed login attempts to detect potential security issues
