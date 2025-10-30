"""
Safe Historical Attendance Backfill Utility

Allows administrators to securely insert historical attendance records
when system was inactive, with comprehensive validation and audit trails.

Usage:
    python backfill_historical_attendance.py --csv attendance_oct_1_26.csv --admin-id 1 --reason "System downtime Oct 1-26"

CSV Format:
    student_number,date,subject_code,status,notes
    STU2025001,2025-10-15,CS101,present,Attended (paper records)
    STU2025002,2025-10-15,CS101,absent,Absent (paper records)
"""

import asyncio
import csv
import argparse
from datetime import datetime, date
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from tabulate import tabulate

from app.core.database import AsyncSessionLocal
from app.models import (
    AttendanceRecord, Student, Subject, User, AcademicEvent,
    AttendanceStatus, AttendanceMethod, EventType
)


class BackfillValidator:
    """Validates backfill records with comprehensive checks"""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
        
    async def validate_record(
        self,
        record: Dict[str, Any],
        db: AsyncSession
    ) -> bool:
        """
        Comprehensive validation of a single backfill record
        
        Returns: True if valid, False if invalid (with errors logged)
        """
        record_id = f"{record.get('student_number')}/{record.get('date')}/{record.get('subject_code')}"
        
        # Validation 1: Date must be in the past
        if record['date'] >= date.today():
            self.errors.append(f"{record_id}: Date must be in the past")
            return False
        
        # Validation 2: Date not too old (max 1 year)
        if (date.today() - record['date']).days > 365:
            self.errors.append(f"{record_id}: Date too old (max 1 year)")
            return False
        
        # Validation 3: Student exists
        student_query = select(Student).where(Student.student_id == record['student_number'])
        student_result = await db.execute(student_query)
        student = student_result.scalar_one_or_none()
        
        if not student:
            self.errors.append(f"{record_id}: Student not found")
            return False
        
        record['_student_db_id'] = student.id  # Store for later use
        
        # Validation 4: Subject exists
        subject_query = select(Subject).where(Subject.code == record['subject_code'])
        subject_result = await db.execute(subject_query)
        subject = subject_result.scalar_one_or_none()
        
        if not subject:
            self.errors.append(f"{record_id}: Subject not found")
            return False
        
        record['_subject_db_id'] = subject.id
        
        # Validation 5: Class event exists for that date
        event_query = select(AcademicEvent).where(
            and_(
                AcademicEvent.start_date == record['date'],
                AcademicEvent.event_type == EventType.CLASS
            )
        )
        event_result = await db.execute(event_query)
        event = event_result.scalar_one_or_none()
        
        if not event:
            self.warnings.append(f"{record_id}: No CLASS event found for this date (will create anyway)")
        
        # Validation 6: Check for duplicate records
        existing_query = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.date == record['date'],
                AttendanceRecord.subject_id == subject.id
            )
        )
        existing_result = await db.execute(existing_query)
        existing = existing_result.scalar_one_or_none()
        
        if existing:
            # Check if it's an auto-generated absent record (can be overwritten)
            if existing.method == AttendanceMethod.other and 'Auto' in (existing.notes or ''):
                self.warnings.append(f"{record_id}: Will overwrite auto-generated absent record")
                record['_overwrite_record_id'] = existing.id
            else:
                self.errors.append(f"{record_id}: Record already exists (not auto-generated)")
                return False
        
        # Validation 7: Status must be valid
        valid_statuses = ['present', 'absent', 'late', 'excused']
        if record['status'].lower() not in valid_statuses:
            self.errors.append(f"{record_id}: Invalid status '{record['status']}'")
            return False
        
        # Validation 8: Must have notes/reason
        if not record.get('notes') or len(record['notes']) < 10:
            self.errors.append(f"{record_id}: Notes too short (min 10 chars)")
            return False
        
        return True


