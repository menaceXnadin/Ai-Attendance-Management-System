import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get faculties
response = requests.get('http://localhost:8000/api/faculties/', headers=headers)
if response.status_code == 200:
    faculties = response.json()
    print("🎓 Available Faculties:")
    print("=" * 40)
    for faculty in faculties:
        print(f"  ID: {faculty['id']}, Name: {faculty['name']}")
        
    # Check for Mathematics specifically
    math_faculty = next((f for f in faculties if 'math' in f['name'].lower()), None)
    if math_faculty:
        print(f"\n🔍 Mathematics Faculty Found:")
        print(f"  ID: {math_faculty['id']}, Name: {math_faculty['name']}")
        
        # Now check students in Mathematics
        response = requests.get('http://localhost:8000/api/students/', headers=headers)
        if response.status_code == 200:
            students = response.json()
            math_students = [s for s in students if s.get('faculty_id') == math_faculty['id']]
            print(f"  Students in Mathematics: {len(math_students)}")
            for student in math_students:
                print(f"    - {student['name']} (ID: {student['student_id']})")
    else:
        print("\n❌ Mathematics faculty not found")
else:
    print(f"Error getting faculties: {response.text}")
