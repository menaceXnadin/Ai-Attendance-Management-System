"""
Student Attendance Calendar API

Provides comprehensive attendance calendar data for individual students,
including daily status, monthly summaries, and attendance statistics.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import date, datetime, timedelta
from collections import defaultdict
import traceback

from app.core.database import get_db
from app.models import Student, AttendanceRecord, User, AttendanceStatus, Subject
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/student-calendar", tags=["student-calendar"])


@router.get("/{student_id}")
async def get_student_attendance_calendar(
    student_id: int,
    year: int = Query(..., description="Year for calendar view"),
    month: int = Query(..., description="Month for calendar view (1-12)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive attendance calendar data for a specific student.
    
    Returns:
    - Daily attendance status for each day in the month
    - Monthly statistics (total classes, present, absent, late, attendance rate)
    - Subject-wise breakdown
    - Streak information
    """
    
    try:
        # Verify student exists and load user relationship
        student_query = select(Student).options(
            selectinload(Student.user)
        ).where(Student.id == student_id)
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=404,
                detail=f"Student with ID {student_id} not found"
            )
        
        # Calculate date range for the month
        try:
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid year or month"
            )
        
        # Fetch all attendance records for the student in the month
        records_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == student_id,
                func.date(AttendanceRecord.date) >= start_date,
                func.date(AttendanceRecord.date) <= end_date
            )
        ).order_by(AttendanceRecord.date)
        
        result = await db.execute(records_query)
        all_records = result.scalars().all()
        
        # Fetch subject information for enrichment
        subject_query = select(Subject)
        subject_result = await db.execute(subject_query)
        subjects = {s.id: s.name for s in subject_result.scalars().all()}
        
        # Group records by date
        daily_records = defaultdict(list)
        for record in all_records:
            date_obj = record.date.date() if hasattr(record.date, 'date') else record.date
            date_str = date_obj.strftime("%Y-%m-%d")
            
            status = record.status.value if hasattr(record.status, 'value') else str(record.status)
            
            daily_records[date_str].append({
                'id': record.id,
                'status': status,
                'subject_id': record.subject_id,
                'subject_name': subjects.get(record.subject_id, 'Unknown Subject'),
                'time_in': record.time_in,
                'time_out': record.time_out,
                'location': record.location,
                'notes': record.notes
            })
        
        # Build calendar data - day-by-day status
        calendar_days = []
        current = start_date
        
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")
            records_for_day = daily_records.get(date_str, [])
            
            # Determine overall status for the day
            if not records_for_day:
                # No records means no classes scheduled or absent
                day_status = 'no_data'
                present_count = 0
                absent_count = 0
                late_count = 0
                total_count = 0
            else:
                total_count = len(records_for_day)
                present_count = sum(1 for r in records_for_day if r['status'] == 'present')
                absent_count = sum(1 for r in records_for_day if r['status'] == 'absent')
                late_count = sum(1 for r in records_for_day if r['status'] == 'late')
                excused_count = sum(1 for r in records_for_day if r['status'] == 'excused')
                
                # Overall day status logic
                if present_count == total_count:
                    day_status = 'present'
                elif absent_count == total_count:
                    day_status = 'absent'
                elif present_count > 0 and (absent_count > 0 or late_count > 0):
                    day_status = 'partial'
                elif late_count == total_count:
                    day_status = 'late'
                elif excused_count > 0:
                    day_status = 'excused'
                else:
                    day_status = 'partial'
            
            calendar_days.append({
                'date': date_str,
                'day': current.day,
                'weekday': current.strftime('%A'),
                'status': day_status,
                'total_classes': total_count,
                'present': present_count,
                'absent': absent_count,
                'late': late_count,
                'records': records_for_day
            })
            
            current += timedelta(days=1)
        
        # Calculate monthly statistics
        total_classes = len(all_records)
        present_total = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'present')
        absent_total = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'absent')
        late_total = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'late')
        excused_total = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'excused')
        
        attendance_rate = round((present_total / total_classes * 100), 2) if total_classes > 0 else 0.0
        
        # Subject-wise breakdown
        subject_stats = defaultdict(lambda: {'total': 0, 'present': 0, 'absent': 0, 'late': 0})
        for record in all_records:
            subject_id = record.subject_id
            subject_name = subjects.get(subject_id, 'Unknown Subject')
            status = record.status.value if hasattr(record.status, 'value') else str(record.status)
            
            subject_stats[subject_name]['total'] += 1
            if status == 'present':
                subject_stats[subject_name]['present'] += 1
            elif status == 'absent':
                subject_stats[subject_name]['absent'] += 1
            elif status == 'late':
                subject_stats[subject_name]['late'] += 1
        
        subject_breakdown = []
        for subject_name, stats in subject_stats.items():
            subject_rate = round((stats['present'] / stats['total'] * 100), 2) if stats['total'] > 0 else 0.0
            subject_breakdown.append({
                'subject_name': subject_name,
                'total_classes': stats['total'],
                'present': stats['present'],
                'absent': stats['absent'],
                'late': stats['late'],
                'attendance_rate': subject_rate
            })
        
        # Calculate attendance streak (consecutive days present)
        current_streak = 0
        longest_streak = 0
        temp_streak = 0
        
        # Sort calendar days by date
        sorted_days = sorted(calendar_days, key=lambda x: x['date'])
        
        for day in sorted_days:
            if day['status'] == 'present':
                temp_streak += 1
                longest_streak = max(longest_streak, temp_streak)
            elif day['status'] in ['absent', 'partial', 'late']:
                temp_streak = 0
        
        # Current streak is the temp_streak if it ends on the last day with data
        if sorted_days and sorted_days[-1]['status'] == 'present':
            current_streak = temp_streak
        
        return {
            'student_id': student_id,
            'student_name': student.user.full_name if student.user else 'Unknown',
            'student_number': student.student_id,
            'year': year,
            'month': month,
            'month_name': start_date.strftime('%B'),
            'calendar_days': calendar_days,
            'statistics': {
                'total_classes': total_classes,
                'present': present_total,
                'absent': absent_total,
                'late': late_total,
                'excused': excused_total,
                'attendance_rate': attendance_rate,
                'current_streak': current_streak,
                'longest_streak': longest_streak,
                'days_with_classes': len([d for d in calendar_days if d['total_classes'] > 0])
            },
            'subject_breakdown': sorted(subject_breakdown, key=lambda x: x['total_classes'], reverse=True)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Exception in get_student_attendance_calendar: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching calendar data: {str(e)}"
        )