class HistoricalAttendanceBackfill:
    """Main backfill orchestrator"""
    
    def __init__(self, admin_user_id: int, reason: str):
        self.admin_user_id = admin_user_id
        self.reason = reason
        self.validator = BackfillValidator()
        
    async def process_csv_backfill(
        self,
        csv_path: str,
        dry_run: bool = False,
        require_confirmation: bool = True
    ) -> Dict[str, Any]:
        """
        Main entry point for CSV backfill
        
        Args:
            csv_path: Path to CSV file with attendance data
            dry_run: If True, only validate without inserting
            require_confirmation: If True, ask user to confirm before insert
            
        Returns:
            Dict with results, errors, warnings
        """
        async with AsyncSessionLocal() as db:
            # Step 1: Parse CSV
            print("📄 Step 1: Parsing CSV file...")
            records = self._parse_csv(csv_path)
            print(f"   Found {len(records)} records")
            
            # Step 2: Validate all records
            print("\n🔍 Step 2: Validating records...")
            validated_records = []
            for i, record in enumerate(records):
                if await self.validator.validate_record(record, db):
                    validated_records.append(record)
                if (i + 1) % 10 == 0:
                    print(f"   Validated {i + 1}/{len(records)}...")
            
            print(f"\n   ✅ Valid: {len(validated_records)}")
            print(f"   ⚠️  Warnings: {len(self.validator.warnings)}")
            print(f"   ❌ Errors: {len(self.validator.errors)}")
            
            # Show errors if any
            if self.validator.errors:
                print("\n❌ Validation Errors:")
                for error in self.validator.errors[:10]:  # Show first 10
                    print(f"   • {error}")
                if len(self.validator.errors) > 10:
                    print(f"   ... and {len(self.validator.errors) - 10} more errors")
                return {
                    'success': False,
                    'errors': self.validator.errors,
                    'warnings': self.validator.warnings
                }
            
            # Show warnings
            if self.validator.warnings:
                print("\n⚠️  Validation Warnings:")
                for warning in self.validator.warnings[:5]:
                    print(f"   • {warning}")
                if len(self.validator.warnings) > 5:
                    print(f"   ... and {len(self.validator.warnings) - 5} more warnings")
            
            # Step 3: Generate impact report
            print("\n📊 Step 3: Generating impact report...")
            report = self._generate_impact_report(validated_records)
            self._print_impact_report(report)
            
            # Step 4: Confirmation (if not dry run)
            if dry_run:
                print("\n🔬 DRY RUN MODE - No data will be inserted")
                return {
                    'success': True,
                    'dry_run': True,
                    'validated_records': len(validated_records),
                    'warnings': self.validator.warnings
                }
            
            if require_confirmation:
                print("\n" + "="*60)
                confirm = input("⚠️  Type 'CONFIRM' to proceed with backfill: ")
                if confirm.strip().upper() != 'CONFIRM':
                    print("❌ Backfill cancelled by user")
                    return {'success': False, 'message': 'Cancelled by user'}
            
            # Step 5: Insert records
            print("\n💾 Step 4: Inserting records into database...")
            result = await self._insert_records(validated_records, db)
            
            print(f"\n✅ SUCCESS! Backfilled {result['inserted']} attendance records")
            print(f"📋 Overwritten auto-absent records: {result['overwritten']}")
            
            return {
                'success': True,
                'records_inserted': result['inserted'],
                'records_overwritten': result['overwritten'],
                'warnings': self.validator.warnings
            }
    
    def _parse_csv(self, csv_path: str) -> List[Dict[str, Any]]:
        """Parse CSV file into list of record dicts"""
        records = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse date
                try:
                    date_obj = datetime.strptime(row['date'], '%Y-%m-%d').date()
                except ValueError:
                    print(f"⚠️  Skipping row with invalid date: {row['date']}")
                    continue
                
                records.append({
                    'student_number': row['student_number'].strip(),
                    'date': date_obj,
                    'subject_code': row['subject_code'].strip(),
                    'status': row['status'].strip().lower(),
                    'notes': row.get('notes', '').strip()
                })
        
        return records
    
    def _generate_impact_report(self, records: List[Dict]) -> Dict[str, Any]:
        """Generate summary statistics and impact analysis"""
        from collections import Counter
        
        total = len(records)
        date_range = (min(r['date'] for r in records), max(r['date'] for r in records))
        students = set(r['student_number'] for r in records)
        subjects = set(r['subject_code'] for r in records)
        status_counts = Counter(r['status'] for r in records)
        
        return {
            'total_records': total,
            'date_range': date_range,
            'students_affected': len(students),
            'subjects': len(subjects),
            'status_breakdown': dict(status_counts)
        }
    
    def _print_impact_report(self, report: Dict[str, Any]):
        """Pretty print the impact report"""
        print("\n" + "="*60)
        print("📊 BACKFILL IMPACT REPORT")
        print("="*60)
        print(f"Total Records:       {report['total_records']}")
        print(f"Date Range:          {report['date_range'][0]} to {report['date_range'][1]}")
        print(f"Students Affected:   {report['students_affected']}")
        print(f"Subjects:            {report['subjects']}")
        print(f"\nStatus Breakdown:")
        for status, count in report['status_breakdown'].items():
            percentage = (count / report['total_records']) * 100
            print(f"  {status.capitalize():10s}: {count:4d} ({percentage:5.1f}%)")
        print("="*60)
    
    async def _insert_records(
        self,
        records: List[Dict[str, Any]],
        db: AsyncSession
    ) -> Dict[str, int]:
        """Insert validated records into database"""
        inserted = 0
        overwritten = 0
        
        for record in records:
            # Check if we need to overwrite existing record
            if '_overwrite_record_id' in record:
                # Delete the auto-generated record
                existing_query = select(AttendanceRecord).where(
                    AttendanceRecord.id == record['_overwrite_record_id']
                )
                existing_result = await db.execute(existing_query)
                existing = existing_result.scalar_one()
                await db.delete(existing)
                overwritten += 1
            
            # Create new attendance record
            attendance_record = AttendanceRecord(
                student_id=record['_student_db_id'],
                date=record['date'],
                subject_id=record['_subject_db_id'],
                status=AttendanceStatus[record['status']],
                method=AttendanceMethod.other,
                marked_by=self.admin_user_id,
                notes=f"[BACKFILLED] {record['notes']} | Reason: {self.reason} | Backfilled on: {datetime.now()}",
                created_at=datetime.now()
            )
            
            db.add(attendance_record)
            inserted += 1
        
        await db.commit()
        
        return {'inserted': inserted, 'overwritten': overwritten}


