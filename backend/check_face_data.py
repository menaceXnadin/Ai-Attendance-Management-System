#!/usr/bin/env python3
"""
Check face registration data in the database.
This script will help verify if face encodings are being stored.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models import Student, User

async def check_face_data():
    """Check face registration data in the database."""
    print("🔍 Checking face registration data in database...")
    
    try:
        async with AsyncSessionLocal() as db:
            # Get all students with their user info
            result = await db.execute(
                select(Student, User)
                .join(User, Student.user_id == User.id)
                .order_by(Student.id)
            )
            students_with_users = result.all()
            
            print(f"\n📊 Found {len(students_with_users)} students in database:")
            print("-" * 80)
            
            students_with_face = 0
            students_without_face = 0
            
            for student, user in students_with_users:
                has_face = student.face_encoding is not None
                face_status = "✅ HAS FACE" if has_face else "❌ NO FACE"
                
                if has_face:
                    students_with_face += 1
                    # Check the type and length of face encoding
                    encoding = student.face_encoding
                    if isinstance(encoding, list):
                        encoding_info = f"List with {len(encoding)} elements"
                    elif isinstance(encoding, dict):
                        encoding_info = f"Dict with keys: {list(encoding.keys())}"
                    else:
                        encoding_info = f"Type: {type(encoding)}"
                else:
                    students_without_face += 1
                    encoding_info = "None"
                
                print(f"ID: {student.id:3d} | {user.full_name:20s} | {face_status} | {encoding_info}")
            
            print("-" * 80)
            print(f"📈 Summary:")
            print(f"   • Students with face data: {students_with_face}")
            print(f"   • Students without face data: {students_without_face}")
            
            # Show detailed info for students with face data
            if students_with_face > 0:
                print(f"\n🔍 Detailed face encoding info:")
                result = await db.execute(
                    select(Student, User)
                    .join(User, Student.user_id == User.id)
                    .where(Student.face_encoding.isnot(None))
                )
                students_with_face_data = result.all()
                
                for student, user in students_with_face_data:
                    print(f"\n👤 {user.full_name} (ID: {student.id})")
                    encoding = student.face_encoding
                    
                    if isinstance(encoding, list) and len(encoding) > 0:
                        print(f"   • Encoding type: List of numbers")
                        print(f"   • Length: {len(encoding)}")
                        print(f"   • First 5 values: {encoding[:5]}")
                        print(f"   • Last 5 values: {encoding[-5:]}")
                        print(f"   • Value range: {min(encoding):.3f} to {max(encoding):.3f}")
                    elif isinstance(encoding, dict):
                        print(f"   • Encoding type: Dictionary")
                        print(f"   • Keys: {list(encoding.keys())}")
                        for key, value in encoding.items():
                            if isinstance(value, list):
                                print(f"   • {key}: List with {len(value)} elements")
                            else:
                                print(f"   • {key}: {value}")
                    else:
                        print(f"   • Encoding type: {type(encoding)}")
                        print(f"   • Value: {encoding}")
                    
                    print(f"   • Created: {student.created_at}")
                    print(f"   • Updated: {student.updated_at}")
    
    except Exception as e:
        print(f"❌ Error checking face data: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_face_data())
