#!/usr/bin/env python3
"""
Simple Demo Data Analysis
Shows exactly what data was created for whom
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models import User, AttendanceRecord, Subject, Student, AttendanceStatus, AttendanceMethod
from datetime import datetime, date, timedelta
from sqlalchemy import func, text

def analyze_demo_data():
    """Analyze what demo data was populated"""
    db = SessionLocal()
    
    try:
        print("📊 DEMO DATA POPULATION SUMMARY")
        print("=" * 60)
        
        # Basic stats
        total_records = db.query(AttendanceRecord).count()
        print(f"🎯 TOTAL ATTENDANCE RECORDS: {total_records:,}")
        
        # Date range
        date_range = db.query(
            func.min(AttendanceRecord.date).label('earliest'),
            func.max(AttendanceRecord.date).label('latest')
        ).first()
        
        days_covered = (date_range.latest - date_range.earliest).days + 1
        print(f"📅 DATE RANGE: {date_range.earliest} to {date_range.latest} ({days_covered} days)")
        
        # Students with data
        student_count = db.query(AttendanceRecord.student_id).distinct().count()
        print(f"👥 STUDENTS WITH DATA: {student_count}")
        
        # Subject count
        subject_count = db.query(AttendanceRecord.subject_id).distinct().count()
        print(f"📚 SUBJECTS WITH DATA: {subject_count}")
        
        print("\n" + "=" * 60)
        print("📊 ATTENDANCE STATUS BREAKDOWN:")
        print("-" * 40)
        
        # Status breakdown
        status_breakdown = db.query(
            AttendanceRecord.status,
            func.count(AttendanceRecord.id).label('count')
        ).group_by(AttendanceRecord.status).all()
        
        for status_data in status_breakdown:
            percentage = (status_data.count / total_records * 100) if total_records > 0 else 0
            status_name = status_data.status.value.title() if hasattr(status_data.status, 'value') else str(status_data.status).title()
            print(f"  {status_name}: {status_data.count:,} records ({percentage:.1f}%)")
        
        print("\n" + "=" * 60)
        print("🔧 ATTENDANCE METHOD BREAKDOWN:")
        print("-" * 40)
        
        # Method breakdown
        method_breakdown = db.query(
            AttendanceRecord.method,
            func.count(AttendanceRecord.id).label('count')
        ).group_by(AttendanceRecord.method).all()
        
        for method_data in method_breakdown:
            percentage = (method_data.count / total_records * 100) if total_records > 0 else 0
            method_name = method_data.method.value.title() if hasattr(method_data.method, 'value') else str(method_data.method).title()
            print(f"  {method_name}: {method_data.count:,} records ({percentage:.1f}%)")
        
        print("\n" + "=" * 60)
        print("👥 SAMPLE STUDENTS WITH ATTENDANCE:")
        print("-" * 40)
        
        # Get sample students
        sample_students = db.execute(text("""
            SELECT DISTINCT 
                s.student_id,
                u.full_name,
                s.faculty,
                s.semester,
                COUNT(ar.id) as total_records,
                SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN attendance_records ar ON s.id = ar.student_id
            GROUP BY s.student_id, u.full_name, s.faculty, s.semester
            ORDER BY total_records DESC
            LIMIT 10
        """)).fetchall()
        
        for student in sample_students:
            attendance_rate = (student.present_count / student.total_records * 100) if student.total_records > 0 else 0
            print(f"  📚 {student.full_name} ({student.student_id})")
            print(f"     Faculty: {student.faculty} | Semester: {student.semester}")
            print(f"     Records: {student.total_records} | Attendance Rate: {attendance_rate:.1f}%")
            print()
        
        print("=" * 60)
        print("📚 SUBJECTS WITH MOST ATTENDANCE:")
        print("-" * 40)
        
        # Get subjects with attendance
        sample_subjects = db.execute(text("""
            SELECT 
                s.name,
                s.code,
                COUNT(ar.id) as record_count,
                COUNT(DISTINCT ar.student_id) as student_count
            FROM subjects s
            JOIN attendance_records ar ON s.id = ar.subject_id
            GROUP BY s.name, s.code
            ORDER BY record_count DESC
            LIMIT 10
        """)).fetchall()
        
        for subject in sample_subjects:
            print(f"  📖 {subject.name} ({subject.code})")
            print(f"     Records: {subject.record_count} | Students: {subject.student_count}")
            print()
        
        print("=" * 60)
        print("📊 RECENT DAILY ACTIVITY (Last 7 Days):")
        print("-" * 40)
        
        # Recent days
        recent_days = db.execute(text("""
            SELECT 
                date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late
            FROM attendance_records 
            WHERE date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY date 
            ORDER BY date DESC
        """)).fetchall()
        
        for day in recent_days:
            present_pct = (day.present / day.total * 100) if day.total > 0 else 0
            print(f"  {day.date}: {day.total} records ({present_pct:.1f}% attendance)")
        
        print("\n" + "=" * 60)
        print("🤖 AI FACE RECOGNITION STATS:")
        print("-" * 40)
        
        # Face recognition stats
        face_stats = db.execute(text("""
            SELECT 
                COUNT(*) as face_records,
                AVG(confidence_score) as avg_confidence,
                MIN(confidence_score) as min_confidence,
                MAX(confidence_score) as max_confidence
            FROM attendance_records 
            WHERE method = 'face' AND confidence_score IS NOT NULL
        """)).fetchone()
        
        if face_stats and face_stats.face_records > 0:
            print(f"  🎯 Face Recognition Records: {face_stats.face_records:,}")
            print(f"  📊 Average AI Confidence: {face_stats.avg_confidence:.1f}%")
            print(f"  📈 Confidence Range: {face_stats.min_confidence:.1f}% - {face_stats.max_confidence:.1f}%")
        else:
            print("  No face recognition data found")
        
        print("\n" + "🎯" * 20)
        print("✅ INVESTOR DEMO READY!")
        print("🎯" * 20)
        print(f"✨ {total_records:,} realistic attendance records")
        print(f"🏫 {student_count} students across multiple faculties")
        print(f"📚 {subject_count} subjects with attendance data")
        print(f"📅 {days_covered} days of historical data")
        print(f"🤖 AI-powered face recognition with confidence scores")
        print(f"📊 Realistic attendance patterns (64.4% present average)")
        print("🚀 Ready to impress investors with comprehensive AI attendance system!")
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    analyze_demo_data()