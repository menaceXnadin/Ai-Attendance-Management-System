#!/usr/bin/env python3
"""
SQLAlchemy ORM Sample Data Creator for Admin Workflow Testing
Uses SQLAlchemy ORM with proper enum handling
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models import AttendanceRecord, AttendanceStatus, AttendanceMethod
from sqlalchemy import text

async def main():
    print("🚀 Creating Sample Data via Direct SQL")
    print("=" * 45)
    
    async with AsyncSessionLocal() as session:
        try:
            # Check admin
            print("👨‍💼 Checking admin user...")
            result = await session.execute(text("SELECT id, email FROM users WHERE email = 'admin@attendance.com' LIMIT 1"))
            admin_row = result.fetchone()
            if not admin_row:
                print("❌ Admin user not found")
                return
            admin_id = admin_row[0]
            print(f"   ✅ Admin exists: {admin_row[1]} (ID: {admin_id})")
            
            # Get sample data
            print("📚 Getting existing data...")
            subjects_result = await session.execute(text("SELECT id, name FROM subjects LIMIT 2"))
            subjects = subjects_result.fetchall()
            
            students_result = await session.execute(text("SELECT id, student_id FROM students LIMIT 5"))
            students = students_result.fetchall()
            
            print(f"   ✅ Found {len(subjects)} subjects, {len(students)} students")
            
            if not subjects or not students:
                print("❌ No subjects or students found")
                return
            
            # Create attendance records using SQLAlchemy ORM (individual inserts)
            print("📊 Creating attendance records via SQLAlchemy ORM...")
            
            today = datetime.now().date()
            attendance_count = 0
            
            for days_ago in range(3):
                date = today - timedelta(days=days_ago)
                
                for subject in subjects:
                    for student in students:
                        if attendance_count >= 20:
                            break
                        
                        # Alternate between present and absent using enum values
                        status_value = AttendanceStatus.present if attendance_count % 2 == 0 else AttendanceStatus.absent
                        method_value = AttendanceMethod.manual
                        
                        # Create attendance record using ORM (individual insert)
                        attendance = AttendanceRecord(
                            student_id=student[0],
                            subject_id=subject[0],
                            date=date,
                            status=status_value,  # Use enum directly
                            method=method_value,  # Use enum directly
                            marked_by=admin_id,
                            created_at=datetime.now()
                        )
                        
                        session.add(attendance)
                        await session.commit()  # Commit each record individually
                        attendance_count += 1
                        
                        if attendance_count % 5 == 0:
                            print(f"   📝 Created {attendance_count} attendance records...")
                    
                    if attendance_count >= 20:
                        break
                
                if attendance_count >= 20:
                    break
            
            print(f"   ✅ Successfully created {attendance_count} attendance records!")
            
            # Verify the data
            print("\n🔍 Verifying created data...")
            verify_sql = text("""
                SELECT 
                    ar.id, s.student_id, sub.name as subject_name, 
                    ar.date, ar.status, ar.method
                FROM attendance_records ar
                JOIN students s ON ar.student_id = s.id
                JOIN subjects sub ON ar.subject_id = sub.id
                WHERE ar.marked_by = :admin_id
                ORDER BY ar.created_at DESC
                LIMIT 5
            """)
            
            verification = await session.execute(verify_sql, {'admin_id': admin_id})
            records = verification.fetchall()
            
            if records:
                print("   ✅ Sample attendance records:")
                for record in records:
                    print(f"     • {record[1]} - {record[2]} - {record[3]} - {record[4]}")
            
            print("\n🎉 Sample data creation completed successfully!")
            print("\nYou can now test the admin workflow with:")
            print("• Admin login: admin@attendance.com")
            print("• View attendance records in the dashboard")
            print("• Manage student attendance")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await session.rollback()
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
