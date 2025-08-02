import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get students with higher limit
response = requests.get('http://localhost:8000/api/students/?limit=200', headers=headers)
if response.status_code == 200:
    students = response.json()
    print(f"📊 API returned {len(students)} students with limit=200")
    
    # Look for students 111 and 115
    student_111 = next((s for s in students if s['id'] == 111), None)
    student_115 = next((s for s in students if s['id'] == 115), None)
    
    print(f"\n🔍 Search results:")
    print(f"Student 111: {'✅ Found' if student_111 else '❌ Missing'}")
    print(f"Student 115: {'✅ Found' if student_115 else '❌ Missing'}")
    
    # Check all Mathematics students
    math_students = [s for s in students if s.get('faculty_id') == 7]
    print(f"\n🎓 Mathematics students found: {len(math_students)}")
    for s in math_students:
        print(f"  - {s['name']} (ID: {s['id']}, Student ID: {s['student_id']})")
        
    # Get max ID to see if we're getting all students
    all_ids = [s['id'] for s in students]
    print(f"\n📊 Student ID range: {min(all_ids)} to {max(all_ids)}")
        
else:
    print(f"Error: {response.text}")
