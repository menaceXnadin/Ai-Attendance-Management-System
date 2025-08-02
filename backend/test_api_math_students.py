import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get students with detailed response check
response = requests.get('http://localhost:8000/api/students/', headers=headers)
print(f"Response status: {response.status_code}")
print(f"Response headers: {dict(response.headers)}")

if response.status_code == 200:
    students = response.json()
    print(f"Total students returned by API: {len(students)}")
    
    # Look specifically for students 111 and 115
    student_111 = next((s for s in students if s['id'] == 111), None)
    student_115 = next((s for s in students if s['id'] == 115), None)
    
    print(f"\nStudent 111 in API response: {'✅ Found' if student_111 else '❌ Missing'}")
    if student_111:
        print(f"  Faculty: {student_111['faculty']}")
        print(f"  Faculty ID: {student_111['faculty_id']}")
    
    print(f"Student 115 in API response: {'✅ Found' if student_115 else '❌ Missing'}")
    if student_115:
        print(f"  Faculty: {student_115['faculty']}")
        print(f"  Faculty ID: {student_115['faculty_id']}")
        
    # Check Mathematics students in API
    math_students = [s for s in students if s.get('faculty_id') == 7]
    print(f"\nMathematics students in API: {len(math_students)}")
    for s in math_students:
        print(f"  - {s['name']} (ID: {s['id']}, Student ID: {s['student_id']})")
        
else:
    print(f"Error: {response.text}")