@router.get("/{student_id}/summary")
async def get_student_attendance_summary(
    student_id: int,
    start_date: Optional[date] = Query(None, description="Start date for summary (defaults to semester start)"),
    end_date: Optional[date] = Query(None, description="End date for summary (defaults to today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall attendance summary for a student across a date range.
    Useful for semester-wide or year-wide statistics.
    """
    
    try:
        # Verify student exists and load user relationship
        student_query = select(Student).options(
            selectinload(Student.user)
        ).where(Student.id == student_id)
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        
        if not student:
            raise HTTPException(
                status_code=404,
                detail=f"Student with ID {student_id} not found"
            )
        
        # Default date range: current semester or year
        if not start_date:
            # Default to 6 months ago
            start_date = date.today() - timedelta(days=180)
        if not end_date:
            end_date = date.today()
        
        # Fetch all attendance records in range
        records_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == student_id,
                func.date(AttendanceRecord.date) >= start_date,
                func.date(AttendanceRecord.date) <= end_date
            )
        )
        
        result = await db.execute(records_query)
        all_records = result.scalars().all()
        
        # Calculate statistics
        total = len(all_records)
        present = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'present')
        absent = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'absent')
        late = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'late')
        excused = sum(1 for r in all_records if (r.status.value if hasattr(r.status, 'value') else str(r.status)) == 'excused')
        
        attendance_rate = round((present / total * 100), 2) if total > 0 else 0.0
        
        return {
            'student_id': student_id,
            'student_name': student.user.full_name if student.user else 'Unknown',
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': (end_date - start_date).days + 1
            },
            'statistics': {
                'total_classes': total,
                'present': present,
                'absent': absent,
                'late': late,
                'excused': excused,
                'attendance_rate': attendance_rate
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Exception in get_student_attendance_summary: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching summary data: {str(e)}"
        )
