#!/usr/bin/env python3
"""
Single-record insertion sample data creator
Avoids bulk insert enum issues by inserting records one by one
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
    print("🚀 Creating Sample Data with Single Record Insertion")
    print("=" * 55)
    
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
            
            students_result = await session.execute(text("SELECT id, student_id FROM students LIMIT 3"))
            students = students_result.fetchall()
            
            print(f"   ✅ Found {len(subjects)} subjects, {len(students)} students")
            
            if not subjects or not students:
                print("❌ No subjects or students found")
                return
            
            # Create attendance records one by one
            print("📊 Creating attendance records (one by one)...")
            
            today = datetime.now().date()
            attendance_count = 0
            
            for days_ago in range(2):  # Just 2 days to keep it simple
                date = today - timedelta(days=days_ago)
                
                for subject in subjects:
                    for student in students:
                        if attendance_count >= 10:  # Limited to 10 records
                            break
                        
                        # Alternate between present and absent using enum values directly
                        status_value = AttendanceStatus.present if attendance_count % 2 == 0 else AttendanceStatus.absent
                        method_value = AttendanceMethod.manual
                        
                        print(f"   Creating record {attendance_count + 1}: Student {student[1]}, Subject {subject[1]}, Status: {status_value.value}")
                        
                        # Create attendance record using ORM (one at a time)
                        attendance = AttendanceRecord(
                            student_id=student[0],
                            subject_id=subject[0],
                            date=date,
                            status=status_value,
                            method=method_value,
                            marked_by=admin_id,
                            created_at=datetime.now()
                        )
                        
                        session.add(attendance)
                        
                        # Commit immediately for each record
                        try:
                            await session.commit()
                            attendance_count += 1
                            print(f"   ✅ Record {attendance_count} created successfully")
                        except Exception as e:
                            print(f"   ❌ Failed to create record {attendance_count + 1}: {e}")
                            await session.rollback()
                            break
                    
                    if attendance_count >= 10:
                        break
                
                if attendance_count >= 10:
                    break
            
            print(f"\n   🎉 Successfully created {attendance_count} attendance records!")
            
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
                print("   ✅ Latest attendance records:")
                for record in records:
                    print(f"     • {record[1]} - {record[2]} - {record[3]} - {record[4]} - {record[5]}")
            
            print("\n🎉 Sample data creation completed successfully!")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await session.rollback()
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
