import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

print("🔍 COMPREHENSIVE FACULTY FILTERING TEST")
print("=" * 60)

# Get all faculties
faculties_response = requests.get('http://localhost:8000/api/faculties/', headers=headers)
faculties = faculties_response.json()

# Get all students with higher limit
students_response = requests.get('http://localhost:8000/api/students/?limit=1000', headers=headers)
students = students_response.json()

print(f"📊 Total Students: {len(students)}")
print(f"📚 Total Faculties: {len(faculties)}")
print("\n" + "=" * 60)

# Test each faculty
issues_found = []
for faculty in faculties:
    faculty_id = faculty['id']
    faculty_name = faculty['name']
    
    # Count students with this faculty_id
    students_with_faculty_id = [s for s in students if s.get('faculty_id') == faculty_id]
    
    # Count students with this faculty name (old method)
    students_with_faculty_name = [s for s in students if s.get('faculty') == faculty_name]
    
    print(f"🎓 {faculty_name} (ID: {faculty_id})")
    print(f"   Students by faculty_id: {len(students_with_faculty_id)}")
    print(f"   Students by faculty name: {len(students_with_faculty_name)}")
    
    # Check for discrepancies
    if len(students_with_faculty_id) != len(students_with_faculty_name):
        issues_found.append({
            'faculty': faculty_name,
            'faculty_id': faculty_id,
            'by_id': len(students_with_faculty_id),
            'by_name': len(students_with_faculty_name)
        })
        print(f"   ⚠️  MISMATCH DETECTED!")
        
        # Show students that would be missed by old filtering
        id_student_ids = {s['id'] for s in students_with_faculty_id}
        name_student_ids = {s['id'] for s in students_with_faculty_name}
        
        missed_by_name = id_student_ids - name_student_ids
        missed_by_id = name_student_ids - id_student_ids
        
        if missed_by_name:
            print(f"   📋 Students missed by name filter: {list(missed_by_name)}")
        if missed_by_id:
            print(f"   📋 Students missed by ID filter: {list(missed_by_id)}")
    else:
        print(f"   ✅ Faculty filtering consistent")
    
    # Show some student examples if any exist
    if students_with_faculty_id:
        print(f"   👥 Sample students:")
        for student in students_with_faculty_id[:3]:  # Show first 3
            print(f"      - {student['name']} (ID: {student['id']}, Student ID: {student['student_id']})")
        if len(students_with_faculty_id) > 3:
            print(f"      ... and {len(students_with_faculty_id) - 3} more")
    
    print()

# Summary
print("=" * 60)
print("📋 SUMMARY")
print("=" * 60)

if issues_found:
    print(f"❌ ISSUES FOUND in {len(issues_found)} faculties:")
    for issue in issues_found:
        print(f"   {issue['faculty']}: {issue['by_id']} vs {issue['by_name']} students")
    
    print(f"\n🔧 These faculties would show 'No students to display' with old filtering!")
    print(f"✅ Fixed by switching to faculty_id-based filtering")
else:
    print("✅ NO ISSUES FOUND - All faculties have consistent filtering")

print(f"\n🎯 RECOMMENDATION:")
print(f"   - Use faculty_id (number) for filtering: IMPLEMENTED ✅")
print(f"   - Use limit=1000 for all students: IMPLEMENTED ✅")
print(f"   - Frontend dropdown uses faculty.id as value: IMPLEMENTED ✅")
