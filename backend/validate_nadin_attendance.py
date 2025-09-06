#!/usr/bin/env python3

import sys
import os

# Add the backend directory to the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app.database import get_db
from app.models import User, Student, AttendanceRecord, AttendanceStatus
from datetime import datetime

def validate_nadin_attendance():
    """Validate the actual attendance records for nadin@gmail.com"""
    print("🔍 VALIDATING NADIN'S ATTENDANCE RECORDS")
    print("=" * 60)
    
    # Get database session
    db = next(get_db())
    
    try:
        # Find the user
        user = db.query(User).filter(User.email == "nadin@gmail.com").first()
        if not user:
            print("❌ User nadin@gmail.com not found")
            return
            
        # Find the student
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if not student:
            print("❌ Student record not found for nadin@gmail.com")
            return
            
        print(f"✅ Found student: {user.full_name}")
        print(f"   Email: {user.email}")
        print(f"   Student ID: {student.student_id}")
        print(f"   Faculty: {student.faculty}")
        print(f"   Semester: {student.semester}")
        print(f"   User ID: {user.id}, Student ID: {student.id}")
        
        # Get ALL attendance records for this student
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student.id
        ).order_by(AttendanceRecord.date).all()
        
        print(f"\n📊 ATTENDANCE RECORDS ANALYSIS")
        print(f"   Total Records Found: {len(records)}")
        
        if len(records) == 0:
            print("   ❌ NO ATTENDANCE RECORDS FOUND!")
            print("   This suggests the student has never attended class.")
            return
            
        # Count by status
        status_counts = {}
        date_range = []
        
        for record in records:
            status = record.status
            status_counts[status] = status_counts.get(status, 0) + 1
            date_range.append(record.date)
        
        print(f"\n📅 DATE RANGE:")
        if date_range:
            print(f"   Earliest: {min(date_range)}")
            print(f"   Latest: {max(date_range)}")
        
        print(f"\n📈 STATUS BREAKDOWN:")
        for status, count in status_counts.items():
            print(f"   {status}: {count}")
        
        print(f"\n📝 DETAILED RECORDS (showing all {len(records)}):")
        for i, record in enumerate(records, 1):
            print(f"   {i:2d}. {record.date} | {record.status} | Subject: {record.subject_id} | Method: {record.method} | Confidence: {record.confidence_score}")
        
        # Check if these records are realistic
        print(f"\n🤔 REALITY CHECK:")
        
        # Check date patterns
        unique_dates = set(record.date.date() if hasattr(record.date, 'date') else record.date for record in records)
        print(f"   Unique dates: {len(unique_dates)}")
        
        # Check if all records are on the same few dates
        if len(unique_dates) < 5 and len(records) > 10:
            print("   ⚠️  WARNING: Many records on very few dates - suspicious pattern!")
        
        # Check for consecutive days
        dates_only = sorted(unique_dates)
        print(f"   Date spread: {dates_only[0] if dates_only else 'None'} to {dates_only[-1] if dates_only else 'None'}")
        
        # Check if records were bulk-created
        created_times = [record.created_at for record in records if record.created_at]
        if created_times:
            unique_created_times = set(created_times)
            print(f"   Created at {len(unique_created_times)} different times")
            if len(unique_created_times) == 1:
                print("   ⚠️  WARNING: All records created at the same time - likely bulk insert!")
        
        # Check subjects
        subject_ids = set(record.subject_id for record in records if record.subject_id)
        print(f"   Subjects involved: {len(subject_ids)} different subjects")
        
        # Final assessment
        print(f"\n🎯 ASSESSMENT:")
        if len(records) == 19:
            print("   ✅ Confirmed: 19 attendance records exist")
            if len(unique_dates) < 5:
                print("   🚨 SUSPICIOUS: Records concentrated on very few dates")
            if len(unique_dates) >= 15:
                print("   ✅ REALISTIC: Records spread across multiple dates")
            else:
                print("   🤷 UNCLEAR: Need manual review of data quality")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    validate_nadin_attendance()