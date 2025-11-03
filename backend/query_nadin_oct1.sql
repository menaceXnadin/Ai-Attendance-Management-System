-- SQL Query: View Nadin Tamang's attendance for October 1, 2025

SELECT 
    u.full_name AS student_name,
    s.student_id AS student_number,
    subj.name AS subject_name,
    subj.code AS subject_code,
    ar.date AS attendance_date,
    ar.status,
    ar.method,
    ar.created_at,
    ar.time_in
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN users u ON s.user_id = u.id
JOIN subjects subj ON ar.subject_id = subj.id
WHERE u.full_name = 'Nadin Tamang'
  AND ar.date = '2025-10-01'
ORDER BY subj.name;


-- Alternative: Get all CS Semester 1 attendance for October 1, 2025

SELECT 
    u.full_name AS student_name,
    subj.name AS subject_name,
    ar.status,
    ar.method,
    ar.created_at
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN users u ON s.user_id = u.id
JOIN subjects subj ON ar.subject_id = subj.id
WHERE ar.date = '2025-10-01'
  AND s.faculty_id = 1
  AND s.semester = 1
ORDER BY u.full_name, subj.name;


-- Count records per student for October 1

SELECT 
    u.full_name AS student_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) AS present_count,
    COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) AS absent_count
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE ar.date = '2025-10-01'
  AND s.faculty_id = 1
  AND s.semester = 1
GROUP BY u.full_name
ORDER BY u.full_name;
