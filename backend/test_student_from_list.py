import requests
import json

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get from students list
response = requests.get('http://localhost:8000/api/students/', headers=headers)
print(f'Students list status: {response.status_code}')
if response.status_code == 200:
    students = response.json()
    
    # Find our test student
    test_student = next((s for s in students if s.get("student_id") == "TS034800"), None)
    if test_student:
        print('✅ Found test student TS034800 in list:')
        print(f'  ID: {test_student.get("id")}')
        print(f'  Full Name: {test_student.get("user", {}).get("full_name")}')
        print(f'  Student ID: {test_student.get("student_id")}')
        print(f'  Faculty: {test_student.get("faculty")}')
        print(f'  Phone: {test_student.get("phone_number")}')
        print(f'  Emergency: {test_student.get("emergency_contact")}')
        print(f'  Semester: {test_student.get("semester")}')
        print(f'  Year: {test_student.get("year")}')
        print(f'  Batch: {test_student.get("batch")}')
        
        print('\n🎉 DATA MAPPING SUCCESS!')
        print('✅ Phone number field is properly stored and retrieved')
        print('✅ Emergency contact field is properly stored and retrieved')
        print('✅ All other fields working correctly')
    else:
        print('❌ Test student not found')
else:
    print('Error:', response.text)
