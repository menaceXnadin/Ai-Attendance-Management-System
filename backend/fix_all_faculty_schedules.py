#!/usr/bin/env python3

"""
Create comprehensive schedules for ALL faculties to fix the system-wide schedule issue
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import requests
import json
from datetime import time

def create_comprehensive_schedules():
    """Create schedules for all major faculties"""
    
    base_url = "http://localhost:8000"
    
    # Login as admin to create schedules
    admin_login = {
        "username": "admin@example.com",
        "password": "admin123"
    }
    
    print("🔐 Logging in as admin...")
    login_response = requests.post(f"{base_url}/auth/login", data=admin_login)
    
    if login_response.status_code != 200:
        print(f"❌ Admin login failed: {login_response.status_code}")
        return
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("✅ Admin login successful")
    
    # Get faculties
    faculties_response = requests.get(f"{base_url}/faculties", headers=headers)
    if faculties_response.status_code != 200:
        print(f"❌ Failed to get faculties: {faculties_response.status_code}")
        return
    
    faculties = faculties_response.json()
    print(f"📚 Found {len(faculties)} faculties")
    
    # Get subjects for each faculty
    subjects_response = requests.get(f"{base_url}/subjects", headers=headers)
    if subjects_response.status_code != 200:
        print(f"❌ Failed to get subjects: {subjects_response.status_code}")
        return
    
    all_subjects = subjects_response.json()
    
    # Comprehensive schedule templates for different faculties
    schedule_templates = {
        "Computer Science": {
            "semester_1": [
                {"subject_code": "CS101", "day": "MONDAY", "start": "09:00", "end": "10:00", "classroom": "CS-101"},
                {"subject_code": "CS102", "day": "MONDAY", "start": "10:00", "end": "11:00", "classroom": "CS-102"},
                {"subject_code": "CS103", "day": "MONDAY", "start": "13:00", "end": "14:00", "classroom": "CS-103"},
                {"subject_code": "CS104", "day": "MONDAY", "start": "14:00", "end": "15:00", "classroom": "CS-104"},
                {"subject_code": "CS105", "day": "MONDAY", "start": "15:00", "end": "16:00", "classroom": "CS-105"},
            ]
        },
        "Mathematics": {
            "semester_1": [
                {"subject_code": "MAT0101", "day": "MONDAY", "start": "10:00", "end": "11:00", "classroom": "MATH-101"},
                {"subject_code": "MAT0102", "day": "MONDAY", "start": "13:00", "end": "14:00", "classroom": "MATH-102"},
                {"subject_code": "MAT0103", "day": "MONDAY", "start": "14:00", "end": "15:00", "classroom": "MATH-103"},
                {"subject_code": "MAT0104", "day": "MONDAY", "start": "15:00", "end": "16:00", "classroom": "MATH-104"},
                {"subject_code": "MAT0404", "day": "MONDAY", "start": "09:00", "end": "10:00", "classroom": "MATH-105"},
            ]
        },
        "Electronics Engineering": {
            "semester_1": [
                {"subject_code": "ECE101", "day": "MONDAY", "start": "09:00", "end": "10:00", "classroom": "ECE-101"},
                {"subject_code": "ECE102", "day": "MONDAY", "start": "10:00", "end": "11:00", "classroom": "ECE-102"},
                {"subject_code": "ECE103", "day": "MONDAY", "start": "13:00", "end": "14:00", "classroom": "ECE-103"},
                {"subject_code": "ECE104", "day": "MONDAY", "start": "14:00", "end": "15:00", "classroom": "ECE-104"},
                {"subject_code": "ECE105", "day": "MONDAY", "start": "15:00", "end": "16:00", "classroom": "ECE-105"},
            ]
        },
        "Physics": {
            "semester_1": [
                {"subject_code": "PHY101", "day": "MONDAY", "start": "09:00", "end": "10:00", "classroom": "PHY-101"},
                {"subject_code": "PHY102", "day": "MONDAY", "start": "10:00", "end": "11:00", "classroom": "PHY-102"},
                {"subject_code": "PHY103", "day": "MONDAY", "start": "13:00", "end": "14:00", "classroom": "PHY-103"},
                {"subject_code": "PHY104", "day": "MONDAY", "start": "14:00", "end": "15:00", "classroom": "PHY-104"},
                {"subject_code": "PHY105", "day": "MONDAY", "start": "15:00", "end": "16:00", "classroom": "PHY-105"},
            ]
        }
    }
    
    # Create schedules for each faculty
    created_count = 0
    
    for faculty in faculties:
        faculty_name = faculty["name"]
        faculty_id = faculty["id"]
        
        print(f"\n🏫 Processing {faculty_name} (ID: {faculty_id})")
        
        if faculty_name not in schedule_templates:
            print(f"⚠️ No schedule template for {faculty_name}, skipping")
            continue
        
        # Get subjects for this faculty
        faculty_subjects = [s for s in all_subjects if s["faculty_id"] == faculty_id]
        print(f"📖 Found {len(faculty_subjects)} subjects for {faculty_name}")
        
        if not faculty_subjects:
            print(f"⚠️ No subjects found for {faculty_name}")
            continue
        
        # Create semester 1 schedules
        schedule_template = schedule_templates[faculty_name]["semester_1"]
        
        for i, template in enumerate(schedule_template):
            if i < len(faculty_subjects):
                subject = faculty_subjects[i]
                
                schedule_data = {
                    "subject_id": subject["id"],
                    "faculty_id": faculty_id,
                    "day_of_week": template["day"],
                    "start_time": template["start"],
                    "end_time": template["end"],
                    "semester": 1,
                    "academic_year": 2025,
                    "classroom": template["classroom"],
                    "instructor_name": f"Prof. {faculty_name[:3].upper()}",
                    "is_active": True,
                    "notes": f"Semester 1 {subject['name']}"
                }
                
                print(f"   📅 Creating: {template['start']}-{template['end']} {subject['name']}")
                
                create_response = requests.post(
                    f"{base_url}/schedules", 
                    json=schedule_data, 
                    headers=headers
                )
                
                if create_response.status_code == 201:
                    created_count += 1
                    print(f"   ✅ Created schedule for {subject['name']}")
                else:
                    print(f"   ❌ Failed to create schedule: {create_response.status_code}")
                    if create_response.status_code == 422:
                        print(f"      Error: {create_response.json()}")
    
    print(f"\n🎉 Successfully created {created_count} schedules!")
    print("✅ All faculties should now have proper Monday schedules")

if __name__ == "__main__":
    create_comprehensive_schedules()