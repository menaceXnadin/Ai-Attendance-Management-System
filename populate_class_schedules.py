#!/usr/bin/env python3

import psycopg2
import psycopg2.extras
from datetime import time
import random

def populate_class_schedules():
    """Populate the class_schedules table with a comprehensive schedule"""
    
    try:
        # Connect to the PostgreSQL database
        conn = psycopg2.connect(
            host="localhost",
            database="attendancedb",
            user="postgres",
            password="nadin123"
        )
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        print("=== POPULATING CLASS SCHEDULES ===")
        
        # Clear existing schedules first
        cursor.execute("DELETE FROM class_schedules")
        print("✅ Cleared existing class schedules")
        
        # First, let's clean up subjects to ensure exactly 5 subjects per semester per faculty
        print("\n=== CLEANING UP SUBJECTS (KEEPING ONLY 5 PER SEMESTER) ===")
        
        # Get subjects that exceed 5 per semester per faculty
        cursor.execute("""
            WITH ranked_subjects AS (
                SELECT 
                    s.id,
                    s.name,
                    s.faculty_id,
                    s.class_schedule->>'semester' as semester,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.faculty_id, s.class_schedule->>'semester' 
                        ORDER BY s.id
                    ) as rn
                FROM subjects s
                WHERE s.class_schedule->>'semester' IS NOT NULL
            )
            SELECT 
                faculty_id,
                semester,
                COUNT(*) as subject_count,
                STRING_AGG(CASE WHEN rn > 5 THEN id::text END, ', ') as excess_subject_ids
            FROM ranked_subjects
            GROUP BY faculty_id, semester
            HAVING COUNT(*) > 5
        """)
        excess_subjects = cursor.fetchall()
        
        total_removed = 0
        for excess in excess_subjects:
            if excess['excess_subject_ids']:
                print(f"  Faculty {excess['faculty_id']} Semester {excess['semester']}: "
                      f"Had {excess['subject_count']} subjects, removing excess ones")
                
                # Delete excess subjects (keeping only first 5)
                excess_ids = [int(id_str) for id_str in excess['excess_subject_ids'].split(', ') if id_str]
                for subject_id in excess_ids:
                    cursor.execute("DELETE FROM subjects WHERE id = %s", (subject_id,))
                    total_removed += 1
        
        if total_removed > 0:
            print(f"✅ Removed {total_removed} excess subjects to maintain 5 subjects per semester")
            conn.commit()
        else:
            print("✅ No excess subjects found - all semesters already have 5 or fewer subjects")
        
        # Define the schedule parameters
        days_of_week = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']  # 6 days
        time_slots = [
            (time(10, 0), time(11, 0)),  # 10:00-11:00
            (time(11, 0), time(12, 0)),  # 11:00-12:00
            (time(12, 0), time(13, 0)),  # 12:00-13:00 (1:00 PM)
            (time(14, 0), time(15, 0)),  # 14:00-15:00 (2:00-3:00 PM)
            (time(15, 0), time(16, 0)),  # 15:00-16:00 (3:00-4:00 PM)
        ]  # 5 time slots per day
        
        # Academic year (current)
        academic_year = 2025
        
        # Some classroom options - expanded list to avoid conflicts
        classrooms = [
            "Room A101", "Room A102", "Room A103", "Room A104", "Room A105", "Room A106", "Room A107", "Room A108",
            "Room B101", "Room B102", "Room B103", "Room B104", "Room B105", "Room B106", "Room B107", "Room B108",
            "Room C101", "Room C102", "Room C103", "Room C104", "Room C105", "Room C106", "Room C107", "Room C108",
            "Lab 1", "Lab 2", "Lab 3", "Lab 4", "Lab 5", "Lab 6", "Lab 7", "Lab 8",
            "Computer Lab 1", "Computer Lab 2", "Physics Lab 1", "Physics Lab 2", "Chemistry Lab 1", "Chemistry Lab 2",
            "Hall A", "Hall B", "Hall C", "Hall D", "Auditorium 1", "Auditorium 2", "Conference Room 1", "Conference Room 2"
        ]
        
        # Some instructor names
        instructors = [
            "Dr. Sharma", "Prof. Patel", "Dr. Gupta", "Prof. Singh", "Dr. Kumar",
            "Prof. Thapa", "Dr. Shrestha", "Prof. Khadka", "Dr. Rai", "Prof. Gurung",
            "Dr. Tamang", "Prof. Lama", "Dr. Magar", "Prof. Limbu", "Dr. Sherpa"
        ]
        
        # Get all faculties with their subjects organized by semester
        cursor.execute("""
            SELECT 
                s.id as subject_id,
                s.name as subject_name,
                s.code as subject_code,
                s.faculty_id,
                f.name as faculty_name,
                s.class_schedule->>'semester' as semester
            FROM subjects s
            JOIN faculties f ON s.faculty_id = f.id
            WHERE s.class_schedule->>'semester' IS NOT NULL
            ORDER BY s.faculty_id, (s.class_schedule->>'semester')::int, s.id;
        """)
        all_subjects = cursor.fetchall()
        
        # Group subjects by faculty and semester
        faculty_subjects = {}
        for subject in all_subjects:
            faculty_id = subject['faculty_id']
            semester = int(subject['semester'])
            
            if faculty_id not in faculty_subjects:
                faculty_subjects[faculty_id] = {}
            if semester not in faculty_subjects[faculty_id]:
                faculty_subjects[faculty_id][semester] = []
            
            faculty_subjects[faculty_id][semester].append(subject)
        
        # Generate schedules
        total_schedules = 0
        classroom_assignments = {}  # Track classroom assignments to avoid conflicts
        
        for faculty_id, semesters in faculty_subjects.items():
            print(f"\n📚 Processing Faculty {faculty_id}...")
            
            for semester in range(1, 9):  # 8 semesters
                if semester not in semesters:
                    print(f"  ⚠️  Semester {semester}: No subjects found")
                    continue
                
                # Get exactly 5 subjects for this semester (now guaranteed after cleanup)
                semester_subjects = semesters[semester]
                
                if len(semester_subjects) != 5:
                    print(f"  ⚠️  Semester {semester}: Has {len(semester_subjects)} subjects (expected 5)")
                    # If we have fewer than 5, we'll cycle through them
                    # If we somehow have more than 5, we'll take only the first 5
                    if len(semester_subjects) > 5:
                        semester_subjects = semester_subjects[:5]
                
                print(f"  📖 Semester {semester}: Using {len(semester_subjects)} subjects")
                
                # Create schedule for this faculty-semester combination
                # Each day will have 5 subjects (distributed across 5 time slots)
                # With 6 days (Sun-Fri) and 5 time slots = 30 total periods per week
                subject_index = 0
                
                for day in days_of_week:
                    for slot_index, (start_time, end_time) in enumerate(time_slots):
                        if subject_index >= len(semester_subjects):
                            subject_index = 0  # Cycle through subjects if we have fewer than 25
                        
                        subject = semester_subjects[subject_index]
                        
                        # Find an available classroom for this time slot
                        classroom_key = f"{day}_{start_time}_{academic_year}"
                        if classroom_key not in classroom_assignments:
                            classroom_assignments[classroom_key] = []
                        
                        # Find a classroom not already assigned for this time slot
                        available_classroom = None
                        for classroom in classrooms:
                            if classroom not in classroom_assignments[classroom_key]:
                                available_classroom = classroom
                                classroom_assignments[classroom_key].append(classroom)
                                break
                        
                        # If all classrooms are taken for this slot, use a unique identifier
                        if available_classroom is None:
                            available_classroom = f"Room F{faculty_id}S{semester}_{len(classroom_assignments[classroom_key])}"
                        
                        # Insert the schedule entry
                        cursor.execute("""
                            INSERT INTO class_schedules (
                                subject_id, faculty_id, day_of_week, start_time, end_time,
                                semester, academic_year, classroom, instructor_name, is_active, notes
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                            )
                        """, (
                            subject['subject_id'],
                            faculty_id,
                            day,
                            start_time,
                            end_time,
                            semester,
                            academic_year,
                            available_classroom,
                            random.choice(instructors),
                            True,
                            f"Auto-generated schedule for {subject['subject_name']}"
                        ))
                        
                        subject_index += 1
                        total_schedules += 1
        
        # Commit the transaction
        conn.commit()
        print(f"\n✅ Successfully created {total_schedules} class schedule entries!")
        
        # Verify the data
        print("\n=== VERIFICATION ===")
        cursor.execute("SELECT COUNT(*) FROM class_schedules")
        total_count = cursor.fetchone()[0]
        print(f"Total schedules in database: {total_count}")
        
        cursor.execute("""
            SELECT 
                cs.faculty_id,
                f.name as faculty_name,
                cs.semester,
                COUNT(*) as schedule_count
            FROM class_schedules cs
            JOIN faculties f ON cs.faculty_id = f.id
            GROUP BY cs.faculty_id, f.name, cs.semester
            ORDER BY cs.faculty_id, cs.semester
        """)
        verification = cursor.fetchall()
        
        print("\nSchedules per Faculty-Semester:")
        for v in verification:
            print(f"  Faculty {v['faculty_id']} ({v['faculty_name']}) - Semester {v['semester']}: {v['schedule_count']} entries")
        
        # Show sample schedules
        print("\n=== SAMPLE SCHEDULES ===")
        cursor.execute("""
            SELECT 
                cs.faculty_id,
                f.name as faculty_name,
                cs.semester,
                cs.day_of_week,
                cs.start_time,
                cs.end_time,
                s.name as subject_name,
                cs.classroom,
                cs.instructor_name
            FROM class_schedules cs
            JOIN faculties f ON cs.faculty_id = f.id
            JOIN subjects s ON cs.subject_id = s.id
            WHERE cs.faculty_id = 1 AND cs.semester = 1 AND cs.day_of_week = 'MONDAY'
            ORDER BY cs.start_time
            LIMIT 5
        """)
        sample_schedules = cursor.fetchall()
        
        if sample_schedules:
            print("Sample Monday schedule for Faculty 1, Semester 1:")
            for schedule in sample_schedules:
                print(f"  {schedule['start_time']}-{schedule['end_time']}: "
                      f"{schedule['subject_name']} in {schedule['classroom']} "
                      f"({schedule['instructor_name']})")
        
        cursor.close()
        conn.close()
        
        print(f"\n🎉 CLASS SCHEDULES POPULATION COMPLETED SUCCESSFULLY! 🎉")
        print(f"📊 Total entries created: {total_schedules}")
        print(f"🏫 Covering 12 faculties × 8 semesters × 6 days × 5 time slots = 30 periods per semester per faculty")
        
    except Exception as e:
        print(f"❌ Error populating class schedules: {e}")
        if conn:
            conn.rollback()

if __name__ == "__main__":
    populate_class_schedules()