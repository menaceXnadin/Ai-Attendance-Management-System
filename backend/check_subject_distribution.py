#!/usr/bin/env python3

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_db
from app.models import Subject, Faculty
from sqlalchemy import text

async def check_subjects_by_faculty_semester():
    async for db in get_db():
        try:
            # Check a specific faculty to see the actual distribution
            result = await db.execute(text('''
                SELECT 
                    f.name as faculty_name,
                    s.class_schedule->>'semester' as semester,
                    COUNT(*) as subject_count,
                    STRING_AGG(s.name, ', ') as subject_names
                FROM subjects s
                JOIN faculties f ON s.faculty_id = f.id
                WHERE f.name = 'Computer Science'
                GROUP BY f.name, s.class_schedule->>'semester'
                ORDER BY s.class_schedule->>'semester'::int
            '''))
            
            print('🎯 Computer Science Faculty Subject Distribution:')
            for row in result:
                print(f'   Semester {row.semester}: {row.subject_count} subjects')
                print(f'   Subjects: {row.subject_names[:100]}...')
                print()
            
            # Check total count across all faculties for semester 1
            result2 = await db.execute(text('''
                SELECT 
                    COUNT(*) as total_subjects
                FROM subjects s
                WHERE s.class_schedule->>'semester' = '1'
            '''))
            
            total = result2.scalar()
            print(f'📊 Total subjects in Semester 1 across ALL faculties: {total}')
            print()
            
            # Check distinct faculties
            result3 = await db.execute(text('''
                SELECT 
                    f.name as faculty_name,
                    COUNT(*) as subject_count
                FROM subjects s
                JOIN faculties f ON s.faculty_id = f.id
                WHERE s.class_schedule->>'semester' = '1'
                GROUP BY f.name
                ORDER BY f.name
            '''))
            
            print('📋 Semester 1 subjects by faculty:')
            for row in result3:
                print(f'   {row.faculty_name}: {row.subject_count} subjects')
            
            print()
            print('🔍 Checking if subjects are duplicated across faculties...')
            
            # Check for duplicate subject names across faculties
            result4 = await db.execute(text('''
                SELECT 
                    s.name as subject_name,
                    COUNT(DISTINCT f.id) as faculty_count,
                    STRING_AGG(DISTINCT f.name, ', ') as faculties
                FROM subjects s
                JOIN faculties f ON s.faculty_id = f.id
                WHERE s.class_schedule->>'semester' = '1'
                GROUP BY s.name
                HAVING COUNT(DISTINCT f.id) > 1
                ORDER BY faculty_count DESC
                LIMIT 10
            '''))
            
            duplicates = result4.fetchall()
            if duplicates:
                print('⚠️  FOUND DUPLICATE SUBJECTS ACROSS FACULTIES:')
                for row in duplicates:
                    print(f'   "{row.subject_name}" appears in {row.faculty_count} faculties: {row.faculties}')
            else:
                print('✅ No duplicate subjects found across faculties')
                
        except Exception as e:
            print(f'❌ Error: {e}')
        finally:
            await db.close()
            break

if __name__ == "__main__":
    asyncio.run(check_subjects_by_faculty_semester())
