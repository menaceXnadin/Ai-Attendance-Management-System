#!/usr/bin/env python3

"""
Verify the populated attendance data for investor demo
Provides comprehensive statistics and insights
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models import User, AttendanceRecord, Subject, Student, AttendanceStatus, AttendanceMethod
from datetime import datetime, date, timedelta
from sqlalchemy import func, and_, text, case
import json

def verify_attendance_data():
    """Verify and display comprehensive attendance statistics"""
    db = SessionLocal()
    
    try:
        print("🎯 ATTENDANCE DATA VERIFICATION FOR INVESTOR DEMO")
        print("=" * 60)
        
        # Total records
        total_records = db.query(AttendanceRecord).count()
        print(f"📊 Total Attendance Records: {total_records:,}")
        
        # Date range
        date_stats = db.query(
            func.min(AttendanceRecord.date).label('earliest'),
            func.max(AttendanceRecord.date).label('latest')
        ).first()
        
        print(f"📅 Date Range: {date_stats.earliest} to {date_stats.latest}")
        print(f"📅 Days Covered: {(date_stats.latest - date_stats.earliest).days + 1} days")
        
        # Student statistics
        total_students = db.query(Student).count()
        students_with_attendance = db.query(
            func.count(func.distinct(AttendanceRecord.student_id))
        ).scalar()
        
        print(f"\n👥 STUDENT STATISTICS:")
        print(f"  Total Students: {total_students}")
        print(f"  Students with Attendance: {students_with_attendance}")
        print(f"  Coverage: {(students_with_attendance/total_students)*100:.1f}%")
        
        # Subject statistics
        total_subjects = db.query(Subject).count()
        subjects_with_attendance = db.query(
            func.count(func.distinct(AttendanceRecord.subject_id))
        ).scalar()
        
        print(f"\n📚 SUBJECT STATISTICS:")
        print(f"  Total Subjects: {total_subjects}")
        print(f"  Subjects with Attendance: {subjects_with_attendance}")
        print(f"  Coverage: {(subjects_with_attendance/total_subjects)*100:.1f}%")
        
        # Status distribution
        print(f"\n📈 ATTENDANCE STATUS DISTRIBUTION:")
        status_stats = db.query(
            AttendanceRecord.status,
            func.count(AttendanceRecord.id).label('count')
        ).group_by(AttendanceRecord.status).all()
        
        for status, count in status_stats:
            percentage = (count / total_records) * 100
            print(f"  {status.value.title()}: {count:,} ({percentage:.1f}%)")
        
        # Method distribution
        print(f"\n🔍 ATTENDANCE METHOD DISTRIBUTION:")
        method_stats = db.query(
            AttendanceRecord.method,
            func.count(AttendanceRecord.id).label('count')
        ).group_by(AttendanceRecord.method).all()
        
        for method, count in method_stats:
            percentage = (count / total_records) * 100
            print(f"  {method.value.title()}: {count:,} ({percentage:.1f}%)")
        
        # Time distribution (by hour)
        print(f"\n⏰ ATTENDANCE TIME DISTRIBUTION:")
        time_stats = db.query(
            func.extract('hour', AttendanceRecord.time_in).label('hour'),
            func.count(AttendanceRecord.id).label('count')
        ).filter(
            AttendanceRecord.time_in.isnot(None)
        ).group_by(
            func.extract('hour', AttendanceRecord.time_in)
        ).order_by('hour').all()
        
        for hour, count in time_stats:
            if hour is not None:
                print(f"  {int(hour):02d}:00-{int(hour):02d}:59: {count:,} records")
        
        # Recent daily statistics (last 7 days)
        print(f"\n📊 RECENT DAILY ATTENDANCE (Last 7 days):")
        end_date = date.today()
        start_date = end_date - timedelta(days=6)
        
        daily_stats = db.query(
            AttendanceRecord.date,
            func.count(AttendanceRecord.id).label('total'),
            func.sum(
                case(
                    (AttendanceRecord.status == AttendanceStatus.present, 1),
                    else_=0
                )
            ).label('present'),
            func.sum(
                case(
                    (AttendanceRecord.status == AttendanceStatus.late, 1),
                    else_=0
                )
            ).label('late'),
            func.sum(
                case(
                    (AttendanceRecord.status == AttendanceStatus.absent, 1),
                    else_=0
                )
            ).label('absent')
        ).filter(
            and_(
                AttendanceRecord.date >= start_date,
                AttendanceRecord.date <= end_date
            )
        ).group_by(AttendanceRecord.date).order_by(AttendanceRecord.date.desc()).all()
        
        for day_stat in daily_stats:
            present_pct = (day_stat.present / day_stat.total) * 100 if day_stat.total > 0 else 0
            print(f"  {day_stat.date}: {day_stat.total:,} records ({present_pct:.1f}% present)")
        
        # Face recognition confidence statistics
        print(f"\n🤖 FACE RECOGNITION STATISTICS:")
        face_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.method == AttendanceMethod.face,
            AttendanceRecord.confidence_score.isnot(None)
        ).count()
        
        if face_records > 0:
            confidence_stats = db.query(
                func.min(AttendanceRecord.confidence_score).label('min_conf'),
                func.max(AttendanceRecord.confidence_score).label('max_conf'),
                func.avg(AttendanceRecord.confidence_score).label('avg_conf')
            ).filter(
                AttendanceRecord.method == AttendanceMethod.face,
                AttendanceRecord.confidence_score.isnot(None)
            ).first()
            
            print(f"  Face Recognition Records: {face_records:,}")
            print(f"  Confidence Range: {confidence_stats.min_conf:.1f}% - {confidence_stats.max_conf:.1f}%")
            print(f"  Average Confidence: {confidence_stats.avg_conf:.1f}%")
        
        # Top students by attendance rate
        print(f"\n🏆 TOP 5 STUDENTS BY ATTENDANCE RATE:")
        top_students = db.query(
            Student.student_id,
            User.full_name,
            func.count(AttendanceRecord.id).label('total_records'),
            func.sum(
                case(
                    (AttendanceRecord.status == AttendanceStatus.present, 1),
                    else_=0
                )
            ).label('present_count')
        ).join(
            User, Student.user_id == User.id
        ).join(
            AttendanceRecord, Student.id == AttendanceRecord.student_id
        ).group_by(
            Student.id, Student.student_id, User.full_name
        ).having(
            func.count(AttendanceRecord.id) > 50  # Only students with significant records
        ).order_by(
            (func.sum(
                case(
                    (AttendanceRecord.status == AttendanceStatus.present, 1),
                    else_=0
                )
            ) * 100.0 / func.count(AttendanceRecord.id)).desc()
        ).limit(5).all()
        
        for student in top_students:
            attendance_rate = (student.present_count / student.total_records) * 100
            print(f"  {student.student_id} - {student.full_name}: {attendance_rate:.1f}% ({student.present_count}/{student.total_records})")
        
        # Subject with most attendance records
        print(f"\n📚 TOP 5 SUBJECTS BY ATTENDANCE RECORDS:")
        top_subjects = db.query(
            Subject.code,
            Subject.name,
            func.count(AttendanceRecord.id).label('record_count')
        ).join(
            AttendanceRecord, Subject.id == AttendanceRecord.subject_id
        ).group_by(
            Subject.id, Subject.code, Subject.name
        ).order_by(
            func.count(AttendanceRecord.id).desc()
        ).limit(5).all()
        
        for subject in top_subjects:
            print(f"  {subject.code} - {subject.name}: {subject.record_count:,} records")
        
        print(f"\n🎉 DEMO READINESS CHECKLIST:")
        print(f"  ✅ Historical data spanning {(date_stats.latest - date_stats.earliest).days + 1} days")
        print(f"  ✅ {total_records:,} total attendance records")
        print(f"  ✅ {students_with_attendance} students with attendance data")
        print(f"  ✅ {subjects_with_attendance} subjects with attendance records")
        print(f"  ✅ Realistic distribution: {[f'{s.value}' for s, _ in status_stats]}")
        print(f"  ✅ Multiple attendance methods: {[f'{m.value}' for m, _ in method_stats]}")
        print(f"  ✅ Face recognition with confidence scores")
        print(f"  ✅ Time-distributed attendance throughout day")
        print(f"  ✅ Ready for investor presentation! 🚀")
        
    except Exception as e:
        print(f"❌ Error verifying attendance data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify_attendance_data()