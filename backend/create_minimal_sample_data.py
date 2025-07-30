#!/usr/bin/env python3
"""
Minimal Sample Data Creator for AI Attendance Management System
Creates essential data for admin workflow testing
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import List

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models import (
    User, Admin, Student, Faculty, Subject, AttendanceRecord,
    UserRole, AttendanceStatus, AttendanceMethod
)
from app.core.security import get_password_hash
from sqlalchemy import text

async def main():
    print("🚀 Creating Minimal Sample Data for Admin Testing")
    print("=" * 50)
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if admin exists
            print("👨‍💼 Checking admin user...")
            result = await session.execute(text("SELECT * FROM users WHERE email = 'admin@attendance.com' LIMIT 1"))
            admin_row = result.fetchone()
            if not admin_row:
                print("❌ Admin user not found")
                return
            admin_id = admin_row[0]
            print(f"   ✅ Admin exists: admin@attendance.com (ID: {admin_id})")
            
            # Get sample faculties and subjects
            print("📚 Getting existing data...")
            faculties = await session.execute(text("SELECT * FROM faculties LIMIT 2"))
            faculty_list = faculties.fetchall()
            
            subjects = await session.execute(text("SELECT * FROM subjects LIMIT 2"))
            subject_list = subjects.fetchall()
            
            students_result = await session.execute(text("SELECT * FROM students LIMIT 5"))
            student_list = students_result.fetchall()
            
            print(f"   ✅ Found {len(faculty_list)} faculties, {len(subject_list)} subjects, {len(student_list)} students")
            
            # Create attendance records one by one to avoid bulk insert issues
            print("📊 Creating attendance records...")
            
            if subject_list and student_list:
                attendance_count = 0
                today = datetime.now().date()
                
                # Create 20 attendance records for the last 3 days
                for days_ago in range(3):
                    date = today - timedelta(days=days_ago)
                    
                    for i, subject_row in enumerate(subject_list):
                        for j, student_row in enumerate(student_list):
                            if attendance_count >= 20:
                                break
                            
                            # Create attendance record
                            attendance = AttendanceRecord(
                                student_id=student_row[0],  # student.id
                                subject_id=subject_row[0],  # subject.id
                                date=date,
                                status=AttendanceStatus.present if (i + j) % 3 != 0 else AttendanceStatus.absent,
                                method=AttendanceMethod.manual,
                                marked_by=admin_id
                            )
                            
                            session.add(attendance)
                            attendance_count += 1
                            
                            # Commit every 5 records to avoid large transactions
                            if attendance_count % 5 == 0:
                                await session.commit()
                                print(f"   📝 Created {attendance_count} attendance records...")
                        
                        if attendance_count >= 20:
                            break
                    
                    if attendance_count >= 20:
                        break
                
                # Final commit
                await session.commit()
                print(f"   ✅ Created {attendance_count} attendance records total")
            
            print("\n🎉 Sample data creation completed successfully!")
            print("\nNow you can test the admin workflow with:")
            print("• Admin login: admin@attendance.com")
            print("• View attendance records")
            print("• Manage student attendance")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await session.rollback()
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