async def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description='Backfill historical attendance records safely'
    )
    parser.add_argument('--csv', required=True, help='Path to CSV file')
    parser.add_argument('--admin-id', type=int, required=True, help='Admin user ID')
    parser.add_argument('--reason', required=True, help='Reason for backfill')
    parser.add_argument('--dry-run', action='store_true', help='Validate only, do not insert')
    parser.add_argument('--yes', action='store_true', help='Skip confirmation prompt')
    
    args = parser.parse_args()
    
    print("="*60)
    print("🔧 HISTORICAL ATTENDANCE BACKFILL UTILITY")
    print("="*60)
    print(f"CSV File:  {args.csv}")
    print(f"Admin ID:  {args.admin_id}")
    print(f"Reason:    {args.reason}")
    print(f"Dry Run:   {args.dry_run}")
    print("="*60)
    
    backfill = HistoricalAttendanceBackfill(
        admin_user_id=args.admin_id,
        reason=args.reason
    )
    
    result = await backfill.process_csv_backfill(
        csv_path=args.csv,
        dry_run=args.dry_run,
        require_confirmation=not args.yes
    )
    
    if result['success']:
        print("\n✅ Backfill completed successfully!")
    else:
        print("\n❌ Backfill failed!")
        print(f"Errors: {len(result.get('errors', []))}")


if __name__ == '__main__':
    asyncio.run(main())
