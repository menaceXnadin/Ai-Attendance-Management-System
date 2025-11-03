-- COMPREHENSIVE VERIFICATION: October 2025 Nadin Tamang Attendance
-- Run this in pgAdmin or psql to see actual database state

-- Part 1: Get Nadin's basic info
SELECT 
    u.full_name,
    s.student_id,
    s.faculty_id,
    s.semester
FROM students s
JOIN users u ON s.user_id = u.id
WHERE u.full_name = 'Nadin Tamang';


-- Part 2: Day-by-day breakdown (for Calendar view)
SELECT 
    ar.date,
    COUNT(*) as total_classes,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present,
    COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent,
    COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE u.full_name = 'Nadin Tamang'
  AND ar.date >= '2025-10-01'
  AND ar.date <= '2025-10-31'
GROUP BY ar.date
ORDER BY ar.date;


-- Part 3: Subject-wise breakdown (for Subject view)
SELECT 
    subj.name as subject_name,
    COUNT(*) as total_classes,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present,
    COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent,
    COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late,
    ROUND(COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1) as percentage
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN users u ON s.user_id = u.id
JOIN subjects subj ON ar.subject_id = subj.id
WHERE u.full_name = 'Nadin Tamang'
  AND ar.date >= '2025-10-01'
  AND ar.date <= '2025-10-31'
GROUP BY subj.name
ORDER BY subj.name;


-- Part 4: Overall summary
SELECT 
    COUNT(*) as total_classes,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as total_present,
    COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as total_absent,
    COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as total_late,
    ROUND(COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1) as attendance_percentage
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE u.full_name = 'Nadin Tamang'
  AND ar.date >= '2025-10-01'
  AND ar.date <= '2025-10-31';


-- Part 5: Detailed record dump (all records)
SELECT 
    ar.date,
    subj.name as subject,
    ar.status,
    ar.method,
    ar.created_at
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN users u ON s.user_id = u.id
JOIN subjects subj ON ar.subject_id = subj.id
WHERE u.full_name = 'Nadin Tamang'
  AND ar.date >= '2025-10-01'
  AND ar.date <= '2025-10-31'
ORDER BY ar.date, subj.name;
