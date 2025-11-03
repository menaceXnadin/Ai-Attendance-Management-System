-- Query 1: All attendance records for Operating Systems 1 students
-- Shows every attendance record with student details
SELECT 
    s.student_id,
    s.name,
    ar.date,
    ar.status,
    ar.method,
    ar.notes,
    ar.confidence_score,
    sub.name AS subject_name,
    sub.code AS subject_code
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN subjects sub ON ar.subject_id = sub.id
WHERE sub.code = 'COM0105'
ORDER BY ar.date DESC, s.student_id;


-- Query 2: Summary of attendance by student
-- Shows total present, absent, late, cancelled for each student
SELECT 
    s.student_id,
    s.name,
    COUNT(*) AS total_records,
    SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present_count,
    SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
    SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) AS late_count,
    SUM(CASE WHEN ar.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
    ROUND(
        (SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END)::numeric / 
         NULLIF(COUNT(*), 0)) * 100, 
        2
    ) AS attendance_percentage
FROM students s
JOIN attendance_records ar ON ar.student_id = s.id
JOIN subjects sub ON ar.subject_id = sub.id
WHERE sub.code = 'COM0105'
GROUP BY s.id, s.student_id, s.name
ORDER BY s.student_id;


-- Query 3: Only cancelled attendance records
-- Shows details of cancelled classes
SELECT 
    s.student_id,
    s.name,
    ar.date,
    ar.status,
    ar.notes,
    ae.title AS event_title,
    ae.notification_settings->>'cancellation_reason' AS cancellation_reason
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN subjects sub ON ar.subject_id = sub.id
LEFT JOIN academic_events ae ON 
    DATE(ae.start_date) = DATE(ar.date) 
    AND ae.event_type = 'CANCELLED_CLASS'
    AND ae.subject_id = sub.id
WHERE sub.code = 'COM0105'
  AND ar.status = 'cancelled'
ORDER BY ar.date DESC;


-- Query 4: Attendance records for specific date (Nov 3, 2025)
-- Replace date as needed
SELECT 
    s.student_id,
    s.name,
    ar.date,
    ar.status,
    ar.method,
    ar.notes
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN subjects sub ON ar.subject_id = sub.id
WHERE sub.code = 'COM0105'
  AND DATE(ar.date) = '2025-11-03'
ORDER BY s.student_id;


-- Query 5: Students enrolled in Operating Systems 1 with their latest attendance
-- Shows all enrolled students and their most recent attendance status
SELECT 
    s.student_id,
    s.name,
    s.faculty_id,
    s.semester,
    ar_latest.date AS last_attendance_date,
    ar_latest.status AS last_status
FROM students s
CROSS JOIN LATERAL (
    SELECT ar.date, ar.status
    FROM attendance_records ar
    JOIN subjects sub ON ar.subject_id = sub.id
    WHERE ar.student_id = s.id
      AND sub.code = 'COM0105'
    ORDER BY ar.date DESC
    LIMIT 1
) ar_latest
WHERE s.faculty_id = 1 
  AND s.semester = 1
ORDER BY s.student_id;
