#!/usr/bin/env python3

"""
Populate attendance records with realistic dummy data for investor demo
Creates comprehensive historical attendance patterns for all students
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models import User, AttendanceRecord, Subject, Student, AttendanceStatus, AttendanceMethod
from datetime import datetime, date, timedelta
import random
from typing import List, Dict
import json

def get_all_students_and_subjects(db):
    """Get all students and subjects from database"""
    students = db.query(Student).join(User).all()
    subjects = db.query(Subject).all()
    
    print(f"📊 Found {len(students)} students and {len(subjects)} subjects")
    
    # Display students
    print("\n👥 Students:")
    for student in students:
        print(f"  - {student.user.full_name} ({student.student_id}) - Batch: {student.batch}, Semester: {student.semester}")
    
    # Display subjects  
    print("\n📚 Subjects:")
    for subject in subjects:
        print(f"  - {subject.name} ({subject.code})")
    
    return students, subjects

def generate_realistic_attendance_patterns():
    """Generate realistic attendance patterns for different student types"""
    patterns = {
        'excellent': {
            'present_prob': 0.95,  # 95% attendance rate
            'late_prob': 0.03,     # 3% late rate  
            'absent_prob': 0.02,   # 2% absent rate
            'face_method_prob': 0.85,  # 85% face recognition
            'min_confidence': 80,
            'max_confidence': 95
        },
        'good': {
            'present_prob': 0.85,  # 85% attendance rate
            'late_prob': 0.08,     # 8% late rate
            'absent_prob': 0.07,   # 7% absent rate
            'face_method_prob': 0.80,  # 80% face recognition
            'min_confidence': 75,
            'max_confidence': 90
        },
        'average': {
            'present_prob': 0.75,  # 75% attendance rate
            'late_prob': 0.10,     # 10% late rate
            'absent_prob': 0.15,   # 15% absent rate
            'face_method_prob': 0.70,  # 70% face recognition
            'min_confidence': 70,
            'max_confidence': 85
        },
        'poor': {
            'present_prob': 0.60,  # 60% attendance rate
            'late_prob': 0.15,     # 15% late rate
            'absent_prob': 0.25,   # 25% absent rate
            'face_method_prob': 0.60,  # 60% face recognition
            'min_confidence': 65,
            'max_confidence': 80
        },
        'irregular': {
            'present_prob': 0.50,  # 50% attendance rate
            'late_prob': 0.20,     # 20% late rate
            'absent_prob': 0.30,   # 30% absent rate
            'face_method_prob': 0.50,  # 50% face recognition
            'min_confidence': 60,
            'max_confidence': 75
        }
    }
    return patterns

def assign_student_patterns(students: List[Student]) -> Dict[int, str]:
    """Assign attendance patterns to students"""
    patterns = ['excellent', 'good', 'average', 'poor', 'irregular']
    
    # Distribute patterns realistically
    distribution = {
        'excellent': 0.15,  # 15% excellent students
        'good': 0.35,       # 35% good students  
        'average': 0.30,    # 30% average students
        'poor': 0.15,       # 15% poor students
        'irregular': 0.05   # 5% irregular students
    }
    
    student_patterns = {}
    
    for i, student in enumerate(students):
        # Use student ID as seed for consistent patterns
        random.seed(student.id * 123)
        
        # Distribute based on percentages
        rand = random.random()
        cumulative = 0
        
        for pattern, prob in distribution.items():
            cumulative += prob
            if rand <= cumulative:
                student_patterns[student.id] = pattern
                break
        
        # Fallback to average if nothing assigned
        if student.id not in student_patterns:
            student_patterns[student.id] = 'average'
    
    return student_patterns

def generate_class_times():
    """Generate realistic class time slots"""
    time_slots = [
        (8, 0),   # 8:00 AM
        (9, 30),  # 9:30 AM
        (11, 0),  # 11:00 AM
        (12, 30), # 12:30 PM
        (14, 0),  # 2:00 PM
        (15, 30), # 3:30 PM
        (17, 0),  # 5:00 PM
    ]
    return time_slots

def get_date_range_for_demo():
    """Get date range for demo data (last 3 months)"""
    end_date = date.today()
    start_date = end_date - timedelta(days=90)  # 3 months back
    
    return start_date, end_date

def is_weekend(date_obj):
    """Check if date is weekend (Saturday=5, Sunday=6)"""
    return date_obj.weekday() >= 5

def is_holiday(date_obj):
    """Check if date is a likely holiday (simplified)"""
    # Add some random holidays for realism
    holidays = [
        # Add some festival dates (simplified)
        date(2025, 6, 15),  # Sample holiday
        date(2025, 7, 4),   # Sample holiday
        date(2025, 8, 15),  # Sample holiday
    ]
    
    return date_obj in holidays

def generate_attendance_for_date(student_id: int, subject_id: int, date_obj: date, 
                                 pattern: dict, time_slot: tuple, db) -> AttendanceRecord:
    """Generate a single attendance record"""
    
    # Skip weekends and holidays
    if is_weekend(date_obj) or is_holiday(date_obj):
        return None
    
    # Sometimes students miss entire days randomly
    if random.random() < 0.05:  # 5% chance of missing entire day
        return None
    
    # Determine attendance status based on pattern
    rand = random.random()
    
    if rand < pattern['present_prob']:
        status = AttendanceStatus.present
    elif rand < pattern['present_prob'] + pattern['late_prob']:
        status = AttendanceStatus.late
    else:
        status = AttendanceStatus.absent
    
    # Generate time_in if not absent
    time_in = None
    confidence_score = None
    method = AttendanceMethod.other
    
    if status != AttendanceStatus.absent:
        # Generate realistic time_in
        hour, minute = time_slot
        
        # Add some randomness for late arrivals
        if status == AttendanceStatus.late:
            # Late by 5-30 minutes
            minute += random.randint(5, 30)
            if minute >= 60:
                hour += 1
                minute -= 60
        else:
            # Normal arrival with small variation
            minute += random.randint(-5, 10)
            if minute < 0:
                minute = 0
            elif minute >= 60:
                hour += 1
                minute -= 60
        
        # Ensure hour is within valid range
        if hour >= 24:
            hour = 23
            minute = 59
        
        time_in = datetime.combine(date_obj, datetime.min.time().replace(hour=hour, minute=minute))
        
        # Determine method and confidence
        if random.random() < pattern['face_method_prob']:
            method = AttendanceMethod.face
            confidence_score = random.uniform(pattern['min_confidence'], pattern['max_confidence'])
        else:
            method = random.choice([AttendanceMethod.manual, AttendanceMethod.other])
    
    # Check if record already exists for this date, student, and subject
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.subject_id == subject_id,
        AttendanceRecord.date == date_obj
    ).first()
    
    if existing:
        return None  # Skip if already exists
    
    # Create attendance record
    record = AttendanceRecord(
        student_id=student_id,
        subject_id=subject_id,
        date=date_obj,
        time_in=time_in,
        status=status,
        method=method,
        confidence_score=confidence_score,
        location="Main Campus" if method == AttendanceMethod.face else None,
        notes=None
    )
    
    return record

def populate_attendance_data():
    """Main function to populate realistic attendance data"""
    db = SessionLocal()
    
    try:
        print("🎯 Starting attendance data population for investor demo...")
        
        # Get all students and subjects
        students, subjects = get_all_students_and_subjects(db)
        
        if not students or not subjects:
            print("❌ No students or subjects found. Please ensure data exists.")
            return
        
        # Get attendance patterns
        patterns = generate_realistic_attendance_patterns()
        student_patterns = assign_student_patterns(students)
        
        print("\n📊 Student attendance pattern distribution:")
        pattern_counts = {}
        for student_id, pattern in student_patterns.items():
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
        
        for pattern, count in pattern_counts.items():
            print(f"  {pattern.title()}: {count} students")
        
        # Get date range and class times
        start_date, end_date = get_date_range_for_demo()
        time_slots = generate_class_times()
        
        print(f"\n📅 Generating attendance from {start_date} to {end_date}")
        print(f"⏰ Using {len(time_slots)} daily time slots")
        
        # Track statistics
        total_records = 0
        records_by_status = {'present': 0, 'late': 0, 'absent': 0}
        records_by_method = {'face': 0, 'manual': 0, 'other': 0}
        
        # Generate attendance for each student-subject-date combination
        current_date = start_date
        batch_size = 100  # Reduced batch size to avoid enum issues
        records_batch = []
        
        while current_date <= end_date:
            # Skip weekends and holidays
            if not is_weekend(current_date) and not is_holiday(current_date):
                
                for student in students:
                    pattern_name = student_patterns[student.id]
                    pattern = patterns[pattern_name]
                    
                    # Each student attends multiple subjects per day
                    daily_subjects = random.sample(subjects, min(len(subjects), random.randint(3, 6)))
                    
                    for subject in daily_subjects:
                        time_slot = random.choice(time_slots)
                        
                        record = generate_attendance_for_date(
                            student.id, subject.id, current_date, 
                            pattern, time_slot, db
                        )
                        
                        if record:
                            # Add record one by one to avoid enum batch issues
                            db.add(record)
                            total_records += 1
                            
                            # Update statistics
                            records_by_status[record.status.value] += 1
                            records_by_method[record.method.value] += 1
                            
                            # Commit in batches for performance
                            if total_records % batch_size == 0:
                                try:
                                    db.commit()
                                    print(f"  ✅ Committed batch ending at record {total_records}")
                                except Exception as e:
                                    print(f"  ❌ Error in batch commit: {e}")
                                    db.rollback()
            
            current_date += timedelta(days=1)
        
        # Commit any remaining records
        try:
            db.commit()
            print(f"  ✅ Final commit completed")
        except Exception as e:
            print(f"  ❌ Error in final commit: {e}")
            db.rollback()
        
        print(f"\n🎉 Successfully populated {total_records} attendance records!")
        
        # Display statistics
        print("\n📈 Attendance Statistics:")
        print("  Status Distribution:")
        for status, count in records_by_status.items():
            percentage = (count / total_records) * 100 if total_records > 0 else 0
            print(f"    {status.title()}: {count} ({percentage:.1f}%)")
        
        print("  Method Distribution:")
        for method, count in records_by_method.items():
            percentage = (count / total_records) * 100 if total_records > 0 else 0
            print(f"    {method.title()}: {count} ({percentage:.1f}%)")
        
        # Generate some insights for demo
        print("\n💡 Demo Insights Generated:")
        print("  ✅ Students with varying attendance patterns")
        print("  ✅ Mix of face recognition and manual attendance")
        print("  ✅ Realistic late arrivals and absences")
        print("  ✅ Historical trends for analytics")
        print("  ✅ Ready for investor presentation!")
        
    except Exception as e:
        print(f"❌ Error populating attendance data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate_attendance_data()