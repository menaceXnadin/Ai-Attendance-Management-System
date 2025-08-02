#!/usr/bin/env python3

import asyncio
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def test_student_update():
    """Test student update functionality with proper logging."""
    
    print("=== Testing Student Update Functionality ===")
    print(f"Timestamp: {datetime.now()}")
    print()
    
    # Step 1: Login as admin to get auth token
    print("1. Logging in as admin...")
    login_data = {
        "email": "admin@attendance.com",
        "password": "admin123"
    }
    
    try:
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("✅ Admin login successful")
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return
    
    # Step 2: Get list of students to find one to update
    print("\n2. Fetching students list...")
    try:
        students_response = requests.get(f"{BASE_URL}/api/students/", headers=headers)
        if students_response.status_code == 200:
            students = students_response.json()
            if students:
                test_student = students[0]  # Take the first student
                student_id = test_student["id"]
                print(f"✅ Found test student: ID {student_id}, Name: {test_student.get('name', 'Unknown')}")
                print(f"   Current data: {json.dumps(test_student, indent=2)}")
            else:
                print("❌ No students found")
                return
        else:
            print(f"❌ Failed to fetch students: {students_response.status_code}")
            return
    except Exception as e:
        print(f"❌ Error fetching students: {str(e)}")
        return
    
    # Step 3: Prepare update data
    print(f"\n3. Preparing update data for student ID {student_id}...")
    
    # Get current timestamp for unique values
    timestamp = int(datetime.now().timestamp())
    
    update_data = {
        "full_name": f"Updated Test Student {timestamp}",
        "email": f"updated.test.{timestamp}@bca.edu.np",
        "student_id": f"UTS-{timestamp}",
        "faculty_id": 1,  # Computer Science faculty
        "semester": 3,
        "year": 2,
        "batch": 2024,
        "phone_number": f"98{timestamp % 100000000:08d}",
        "emergency_contact": f"97{timestamp % 100000000:08d}"
    }
    
    print(f"   Update data: {json.dumps(update_data, indent=2)}")
    
    # Step 4: Send update request
    print(f"\n4. Sending update request...")
    try:
        update_response = requests.put(
            f"{BASE_URL}/api/students/{student_id}", 
            json=update_data, 
            headers=headers
        )
        
        print(f"   Response status: {update_response.status_code}")
        print(f"   Response body: {update_response.text}")
        
        if update_response.status_code == 200:
            updated_student = update_response.json()
            print("✅ Student update successful!")
            print(f"   Updated student data: {json.dumps(updated_student, indent=2)}")
        else:
            print(f"❌ Update failed: {update_response.status_code}")
            return
            
    except Exception as e:
        print(f"❌ Error during update: {str(e)}")
        return
    
    # Step 5: Verify update by fetching the student again
    print(f"\n5. Verifying update by fetching student again...")
    try:
        verify_response = requests.get(f"{BASE_URL}/api/students/{student_id}", headers=headers)
        if verify_response.status_code == 200:
            verified_student = verify_response.json()
            print("✅ Verification fetch successful!")
            print(f"   Verified student data: {json.dumps(verified_student, indent=2)}")
            
            # Check if specific fields were updated
            checks = [
                ("full_name", update_data["full_name"]),
                ("email", update_data["email"]),
                ("student_id", update_data["student_id"]),
                ("semester", update_data["semester"]),
                ("year", update_data["year"]),
                ("batch", update_data["batch"]),
                ("phone_number", update_data["phone_number"]),
                ("emergency_contact", update_data["emergency_contact"])
            ]
            
            print("\n6. Field-by-field verification:")
            for field_name, expected_value in checks:
                if field_name == "full_name":
                    actual_value = verified_student.get("name")
                elif field_name == "student_id":
                    actual_value = verified_student.get("rollNo", "").replace("R-", "")
                else:
                    actual_value = verified_student.get(field_name)
                
                if actual_value == expected_value:
                    print(f"   ✅ {field_name}: {actual_value}")
                else:
                    print(f"   ❌ {field_name}: expected '{expected_value}', got '{actual_value}'")
            
        else:
            print(f"❌ Verification failed: {verify_response.status_code}")
            
    except Exception as e:
        print(f"❌ Error during verification: {str(e)}")
    
    print(f"\n=== Test completed at {datetime.now()} ===")

if __name__ == "__main__":
    asyncio.run(test_student_update())
