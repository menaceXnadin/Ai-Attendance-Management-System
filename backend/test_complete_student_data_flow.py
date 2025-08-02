#!/usr/bin/env python3
"""
Test complete student data flow - Frontend Form → API → Backend → Database
"""
import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "admin@attendance.com"
ADMIN_PASSWORD = "admin123"

def test_complete_student_flow():
    """Test the complete student creation flow with all fields"""
    
    print("🚀 Testing Complete Student Data Flow")
    print("=" * 50)
    
    # Step 1: Login as admin
    print("\n1️⃣ Logging in as admin...")
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        return False
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Admin login successful")
    
    # Step 2: Get faculties for faculty_id
    print("\n2️⃣ Fetching faculties...")
    response = requests.get(f"{BASE_URL}/faculties/", headers=headers)
    if response.status_code != 200:
        print(f"❌ Failed to fetch faculties: {response.text}")
        return False
    
    faculties = response.json()
    if not faculties:
        print("❌ No faculties found")
        return False
    
    faculty_id = faculties[0]["id"]
    faculty_name = faculties[0]["name"]
    print(f"✅ Using faculty: {faculty_name} (ID: {faculty_id})")
    
    # Step 3: Create student with ALL fields (simulating frontend form data)
    print("\n3️⃣ Creating student with complete data...")
    
    # This simulates what the frontend form would send
    student_data = {
        "user": {
            "email": f"test.student.{datetime.now().strftime('%H%M%S')}@example.com",
            "full_name": "Test Student Complete",
            "password": "password123"
        },
        "student_id": f"TS{datetime.now().strftime('%H%M%S')}",
        "faculty_id": faculty_id,
        "semester": 3,
        "year": 2025,
        "batch": 2023,
        "phone_number": "+977-9812345678",
        "emergency_contact": "+977-9887654321"
    }
    
    print("📋 Student data being sent:")
    print(json.dumps(student_data, indent=2))
    
    response = requests.post(f"{BASE_URL}/students/", 
                           headers=headers, 
                           json=student_data)
    
    if response.status_code != 200:
        print(f"❌ Student creation failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    created_student = response.json()
    student_db_id = created_student["id"]
    print(f"✅ Student created successfully with ID: {student_db_id}")
    
    # Step 4: Verify data in database
    print("\n4️⃣ Verifying student data in database...")
    
    # Add a small delay to allow database to sync
    import time
    time.sleep(1)
    
    # First try to get all students to see if our student is there
    response = requests.get(f"{BASE_URL}/students/", headers=headers)
    if response.status_code == 200:
        all_students = response.json()
        print(f"📊 Found {len(all_students)} students total")
        
        # Debug: show the last few students
        print("🔍 Last 3 students in database:")
        for student in all_students[-3:]:
            print(f"   ID: {student.get('id')}, Student ID: {student.get('student_id')}, Name: {student.get('user', {}).get('full_name', 'N/A')}")
        
        found_student = next((s for s in all_students if str(s["id"]) == str(student_db_id)), None)
        if found_student:
            print(f"✅ Student found in students list")
            fetched_student = found_student
        else:
            print(f"❌ Student with ID {student_db_id} not found in students list")
            print(f"   Looking for ID: {student_db_id} (type: {type(student_db_id)})")
            # Try to find by student_id instead
            found_student = next((s for s in all_students if s.get("student_id") == student_data["student_id"]), None)
            if found_student:
                print(f"✅ Found student by student_id: {student_data['student_id']}")
                fetched_student = found_student
            else:
                print(f"❌ Student not found by student_id either")
                return False
    else:
        print(f"❌ Failed to fetch students list: {response.text}")
        return False
    
    # Also try individual fetch
    response = requests.get(f"{BASE_URL}/students/{student_db_id}", headers=headers)
    if response.status_code == 200:
        individual_student = response.json()
        print(f"✅ Individual student fetch also successful")
    else:
        print(f"⚠️  Individual student fetch failed: {response.text}")
        print("   But continuing with list data...")
    
    # Verify all fields are properly stored
    print("\n📊 Data Verification:")
    print("-" * 30)
    
    checks = [
        ("Email", student_data["user"]["email"], fetched_student["user"]["email"]),
        ("Full Name", student_data["user"]["full_name"], fetched_student["user"]["full_name"]),
        ("Student ID", student_data["student_id"], fetched_student["student_id"]),
        ("Faculty ID", student_data["faculty_id"], fetched_student["faculty_id"]),
        ("Faculty Name", faculty_name, fetched_student["faculty"]),
        ("Semester", student_data["semester"], fetched_student["semester"]),
        ("Year", student_data["year"], fetched_student["year"]),
        ("Batch", student_data["batch"], fetched_student["batch"]),
        ("Phone Number", student_data["phone_number"], fetched_student.get("phone_number")),
        ("Emergency Contact", student_data["emergency_contact"], fetched_student.get("emergency_contact"))
    ]
    
    all_passed = True
    for field_name, expected, actual in checks:
        if expected == actual:
            print(f"✅ {field_name}: {actual}")
        else:
            print(f"❌ {field_name}: Expected '{expected}', Got '{actual}'")
            all_passed = False
    
    # Step 5: Test frontend API compatibility
    print("\n5️⃣ Testing frontend API response format...")
    
    # This tests what the frontend students.getAll() would receive
    response = requests.get(f"{BASE_URL}/students/", headers=headers)
    if response.status_code == 200:
        students_list = response.json()
        found_student = next((s for s in students_list if s["id"] == student_db_id), None)
        
        if found_student:
            print("✅ Student found in list endpoint")
            print(f"   Name: {found_student.get('user', {}).get('full_name', 'N/A')}")
            print(f"   Faculty: {found_student.get('faculty', 'N/A')}")
            print(f"   Phone: {found_student.get('phone_number', 'N/A')}")
            print(f"   Emergency: {found_student.get('emergency_contact', 'N/A')}")
        else:
            print("❌ Student not found in list endpoint")
            all_passed = False
    else:
        print(f"❌ Failed to fetch students list: {response.text}")
        all_passed = False
    
    # Final result
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        print("✅ Complete data flow working correctly")
        print("✅ All fields properly mapped and stored")
        print("✅ Frontend-Backend-Database integration verified")
    else:
        print("❌ SOME TESTS FAILED!")
        print("⚠️  Data mapping issues detected")
    
    return all_passed

if __name__ == "__main__":
    success = test_complete_student_flow()
    exit(0 if success else 1)
