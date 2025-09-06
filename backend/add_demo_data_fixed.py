#!/usr/bin/env python3
"""
Fixed Demo Data Generator for Attendance Records
Generates additional realistic attendance data for investor demo
"""

import os
import sys
from datetime import datetime, date, time, timedelta
import random

# Add parent directory to path to import models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models import User, AttendanceRecord, Subject, Student, AttendanceStatus, AttendanceMethod

# Database configuration - not needed, using SessionLocal
# DATABASE_URL = "postgresql://postgres:password@localhost:5432/attendance_db"

def get_attendance_pattern(student_id):
    """Get attendance pattern based on student ID for consistency"""
    patterns = {
        'excellent': 0.95,    # 95% attendance
        'good': 0.85,         # 85% attendance  
        'average': 0.75,      # 75% attendance
        'poor': 0.60,         # 60% attendance
        'irregular': 0.45     # 45% attendance
    }
    
    # Distribute students across patterns
    pattern_keys = list(patterns.keys())
    pattern_index = student_id % len(pattern_keys)
    pattern_name = pattern_keys[pattern_index]
    return patterns[pattern_name]

def generate_realistic_time(base_hour, base_minute, variance_minutes=15):
    """Generate realistic class attendance time with some variance"""
    # Add random variance
    total_minutes = base_hour * 60 + base_minute
    variance = random.randint(-variance_minutes, variance_minutes)
    total_minutes += variance
    
    # Ensure we don't go negative or beyond 24 hours
    total_minutes = max(0, min(total_minutes, 23 * 60 + 59))
    
    hour = total_minutes // 60
    minute = total_minutes % 60
    return hour, minute

def get_face_confidence():
    """Generate realistic face recognition confidence score"""
    # Face recognition typically has confidence between 60-95%
    return round(random.uniform(60.0, 95.0), 2)

def create_additional_demo_data():
    """Create additional demo attendance data"""
    db = SessionLocal()
    
    try:
        print("🚀 Starting additional demo data generation...")
        
        # Get available students and subjects
        students = db.query(Student).limit(50).all()
        subjects = db.query(Subject).limit(30).all()
        
        print(f"📊 Found {len(students)} students and {len(subjects)} subjects")
        
        # Generate data for last 14 days
        end_date = date.today()
        start_date = end_date - timedelta(days=14)
        
        records_created = 0
        
        # Generate attendance for each day
        current_date = start_date
        while current_date <= end_date:
            # Skip weekends for more realistic data
            if current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                current_date += timedelta(days=1)
                continue
                
            print(f"📅 Generating data for {current_date}")
            
            # Select random subjects for the day (3-5 subjects per day)
            daily_subjects = random.sample(subjects, k=random.randint(3, 5))
            
            for subject in daily_subjects:
                # Generate typical class times
                class_times = [
                    (8, 0),   # 8:00 AM
                    (10, 0),  # 10:00 AM  
                    (12, 0),  # 12:00 PM
                    (14, 0),  # 2:00 PM
                    (16, 0),  # 4:00 PM
                ]
                
                class_hour, class_minute = random.choice(class_times)
                
                # Select students for this class (70% probability of each student having this subject)
                class_students = [s for s in students if random.random() < 0.7]
                
                for student in class_students:
                    # Check if record already exists
                    existing = db.query(AttendanceRecord).filter_by(
                        student_id=student.id,
                        subject_id=subject.id,
                        date=current_date
                    ).first()
                    
                    if existing:
                        continue  # Skip if already exists
                    
                    # Determine attendance based on student pattern
                    attendance_prob = get_attendance_pattern(student.id)
                    will_attend = random.random() < attendance_prob
                    
                    if will_attend:
                        # Student will attend - determine if on time or late
                        is_late = random.random() < 0.05  # 5% chance of being late
                        
                        if is_late:
                            # Late arrival (10-30 minutes after class start)
                            late_minutes = random.randint(10, 30)
                            actual_hour, actual_minute = generate_realistic_time(
                                class_hour, class_minute + late_minutes
                            )
                            status = AttendanceStatus.late
                        else:
                            # On time or early arrival
                            actual_hour, actual_minute = generate_realistic_time(
                                class_hour, class_minute, variance_minutes=10
                            )
                            status = AttendanceStatus.present
                        
                        # Determine attendance method
                        method_choice = random.random()
                        if method_choice < 0.75:  # 75% face recognition
                            method = AttendanceMethod.face
                            confidence = get_face_confidence()
                            location = "Main Campus"
                        elif method_choice < 0.90:  # 15% manual
                            method = AttendanceMethod.manual
                            confidence = None
                            location = None
                        else:  # 10% other
                            method = AttendanceMethod.other
                            confidence = None
                            location = None
                        
                        time_in = datetime.combine(current_date, time(actual_hour, actual_minute))
                        
                    else:
                        # Student is absent
                        status = AttendanceStatus.absent
                        method = AttendanceMethod.other
                        time_in = None
                        confidence = None
                        location = None
                    
                    # Create attendance record using individual insert
                    record = AttendanceRecord(
                        student_id=student.id,
                        subject_id=subject.id,
                        date=current_date,
                        time_in=time_in,
                        status=status,
                        method=method,
                        confidence_score=confidence,
                        location=location
                    )
                    
                    db.add(record)
                    records_created += 1
                    
                    # Commit after each record to avoid enum batching issues
                    if records_created % 1 == 0:
                        db.commit()
                        if records_created % 50 == 0:
                            print(f"💾 Saved batch, total records created: {records_created}")
            
            current_date += timedelta(days=1)
        
        # Final commit
        db.commit()
        
        print(f"✅ Demo data generation complete!")
        print(f"📈 Total attendance records created: {records_created}")
        
        # Verify the data
        total_records = db.query(AttendanceRecord).count()
        total_students = db.query(Student).count()
        total_subjects = db.query(Subject).count()
        
        print(f"\n📊 Final Statistics:")
        print(f"   Total attendance records: {total_records}")
        print(f"   Total students: {total_students}")
        print(f"   Total subjects: {total_subjects}")
        
        # Show attendance status distribution
        status_counts = {}
        for status in AttendanceStatus:
            count = db.query(AttendanceRecord).filter_by(status=status).count()
            status_counts[status.value] = count
        
        print(f"\n📈 Attendance Status Distribution:")
        for status, count in status_counts.items():
            percentage = (count / total_records * 100) if total_records > 0 else 0
            print(f"   {status.title()}: {count} ({percentage:.1f}%)")
        
        # Show method distribution
        method_counts = {}
        for method in AttendanceMethod:
            count = db.query(AttendanceRecord).filter_by(method=method).count()
            method_counts[method.value] = count
        
        print(f"\n🔧 Attendance Method Distribution:")
        for method, count in method_counts.items():
            percentage = (count / total_records * 100) if total_records > 0 else 0
            print(f"   {method.title()}: {count} ({percentage:.1f}%)")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during demo data generation: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_additional_demo_data()