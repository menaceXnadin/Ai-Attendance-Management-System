# Face Recognition Data Flow Documentation

## Database Schema Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    users    │    │  students   │    │ attendance  │
│             │    │             │    │  _records   │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ id (PK)     │◄───│ user_id(FK) │    │ id (PK)     │
│ email       │    │ student_id  │◄───│ student_id  │
│ full_name   │    │ faculty     │    │ (FK)        │
│ role        │    │ semester    │    │ date        │
│ ...         │    │ face_encoding│   │ status      │
└─────────────┘    │ (JSON Array)│    │ confidence  │
                   │ ...         │    │ _score      │
                   └─────────────┘    │ ...         │
                                     └─────────────┘
```

## Face Registration Process

1. **User Authentication**
   - Student logs in with JWT token
   - `get_current_student()` dependency validates user

2. **Face Capture & Validation**
   ```python
   # Frontend captures face image as base64
   POST /api/face-recognition/register-face
   {
     "image_data": "data:image/jpeg;base64,..."
   }
   ```

3. **Backend Processing**
   ```python
   # Validate image quality
   is_valid, message = face_recognition_service.validate_face_image(image_data)
   
   # Extract face encoding
   face_encoding = face_recognition_service.extract_face_encoding(image)
   
   # Store in database
   current_student.face_encoding = face_encoding  # JSON array
   await db.commit()
   ```

4. **Database Storage**
   ```sql
   UPDATE students 
   SET face_encoding = '[0.123, -0.456, 0.789, ...]'  -- 128-dimensional array
   WHERE user_id = current_user.id;
   ```

## Face Recognition Process

1. **Attendance Request**
   ```python
   POST /api/face-recognition/mark-attendance
   {
     "image_data": "data:image/jpeg;base64,...",
     "subject_id": "1"
   }
   ```

2. **Retrieve All Registered Students**
   ```python
   # Get all students with face encodings
   students = await db.execute(
       select(Student).where(Student.face_encoding.isnot(None))
   )
   
   # Prepare for comparison
   known_encodings = [
       (student.id, student.face_encoding) 
       for student in students
   ]
   ```

3. **Face Comparison**
   ```python
   # Compare captured face with all stored encodings
   for student_id, known_encoding in known_encodings:
       is_match, confidence = compare_faces([known_encoding], unknown_encoding)
       
       if is_match and confidence > best_confidence:
           best_match_student_id = student_id
           best_confidence = confidence
   ```

4. **Record Attendance**
   ```python
   # Create attendance record
   attendance = AttendanceRecord(
       student_id=recognition_result.student_id,
       subject_id=recognition_data.subject_id,
       date=datetime.now(),
       status="present",
       confidence_score=recognition_result.confidence_score,
       marked_by="face_recognition"
   )
   ```

## Data Security Features

### ✅ User Association
- Every face encoding is tied to a specific `user_id`
- No orphaned face data
- Proper foreign key constraints

### ✅ Data Integrity
- Face encodings stored as JSON arrays (128 dimensions)
- Confidence scores tracked for audit purposes
- Attendance records linked to specific students

### ✅ Privacy Protection
- Face images are not stored (only encodings)
- Encodings cannot be reverse-engineered to reconstruct faces
- Data deletion follows cascade rules

### ✅ Access Control
- JWT authentication required
- Role-based access (only students can register own faces)
- Admin oversight through attendance records

## Performance Optimizations

### ✅ Database Indexing
- `students.user_id` is indexed and unique
- `attendance_records.student_id` is indexed
- Efficient querying for face recognition

### ✅ Query Optimization
- Only students with `face_encoding IS NOT NULL` are queried
- Attendance checks include date filtering
- Limited result sets (e.g., last 50 records)

## Compliance & Standards

### ✅ Industry Best Practices
- Face encodings stored as numerical arrays
- One-to-one user-to-encoding mapping
- Audit trail with confidence scores
- Proper data normalization

### ✅ GDPR Compliance Ready
- Clear data ownership (user → student → face_encoding)
- Cascade deletion support
- Data minimization (only encodings, not images)
- Right to erasure support
