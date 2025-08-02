import requests

# Login
login_data = {'email': 'admin@attendance.com', 'password': 'admin123'}
response = requests.post('http://localhost:8000/api/auth/login', json=login_data)
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get students and check their IDs
response = requests.get('http://localhost:8000/api/students/', headers=headers)
if response.status_code == 200:
    students = response.json()
    print(f"📊 API returned {len(students)} students")
    
    # Get the ID range
    student_ids = [s['id'] for s in students]
    print(f"🔢 Student ID range: {min(student_ids)} to {max(student_ids)}")
    
    # Check if students 111 and 115 are in the expected range
    if 111 <= max(student_ids):
        print("✅ Student 111 should be included based on ID range")
    else:
        print("❌ Student 111 is beyond the returned ID range")
        
    if 115 <= max(student_ids):
        print("✅ Student 115 should be included based on ID range")
    else:
        print("❌ Student 115 is beyond the returned ID range")
        
    # Show the last few students to see what's happening
    print(f"\n🔍 Last 5 students in API response:")
    for student in students[-5:]:
        print(f"  ID: {student['id']:3} | Name: {student['name']:25} | Faculty: {student['faculty']}")
        
else:
    print(f"Error: {response.text}")
