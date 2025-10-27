"""
Session Metrics Service

Provides comprehensive class count metrics distinguishing between:
1. Planned classes (from academic calendar)
2. Actual classes (from attendance records)
3. Hybrid metrics (combining both for accuracy)

This service enhances the existing AcademicCalculatorService without breaking changes.
"""

from datetime import date
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select, func, and_, distinct, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AcademicEvent, EventType, AttendanceRecord, 
    AttendanceStatus, Student, ClassSchedule
)
from app.services.academic_calculator import AcademicCalculatorService


class SessionMetricsService:
    """
    Enhanced service for tracking planned vs actual class sessions.
    Works with existing schema - no database changes required.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.academic_calculator = AcademicCalculatorService(db)
    
    async def get_comprehensive_metrics(
        self,
        start_date: date,
        end_date: date,
        student_id: Optional[int] = None,
        subject_id: Optional[int] = None,
        semester: Optional[int] = None,
        academic_year: Optional[int] = None
    ) -> Dict:
        """
        Get comprehensive class metrics showing both planned and actual sessions.
        
        Args:
            start_date: Period start date
            end_date: Period end date
            student_id: Optional filter for specific student
            subject_id: Optional filter for specific subject
            semester: Optional semester filter
            academic_year: Optional academic year filter
            
        Returns:
            Dict containing:
            - planned: Metrics from academic calendar
            - actual: Metrics from attendance records
            - recommended: Which metric to use for calculations
            - deviation: Analysis of differences
        """
        
        # Get planned metrics from calendar
        planned_metrics = await self.academic_calculator.calculate_academic_metrics(
            start_date, end_date, semester, academic_year
        )
        
        # Get actual session metrics
        if student_id:
            actual_metrics = await self._get_student_actual_metrics(
                student_id, start_date, end_date, subject_id
            )
        else:
            actual_metrics = await self._get_global_actual_metrics(
                start_date, end_date, subject_id, semester, academic_year
            )
        
        # Analyze deviation
        deviation = await self._analyze_deviation(
            planned_metrics, actual_metrics, start_date, end_date
        )
        
        # Determine recommended calculation method
        recommended = self._determine_recommended_method(deviation)
        
        return {
            "planned": {
                "total_academic_days": planned_metrics["total_academic_days"],
                "total_periods": planned_metrics["total_periods"],
                "source": "academic_events calendar",
                "description": "Scheduled classes from academic calendar"
            },
            "actual": {
                "total_conducted_days": actual_metrics["conducted_days"],
                "total_conducted_periods": actual_metrics["conducted_periods"],
                "unique_dates": actual_metrics["unique_dates"],
                "source": "attendance_records",
                "description": "Classes where attendance was actually recorded"
            },
            "recommended": recommended,
            "deviation": deviation,
            "metadata": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "student_id": student_id,
                "subject_id": subject_id,
                "calculation_timestamp": date.today().isoformat()
            }
        }
    
    async def _get_student_actual_metrics(
        self,
        student_id: int,
        start_date: date,
        end_date: date,
        subject_id: Optional[int] = None
    ) -> Dict:
        """
        Get actual session metrics for a specific student.
        Counts unique dates where student has attendance records.
        """
        
        conditions = [
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date
        ]
        
        if subject_id:
            conditions.append(AttendanceRecord.subject_id == subject_id)
        
        # Get unique dates with attendance records
        unique_dates_query = select(
            distinct(AttendanceRecord.date)
        ).where(and_(*conditions)).order_by(AttendanceRecord.date)
        
        result = await self.db.execute(unique_dates_query)
        unique_dates = [row[0] for row in result.fetchall()]
        
        # Count total attendance records (periods)
        periods_query = select(
            func.count(AttendanceRecord.id)
        ).where(and_(*conditions))
        
        result = await self.db.execute(periods_query)
        total_periods = result.scalar() or 0
        
        # Get breakdown by date
        daily_breakdown_query = select(
            AttendanceRecord.date,
            func.count(distinct(AttendanceRecord.subject_id)).label('subjects_count'),
            func.count(AttendanceRecord.id).label('records_count')
        ).where(and_(*conditions)).group_by(AttendanceRecord.date)
        
        result = await self.db.execute(daily_breakdown_query)
        daily_breakdown = result.fetchall()
        
        return {
            "conducted_days": len(unique_dates),
            "conducted_periods": total_periods,
            "unique_dates": unique_dates,
            "daily_breakdown": [
                {
                    "date": day.date.isoformat() if hasattr(day.date, 'isoformat') else str(day.date),
                    "subjects_count": day.subjects_count,
                    "records_count": day.records_count
                }
                for day in daily_breakdown
            ]
        }
    
    async def _get_global_actual_metrics(
        self,
        start_date: date,
        end_date: date,
        subject_id: Optional[int] = None,
        semester: Optional[int] = None,
        academic_year: Optional[int] = None
    ) -> Dict:
        """
        Get global actual session metrics across all students.
        Useful for administrative reporting.
        """
        
        conditions = [
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date
        ]
        
        if subject_id:
            conditions.append(AttendanceRecord.subject_id == subject_id)
        
        # Get unique dates where ANY attendance was recorded
        unique_dates_query = select(
            distinct(AttendanceRecord.date)
        ).where(and_(*conditions)).order_by(AttendanceRecord.date)
        
        result = await self.db.execute(unique_dates_query)
        unique_dates = [row[0] for row in result.fetchall()]
        
        # Count total attendance records globally
        periods_query = select(
            func.count(AttendanceRecord.id)
        ).where(and_(*conditions))
        
        result = await self.db.execute(periods_query)
        total_periods = result.scalar() or 0
        
        # Get daily statistics
        daily_stats_query = select(
            AttendanceRecord.date,
            func.count(distinct(AttendanceRecord.student_id)).label('students_count'),
            func.count(distinct(AttendanceRecord.subject_id)).label('subjects_count'),
            func.count(AttendanceRecord.id).label('records_count')
        ).where(and_(*conditions)).group_by(AttendanceRecord.date)
        
        result = await self.db.execute(daily_stats_query)
        daily_stats = result.fetchall()
        
        return {
            "conducted_days": len(unique_dates),
            "conducted_periods": total_periods,
            "unique_dates": unique_dates,
            "daily_breakdown": [
                {
                    "date": day.date.isoformat() if hasattr(day.date, 'isoformat') else str(day.date),
                    "students_count": day.students_count,
                    "subjects_count": day.subjects_count,
                    "records_count": day.records_count
                }
                for day in daily_stats
            ]
        }
    
    async def _analyze_deviation(
        self,
        planned_metrics: Dict,
        actual_metrics: Dict,
        start_date: date,
        end_date: date
    ) -> Dict:
        """
        Analyze the deviation between planned and actual sessions.
        """
        
        planned_days = planned_metrics.get("total_academic_days", 0)
        actual_days = actual_metrics.get("conducted_days", 0)
        
        deviation_count = actual_days - planned_days
        deviation_percentage = (
            (deviation_count / planned_days * 100) 
            if planned_days > 0 else 0
        )
        
        # Classify deviation severity
        if abs(deviation_count) <= 2:
            severity = "minimal"
            impact = "negligible"
        elif abs(deviation_count) <= 5:
            severity = "moderate"
            impact = "noticeable"
        else:
            severity = "significant"
            impact = "substantial"
        
        # Determine likely causes
        likely_causes = []
        if deviation_count > 0:
            likely_causes.append("Additional makeup sessions conducted")
            likely_causes.append("Extra classes added after calendar creation")
        elif deviation_count < 0:
            likely_causes.append("Classes cancelled but not removed from calendar")
            likely_causes.append("Attendance not recorded for some scheduled classes")
            likely_causes.append("Calendar includes future dates not yet reached")
        
        return {
            "count": deviation_count,
            "percentage": round(deviation_percentage, 2),
            "severity": severity,
            "impact": impact,
            "direction": "more_than_planned" if deviation_count > 0 else "less_than_planned" if deviation_count < 0 else "matches_plan",
            "likely_causes": likely_causes,
            "recommendation": self._get_deviation_recommendation(deviation_count, severity)
        }
    
    def _get_deviation_recommendation(self, deviation_count: int, severity: str) -> str:
        """Generate recommendation based on deviation."""
        
        if severity == "minimal":
            return "Deviation is within acceptable range. Current calculation method is appropriate."
        elif deviation_count > 0:
            return "More sessions conducted than planned. Consider using actual session count for fairer attendance calculation."
        else:
            return "Fewer sessions than planned. Verify if calendar includes future dates or if classes were cancelled without recording."
    
    def _determine_recommended_method(self, deviation: Dict) -> Dict:
        """
        Determine which calculation method to recommend.
        
        Returns:
            Dict with recommendation details
        """
        
        severity = deviation.get("severity", "minimal")
        deviation_count = deviation.get("count", 0)
        
        # Default to hybrid approach for most cases
        if severity == "minimal":
            method = "planned"
            reason = "Minimal deviation - planned total is reliable"
        elif deviation_count > 0:
            method = "actual"
            reason = "More sessions conducted than planned - actual count is fairer"
        elif severity == "significant":
            method = "hybrid"
            reason = "Significant deviation - use hybrid approach with deviation tracking"
        else:
            method = "planned"
            reason = "Some planned sessions not yet conducted - planned total maintains consistency"
        
        return {
            "method": method,
            "reason": reason,
            "use_case": {
                "planned": "Use for administrative planning and goal setting",
                "actual": "Use for final grade calculation and performance evaluation",
                "hybrid": "Use for real-time attendance tracking with deviation alerts"
            }[method]
        }
    
    async def calculate_attendance_with_deviation_awareness(
        self,
        student_id: int,
        start_date: date,
        end_date: date,
        calculation_method: str = "hybrid"
    ) -> Dict:
        """
        Calculate attendance percentage with full awareness of planned vs actual.
        
        Args:
            student_id: Student ID
            start_date: Period start
            end_date: Period end
            calculation_method: 'planned', 'actual', or 'hybrid'
            
        Returns:
            Comprehensive attendance metrics
        """
        
        # Get comprehensive metrics
        metrics = await self.get_comprehensive_metrics(
            start_date, end_date, student_id=student_id
        )
        
        # Get student's attendance records
        conditions = [
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date
        ]
        
        # Count present days
        present_query = select(
            func.count(distinct(
                case((AttendanceRecord.status == AttendanceStatus.present, AttendanceRecord.date))
            ))
        ).where(and_(*conditions))
        
        result = await self.db.execute(present_query)
        present_days = result.scalar() or 0
        
        # Choose denominator based on method
        if calculation_method == "planned":
            total_days = metrics["planned"]["total_academic_days"]
        elif calculation_method == "actual":
            total_days = metrics["actual"]["total_conducted_days"]
        else:  # hybrid
            # Use planned, but adjust if actual is significantly different
            planned = metrics["planned"]["total_academic_days"]
            actual = metrics["actual"]["total_conducted_days"]
            
            # If actual is more than 10% different, use actual
            if abs(actual - planned) / planned > 0.1 if planned > 0 else False:
                total_days = actual
            else:
                total_days = planned
        
        percentage = (present_days / total_days * 100) if total_days > 0 else 0
        
        return {
            "present_days": present_days,
            "total_days_used": total_days,
            "percentage": round(percentage, 2),
            "calculation_method": calculation_method,
            "metrics_breakdown": metrics,
            "deviation_alert": metrics["deviation"]["severity"] != "minimal",
            "recommendation": metrics["recommended"]
        }


async def get_session_metrics(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    student_id: Optional[int] = None,
    **kwargs
) -> Dict:
    """
    Convenience function to get session metrics.
    
    Usage:
        metrics = await get_session_metrics(
            db, 
            date(2025, 8, 1), 
            date(2025, 12, 15),
            student_id=123
        )
    """
    service = SessionMetricsService(db)
    return await service.get_comprehensive_metrics(
        start_date, end_date, student_id=student_id, **kwargs
    )
