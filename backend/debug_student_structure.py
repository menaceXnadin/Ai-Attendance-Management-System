import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get students from the backend to see what fields are available
response = requests.get('http://localhost:8000/api/students/', headers=headers)
if response.status_code == 200:
    students = response.json()
    if students:
        print("🔍 Raw backend student data structure:")
        print("=" * 50)
        sample_student = students[0]
        for key, value in sample_student.items():
            print(f"  {key}: {value} (type: {type(value)})")
        
        print("\n🎯 Faculty-related fields:")
        print("-" * 30)
        for key, value in sample_student.items():
            if 'faculty' in key.lower():
                print(f"  {key}: {value}")
                
        # Look for Mathematics students specifically
        print("\n📊 Students by faculty:")
        print("-" * 30)
        faculty_counts = {}
        for student in students[:10]:  # Check first 10 students
            faculty = student.get('faculty', 'Unknown')
            faculty_id = student.get('faculty_id', 'Unknown')
            if faculty not in faculty_counts:
                faculty_counts[faculty] = {'count': 0, 'faculty_id': faculty_id}
            faculty_counts[faculty]['count'] += 1
        
        for faculty, info in faculty_counts.items():
            print(f"  {faculty}: {info['count']} students (faculty_id: {info['faculty_id']})")
else:
    print(f"Error: {response.text}")
