#!/usr/bin/env python3

import requests
import json

BASE_URL = "http://localhost:8000"

def quick_test_student_after_update():
    """Quickly test if the updated student appears in the students list."""
    
    print("=== Quick verification of student update ===")
    
    # Login
    login_data = {"email": "admin@attendance.com", "password": "admin123"}
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get students list
    students_response = requests.get(f"{BASE_URL}/api/students/", headers=headers)
    if students_response.status_code != 200:
        print(f"❌ Failed to fetch students: {students_response.status_code}")
        return
        
    students = students_response.json()
    
    # Look for our updated student (ID 38)
    updated_student = None
    for student in students:
        if student["id"] == 38:
            updated_student = student
            break
    
    if updated_student:
        print("✅ Found updated student in list:")
        print(f"   ID: {updated_student['id']}")
        print(f"   Name: {updated_student['name']}")
        print(f"   Email: {updated_student['email']}")
        print(f"   Student ID: {updated_student['student_id']}")
        print(f"   Faculty: {updated_student['faculty']}")
        print(f"   Faculty ID: {updated_student['faculty_id']}")
        print(f"   Semester: {updated_student['semester']}")
        print(f"   Year: {updated_student['year']}")
        print(f"   Batch: {updated_student['batch']}")
        print(f"   Phone: {updated_student['phone_number']}")
        print(f"   Emergency: {updated_student['emergency_contact']}")
        
        # Check if the update actually persisted
        if "Updated Test Student" in updated_student["name"]:
            print("✅ UPDATE SUCCESSFUL! Data persisted to database.")
        else:
            print("❌ Update did not persist to database.")
    else:
        print("❌ Could not find student with ID 38")

if __name__ == "__main__":
    quick_test_student_after_update()
