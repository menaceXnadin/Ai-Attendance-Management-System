import requests
import json

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Test with student 112 which we know exists
response = requests.get('http://localhost:8000/api/students/112', headers=headers)
print(f'Student 112 fetch status: {response.status_code}')
if response.status_code == 200:
    student = response.json()
    print('✅ Student 112 data verification:')
    print(f'  Full Name: {student.get("user", {}).get("full_name")}')
    print(f'  Student ID: {student.get("student_id")}')
    print(f'  Faculty: {student.get("faculty")}')
    print(f'  Phone: {student.get("phone_number")}')
    print(f'  Emergency: {student.get("emergency_contact")}')
    print(f'  Semester: {student.get("semester")}')
    print(f'  Year: {student.get("year")}')
    print(f'  Batch: {student.get("batch")}')
else:
    print('Error:', response.text)
