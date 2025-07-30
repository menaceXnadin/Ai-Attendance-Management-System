#!/usr/bin/env python3
"""
Test script to debug the delete student operation
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import get_db
from app.models import Student, User

async def test_delete_student(student_id: int):
    """Test deleting a student with ID"""
    async for db in get_db():
        try:
            print(f"Testing delete for student ID: {student_id}")
            
            # Check if student exists
            result = await db.execute(select(Student).where(Student.id == student_id))
            student = result.scalar_one_or_none()
            
            if not student:
                print(f"Student with ID {student_id} not found")
                return
                
            print(f"Found student: {student.student_id}, User ID: {student.user_id}")
            
            # Check related records
            attendance_result = await db.execute(
                text("SELECT COUNT(*) FROM attendance_records WHERE student_id = :student_id"),
                {"student_id": student_id}
            )
            attendance_count = attendance_result.scalar()
            print(f"Attendance records: {attendance_count}")
            
            marks_result = await db.execute(
                text("SELECT COUNT(*) FROM marks WHERE student_id = :student_id"),
                {"student_id": student_id}
            )
            marks_count = marks_result.scalar()
            print(f"Marks records: {marks_count}")
            
            notifications_result = await db.execute(
                text("SELECT COUNT(*) FROM notifications WHERE user_id = :user_id"),
                {"user_id": student.user_id}
            )
            notifications_count = notifications_result.scalar()
            print(f"Notifications records: {notifications_count}")
            
            print("All checks passed - student can be deleted")
            
        except Exception as e:
            print(f"Error during test: {str(e)}")
            import traceback
            traceback.print_exc()

async def list_students():
    """List all students"""
    async for db in get_db():
        try:
            result = await db.execute(select(Student))
            students = result.scalars().all()
            print("\nAvailable students:")
            for student in students:
                print(f"ID: {student.id}, Student ID: {student.student_id}, User ID: {student.user_id}")
                
        except Exception as e:
            print(f"Error listing students: {str(e)}")

if __name__ == "__main__":
    asyncio.run(list_students())
    
    # Test with student ID 2 (the one that was failing)
    asyncio.run(test_delete_student(2))
