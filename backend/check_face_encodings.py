#!/usr/bin/env python3

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import get_db, async_engine
from app.models import Student, User

async def check_face_encodings():
    """Check which students have face encodings registered."""
    
    async with AsyncSession(async_engine) as db:
        print("🔍 Checking face encoding status for all students...\n")
        
        # Get all students with their user info and face encoding status
        result = await db.execute(
            select(Student, User)
            .join(User, Student.user_id == User.id)
            .order_by(Student.id)
        )
        
        students_data = result.all()
        
        print("📊 Student Face Registration Status:")
        print("=" * 60)
        
        total_students = len(students_data)
        registered_faces = 0
        
        for student, user in students_data:
            has_face = student.face_encoding is not None
            if has_face:
                registered_faces += 1
                encoding_length = len(student.face_encoding) if isinstance(student.face_encoding, list) else "Invalid format"
                status = f"✅ REGISTERED ({encoding_length} dimensions)"
            else:
                status = "❌ NOT REGISTERED"
            
            print(f"👤 {user.full_name}")
            print(f"   📧 Email: {user.email}")
            print(f"   🆔 Student ID: {student.student_id}")
            print(f"   🎓 Faculty: {student.faculty}")
            print(f"   🤖 Face Status: {status}")
            print("-" * 40)
        
        print(f"\n📈 Summary:")
        print(f"   Total Students: {total_students}")
        print(f"   Faces Registered: {registered_faces}")
        print(f"   Not Registered: {total_students - registered_faces}")
        print(f"   Registration Rate: {(registered_faces/total_students*100):.1f}%" if total_students > 0 else "   Registration Rate: 0%")
        
        # If there are registered faces, show a sample encoding
        if registered_faces > 0:
            print(f"\n🔬 Sample Face Encoding Data:")
            for student, user in students_data:
                if student.face_encoding:
                    print(f"   Student: {user.full_name}")
                    if isinstance(student.face_encoding, list):
                        print(f"   Encoding Length: {len(student.face_encoding)}")
                        print(f"   Sample Values: {student.face_encoding[:5]}...")
                        print(f"   Data Type: List of floats")
                    else:
                        print(f"   Encoding Type: {type(student.face_encoding)}")
                        print(f"   Raw Data: {str(student.face_encoding)[:100]}...")
                    break
        
        print(f"\n💡 Next Steps:")
        if registered_faces == 0:
            print("   1. Login to frontend as a student")
            print("   2. Navigate to face registration")
            print("   3. Use FaceRegistration component to register face")
            print("   4. Run this script again to verify")
        else:
            print("   1. Test face recognition for attendance")
            print("   2. Use /face-recognition/mark-attendance endpoint")
            print("   3. Check attendance records")

if __name__ == "__main__":
    asyncio.run(check_face_encodings())
