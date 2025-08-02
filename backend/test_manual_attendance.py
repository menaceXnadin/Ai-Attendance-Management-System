import asyncio
import aiohttp
import json
from datetime import datetime

async def test_manual_attendance_flow():
    """Test the complete manual attendance marking flow."""
    
    base_url = "http://localhost:8000"
    
    # Test credentials for admin user
    admin_credentials = {
        "email": "admin@attendance.com",
        "password": "admin123"
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            # Step 1: Login as admin
            print("🔐 Step 1: Logging in as admin...")
            async with session.post(f"{base_url}/api/auth/login", json=admin_credentials) as response:
                if response.status != 200:
                    print(f"❌ Login failed: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
                    return
                
                login_data = await response.json()
                token = login_data.get("access_token")
                print(f"✅ Login successful, got token: {token[:20]}...")
            
            # Headers for authenticated requests
            headers = {"Authorization": f"Bearer {token}"}
            
            # Step 2: Get faculties
            print("\n📚 Step 2: Getting faculties...")
            async with session.get(f"{base_url}/api/faculties", headers=headers) as response:
                if response.status != 200:
                    print(f"❌ Failed to get faculties: {response.status}")
                    return
                
                faculties = await response.json()
                print(f"✅ Found {len(faculties)} faculties")
                if faculties:
                    first_faculty = faculties[0]
                    print(f"   Using faculty: {first_faculty['name']} (ID: {first_faculty['id']})")
            
            # Step 3: Get subjects for the faculty and semester
            print(f"\n📖 Step 3: Getting subjects for faculty {first_faculty['id']} semester 3...")
            params = {"faculty_id": first_faculty['id'], "semester": "3"}
            async with session.get(f"{base_url}/api/subjects/by-faculty-semester", params=params, headers=headers) as response:
                if response.status != 200:
                    print(f"❌ Failed to get subjects: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
                    return
                
                subjects = await response.json()
                print(f"✅ Found {len(subjects)} subjects for semester 3")
                if subjects:
                    first_subject = subjects[0]
                    print(f"   Using subject: {first_subject['name']} (ID: {first_subject['id']})")
            
            # Step 4: Get students for attendance marking
            print(f"\n👥 Step 4: Getting students for subject {first_subject['id']}...")
            today = datetime.now().strftime("%Y-%m-%d")
            params = {
                "faculty_id": first_faculty['id'], 
                "semester": 3,
                "subject_id": first_subject['id'], 
                "date": today
            }
            async with session.get(f"{base_url}/api/attendance/students-by-subject", params=params, headers=headers) as response:
                if response.status != 200:
                    print(f"❌ Failed to get students: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
                    return
                
                attendance_data = await response.json()
                students = attendance_data.get("students", [])
                print(f"✅ Found {len(students)} students for attendance")
                
                if len(students) >= 2:
                    # Take first 2 students for testing
                    test_students = students[:2]
                    print(f"   Testing with students: {[s['name'] for s in test_students]}")
                else:
                    print("⚠️  Not enough students for testing")
                    return
            
            # Step 5: Test manual attendance marking
            print(f"\n✏️  Step 5: Testing manual attendance marking...")
            
            # Prepare bulk attendance data
            bulk_data = {
                "subject_id": first_subject['id'],
                "date": today,
                "students": [
                    {"student_id": test_students[0]['id'], "status": "present"},
                    {"student_id": test_students[1]['id'], "status": "late"}
                ]
            }
            
            print(f"   Marking attendance for {len(bulk_data['students'])} students...")
            print(f"   Student 1: {test_students[0]['name']} -> PRESENT")
            print(f"   Student 2: {test_students[1]['name']} -> LATE")
            
            async with session.post(f"{base_url}/api/attendance/mark-bulk", json=bulk_data, headers=headers) as response:
                if response.status != 200:
                    print(f"❌ Failed to mark attendance: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
                    return
                
                result = await response.json()
                print(f"✅ Attendance marked successfully!")
                print(f"   Created records: {result.get('created_records', 0)}")
                print(f"   Updated records: {result.get('updated_records', 0)}")
            
            # Step 6: Verify the attendance was recorded
            print(f"\n🔍 Step 6: Verifying attendance records...")
            params = {
                "faculty_id": first_faculty['id'], 
                "semester": 3,
                "subject_id": first_subject['id'], 
                "date": today
            }
            async with session.get(f"{base_url}/api/attendance/students-by-subject", params=params, headers=headers) as response:
                if response.status != 200:
                    print(f"❌ Failed to verify attendance: {response.status}")
                    return
                
                verification_data = await response.json()
                verified_students = verification_data.get("students", [])
                
                print(f"✅ Verification complete:")
                for student in verified_students:
                    if student['id'] in [test_students[0]['id'], test_students[1]['id']]:
                        print(f"   {student['name']}: {student['status']}")
            
            print(f"\n🎉 Manual attendance marking test completed successfully!")
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")

if __name__ == "__main__":
    asyncio.run(test_manual_attendance_flow())
