#!/usr/bin/env python3

"""
Quick test to add more historical attendance data with better coverage
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models import AttendanceRecord, Student, Subject, AttendanceStatus, AttendanceMethod
from datetime import datetime, date, timedelta
import random

def add_more_demo_data():
    """Add more attendance records for better coverage"""
    db = SessionLocal()
    
    try:
        print("🎯 Adding more demo attendance data...")
        
        # Get all students and subjects
        all_students = db.query(Student).all()[:50]  # Use first 50 students
        all_subjects = db.query(Subject).all()[:30]  # Use first 30 subjects
        
        # Create attendance for last 2 weeks for better demo
        end_date = date.today()
        start_date = end_date - timedelta(days=14)
        
        added_count = 0
        current_date = start_date
        
        while current_date <= end_date:
            # Skip weekends
            if current_date.weekday() < 5:  # Monday=0, Friday=4
                
                # Add attendance for random students and subjects each day
                daily_students = random.sample(all_students, min(len(all_students), random.randint(20, 35)))
                daily_subjects = random.sample(all_subjects, min(len(all_subjects), random.randint(5, 12)))
                
                for student in daily_students:
                    for subject in daily_subjects:
                        # Skip if record already exists
                        existing = db.query(AttendanceRecord).filter(
                            AttendanceRecord.student_id == student.id,
                            AttendanceRecord.subject_id == subject.id,
                            AttendanceRecord.date == current_date
                        ).first()
                        
                        if existing:
                            continue
                        
                        # 70% chance of having attendance record
                        if random.random() < 0.7:
                            # Generate realistic attendance
                            status_rand = random.random()
                            if status_rand < 0.85:
                                status = AttendanceStatus.present
                                time_in = datetime.combine(current_date, datetime.min.time().replace(
                                    hour=random.randint(8, 16), 
                                    minute=random.randint(0, 59)
                                ))
                            elif status_rand < 0.95:
                                status = AttendanceStatus.late
                                time_in = datetime.combine(current_date, datetime.min.time().replace(
                                    hour=random.randint(8, 17), 
                                    minute=random.randint(15, 59)
                                ))
                            else:
                                status = AttendanceStatus.absent
                                time_in = None
                            
                            # Choose method
                            method_rand = random.random()
                            if method_rand < 0.6:
                                method = AttendanceMethod.face
                                confidence = random.uniform(65, 95) if time_in else None
                                location = "Main Campus" if time_in else None
                            else:
                                method = random.choice([AttendanceMethod.manual, AttendanceMethod.other])
                                confidence = None
                                location = None
                            
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
                            added_count += 1
                            
                            # Commit in batches
                            if added_count % 50 == 0:
                                db.commit()
                                print(f"  ✅ Added {added_count} records...")
            
            current_date += timedelta(days=1)
        
        # Final commit
        db.commit()
        print(f"🎉 Successfully added {added_count} additional attendance records!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_more_demo_data()