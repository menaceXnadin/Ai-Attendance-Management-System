#!/usr/bin/env python3
"""
Populate attendance records specifically for nadin@gmail.com for calendar testing
Creates comprehensive historical data to verify calendar display functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models import User, Student, Subject, AttendanceRecord, AttendanceStatus, AttendanceMethod
from datetime import datetime, date, timedelta
import random

def populate_nadin_attendance():
    """Populate comprehensive attendance data for nadin@gmail.com"""
    db = SessionLocal()
    
    try:
        print("📚 POPULATING ATTENDANCE FOR NADIN@GMAIL.COM")
        print("=" * 60)
        
        # Find Nadin's user and student records
        nadin_user = db.query(User).filter(User.email == "nadin@gmail.com").first()
        if not nadin_user:
            print("❌ User nadin@gmail.com not found!")
            return
        
        nadin_student = db.query(Student).filter(Student.user_id == nadin_user.id).first()
        if not nadin_student:
            print("❌ Student record for nadin@gmail.com not found!")
            return
        
        print(f"✅ Found student: {nadin_user.full_name} ({nadin_student.student_id})")
        
        # Get available subjects
        subjects = db.query(Subject).limit(10).all()  # Get 10 subjects for variety
        if not subjects:
            print("❌ No subjects found!")
            return
        
        print(f"✅ Found {len(subjects)} subjects for attendance")
        
        # Clear existing attendance for Nadin to avoid duplicates
        existing_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == nadin_student.id
        ).count()
        
        if existing_count > 0:
            print(f"🧹 Clearing {existing_count} existing attendance records for Nadin...")
            db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == nadin_student.id
            ).delete()
            db.commit()
        
        # Generate attendance for the last 30 days
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        
        print(f"📅 Generating attendance from {start_date} to {end_date}")
        
        created_records = 0
        
        # Create attendance pattern for each day
        current_date = start_date
        while current_date <= end_date:
            # Skip weekends for realistic pattern
            if current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                current_date += timedelta(days=1)
                continue
            
            # Determine how many classes Nadin has on this day (2-5 classes)
            daily_classes = random.randint(2, 5)
            selected_subjects = random.sample(subjects, min(daily_classes, len(subjects)))
            
            # Create realistic attendance pattern for the day
            # Nadin has generally good attendance (75% chance of being present)
            day_performance = random.random()
            
            for i, subject in enumerate(selected_subjects):
                # Create time slots throughout the day
                hour = 9 + (i * 2)  # Classes at 9, 11, 13, 15, 17
                time_in = datetime.combine(current_date, datetime.min.time().replace(hour=hour))
                
                # Determine status based on day performance and subject
                if day_performance > 0.8:  # Great day - mostly present
                    status = AttendanceStatus.present if random.random() > 0.1 else AttendanceStatus.late
                elif day_performance > 0.5:  # Normal day - mixed attendance
                    status_choice = random.random()
                    if status_choice > 0.7:
                        status = AttendanceStatus.present
                    elif status_choice > 0.2:
                        status = AttendanceStatus.absent
                    else:
                        status = AttendanceStatus.late
                else:  # Difficult day - mostly absent
                    status = AttendanceStatus.absent if random.random() > 0.3 else AttendanceStatus.present
                
                # Determine method and confidence
                method_choice = random.random()
                if method_choice > 0.6:
                    method = AttendanceMethod.face
                    confidence_score = random.uniform(70.0, 95.0) if status == AttendanceStatus.present else None
                elif method_choice > 0.3:
                    method = AttendanceMethod.manual
                    confidence_score = None
                else:
                    method = AttendanceMethod.other
                    confidence_score = None
                
                # Create attendance record
                attendance_record = AttendanceRecord(
                    student_id=nadin_student.id,
                    subject_id=subject.id,
                    date=current_date,
                    time_in=time_in,
                    status=status,
                    method=method,
                    confidence_score=confidence_score,
                    location="Main Campus",
                    notes=f"Demo attendance for {current_date}"
                )
                
                db.add(attendance_record)
                created_records += 1
                
                # Commit every 10 records to avoid memory issues
                if created_records % 10 == 0:
                    db.commit()
                    print(f"📝 Created {created_records} records...")
            
            current_date += timedelta(days=1)
        
        # Final commit
        db.commit()
        
        print(f"\n✅ ATTENDANCE POPULATION COMPLETE!")
        print("-" * 40)
        print(f"📊 Total records created: {created_records}")
        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"👤 Student: {nadin_user.full_name} ({nadin_student.student_id})")
        
        # Verify the data
        print(f"\n🔍 VERIFICATION:")
        print("-" * 20)
        
        # Count by status
        present_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == nadin_student.id,
            AttendanceRecord.status == AttendanceStatus.present
        ).count()
        
        absent_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == nadin_student.id,
            AttendanceRecord.status == AttendanceStatus.absent
        ).count()
        
        late_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == nadin_student.id,
            AttendanceRecord.status == AttendanceStatus.late
        ).count()
        
        total = present_count + absent_count + late_count
        attendance_rate = (present_count / total * 100) if total > 0 else 0
        
        print(f"✅ Present: {present_count} ({present_count/total*100:.1f}%)")
        print(f"❌ Absent: {absent_count} ({absent_count/total*100:.1f}%)")
        print(f"⏰ Late: {late_count} ({late_count/total*100:.1f}%)")
        print(f"📊 Overall Attendance Rate: {attendance_rate:.1f}%")
        
        # Count by method
        face_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == nadin_student.id,
            AttendanceRecord.method == AttendanceMethod.face
        ).count()
        
        manual_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == nadin_student.id,
            AttendanceRecord.method == AttendanceMethod.manual
        ).count()
        
        other_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == nadin_student.id,
            AttendanceRecord.method == AttendanceMethod.other
        ).count()
        
        print(f"\n🤖 Face Recognition: {face_count} ({face_count/total*100:.1f}%)")
        print(f"✋ Manual: {manual_count} ({manual_count/total*100:.1f}%)")
        print(f"🔧 Other: {other_count} ({other_count/total*100:.1f}%)")
        
        # Show recent days for calendar testing
        print(f"\n📅 RECENT DAYS FOR CALENDAR TESTING:")
        print("-" * 40)
        
        from sqlalchemy import func, text
        recent_days = db.execute(text("""
            SELECT 
                DATE(ar.date) as day,
                COUNT(*) as total_classes,
                SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late
            FROM attendance_records ar
            WHERE ar.student_id = :student_id
            AND ar.date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(ar.date)
            ORDER BY day DESC
        """), {"student_id": nadin_student.id}).fetchall()
        
        for day in recent_days:
            day_total = day.total_classes
            day_present = day.present
            day_absent = day.absent
            day_late = day.late
            day_rate = (day_present / day_total * 100) if day_total > 0 else 0
            
            status_emoji = "🟢" if day_rate >= 80 else "🟡" if day_rate >= 60 else "🔴"
            print(f"{status_emoji} {day.day}: {day_total} classes - {day_present}P {day_absent}A {day_late}L ({day_rate:.1f}%)")
        
        print(f"\n🎯 CALENDAR TESTING READY!")
        print("=" * 30)
        print("✅ Login as nadin@gmail.com")
        print("✅ Navigate to Student Dashboard")
        print("✅ Check 'My Attendance' calendar view")
        print("✅ Verify color-coded days are showing")
        print("✅ Test month navigation")
        print("✅ Hover over days to see attendance details")
        print("\n🚀 Calendar should now display rich attendance data!")
        
    except Exception as e:
        print(f"❌ Error populating Nadin's attendance: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    populate_nadin_attendance()