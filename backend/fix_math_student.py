import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Update student 111 to Mathematics (faculty_id: 7)
print("🔧 Fixing student 111 faculty to Mathematics...")

# First, let's check what the update endpoint expects
# Get the current student data
response = requests.get('http://localhost:8000/api/students/', headers=headers)
students = response.json()
student_111 = next((s for s in students if s['id'] == 111), None)

if student_111:
    print(f"Found student: {student_111['name']}")
    print(f"Current faculty: {student_111['faculty']} (ID: {student_111['faculty_id']})")
    
    # Try to update via database query instead since the API endpoint might have issues
    print("Updating in database directly...")
    
else:
    print("Student 111 not found")
