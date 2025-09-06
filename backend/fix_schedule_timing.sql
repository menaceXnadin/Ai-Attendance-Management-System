-- Fix Class Schedule Timing
-- Update schedules to start from 10:00 AM with proper 5 subjects per day

-- First, let's see what we currently have
SELECT 'Current schedule count:' as info, COUNT(*) as count FROM class_schedules;

-- Show current timing distribution
SELECT 'Current timing distribution:' as info, start_time, end_time, COUNT(*) as count
FROM class_schedules 
GROUP BY start_time, end_time
ORDER BY start_time;

-- Clear existing schedules (they have wrong timing)
DELETE FROM class_schedules;

-- Get available subjects and faculties
SELECT 'Available subjects:' as info, COUNT(*) as count FROM subjects;
SELECT 'Available faculties:' as info, COUNT(*) as count FROM faculties;

-- Create proper class schedules with correct timing
-- Time slots: 10:00 AM to 4:00 PM (5 periods of 1 hour each)

-- For each semester (1-8), each faculty, create 5 subjects per day for 6 days (Sun-Fri)

-- Semester 1 schedules
INSERT INTO class_schedules (subject_id, faculty_id, day_of_week, start_time, end_time, semester, academic_year, classroom, instructor_name, is_active, notes)
SELECT 
    s.id as subject_id,
    f.id as faculty_id,
    d.day_name as day_of_week,
    t.start_time,
    t.end_time,
    sem.semester,
    sem.academic_year,
    CONCAT(t.period_name, ' ', f.name, '-', sem.semester, d.day_num, t.period_num) as classroom,
    CONCAT('Prof. ', f.name, ' ', CHAR(64 + t.period_num)) as instructor_name,
    true as is_active,
    CONCAT('Fixed schedule - Semester ', sem.semester, ', ', f.name) as notes
FROM 
    -- Subjects (rotate through available subjects)
    (SELECT id, name, ROW_NUMBER() OVER (ORDER BY id) as subject_num FROM subjects) s
    CROSS JOIN
    -- Faculties
    (SELECT id, name, ROW_NUMBER() OVER (ORDER BY id) as faculty_num FROM faculties) f
    CROSS JOIN
    -- Days (Sunday to Friday)
    (SELECT 'SUNDAY' as day_name, 1 as day_num
     UNION SELECT 'MONDAY', 2
     UNION SELECT 'TUESDAY', 3  
     UNION SELECT 'WEDNESDAY', 4
     UNION SELECT 'THURSDAY', 5
     UNION SELECT 'FRIDAY', 6) d
    CROSS JOIN
    -- Time slots (5 periods: 10 AM to 3 PM)
    (SELECT '10:00:00'::time as start_time, '11:00:00'::time as end_time, 'Period 1' as period_name, 1 as period_num
     UNION SELECT '11:00:00'::time, '12:00:00'::time, 'Period 2', 2
     UNION SELECT '13:00:00'::time, '14:00:00'::time, 'Period 3', 3  -- After lunch break
     UNION SELECT '14:00:00'::time, '15:00:00'::time, 'Period 4', 4
     UNION SELECT '15:00:00'::time, '16:00:00'::time, 'Period 5', 5) t
    CROSS JOIN
    -- Semesters
    (SELECT 1 as semester, 2025 as academic_year
     UNION SELECT 2, 2025
     UNION SELECT 3, 2026
     UNION SELECT 4, 2026
     UNION SELECT 5, 2027
     UNION SELECT 6, 2027
     UNION SELECT 7, 2028
     UNION SELECT 8, 2028) sem
WHERE 
    -- Ensure we don't create too many combinations
    -- Rotate subjects based on faculty, day, and period to ensure variety
    s.subject_num = ((f.faculty_num - 1 + d.day_num - 1 + t.period_num - 1 + sem.semester - 1) % (SELECT COUNT(*) FROM subjects)) + 1;

-- Verify the results
SELECT 'Final schedule count:' as info, COUNT(*) as count FROM class_schedules;

-- Show new timing distribution
SELECT 'New timing distribution:' as info, start_time, end_time, COUNT(*) as count
FROM class_schedules 
GROUP BY start_time, end_time
ORDER BY start_time;

-- Show distribution by semester
SELECT 
    'Semester distribution:' as info,
    semester, 
    academic_year,
    COUNT(*) as schedule_count,
    COUNT(DISTINCT faculty_id) as faculty_count,
    COUNT(DISTINCT subject_id) as subject_count
FROM class_schedules 
GROUP BY semester, academic_year
ORDER BY semester;

-- Show sample schedule for Semester 1
SELECT 'Sample Schedule (Semester 1):' as info;
SELECT 
    f.name as faculty,
    day_of_week,
    start_time,
    end_time,
    s.name as subject,
    classroom
FROM class_schedules cs
JOIN subjects s ON cs.subject_id = s.id  
JOIN faculties f ON cs.faculty_id = f.id
WHERE semester = 1
ORDER BY 
    f.name,
    CASE day_of_week 
        WHEN 'SUNDAY' THEN 1
        WHEN 'MONDAY' THEN 2  
        WHEN 'TUESDAY' THEN 3
        WHEN 'WEDNESDAY' THEN 4
        WHEN 'THURSDAY' THEN 5
        WHEN 'FRIDAY' THEN 6
    END,
    start_time
LIMIT 20;