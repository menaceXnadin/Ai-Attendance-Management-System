import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get all students and show the latest ones
response = requests.get('http://localhost:8000/api/students/', headers=headers)
if response.status_code == 200:
    students = response.json()
    
    print(f"📊 Total students: {len(students)}")
    print("\n🕒 Latest 10 students:")
    print("-" * 80)
    
    # Sort by ID (assuming higher ID = more recent)
    students_sorted = sorted(students, key=lambda x: x['id'], reverse=True)
    
    for student in students_sorted[:10]:
        print(f"ID: {student['id']:3} | Name: {student['name']:25} | Faculty: {student['faculty']:30} | Faculty_ID: {student['faculty_id']}")
    
    print("\n🔍 Students in each faculty:")
    print("-" * 50)
    faculty_counts = {}
    for student in students:
        faculty_id = student.get('faculty_id')
        faculty_name = student.get('faculty', 'Unknown')
        if faculty_id not in faculty_counts:
            faculty_counts[faculty_id] = {'name': faculty_name, 'count': 0}
        faculty_counts[faculty_id]['count'] += 1
    
    for faculty_id, info in sorted(faculty_counts.items()):
        print(f"Faculty ID {faculty_id:2}: {info['count']:3} students - {info['name']}")
        
else:
    print(f"Error: {response.text}")
