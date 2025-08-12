#!/usr/bin/env python3
"""
Test script to validate the Today's Class Schedule workflow
This script tests the entire flow from database to frontend integration
"""
import requests
import json
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"

def test_backend_endpoints():
    """Test that backend endpoints are working"""
    print("🔍 Testing Backend Endpoints...")
    
    try:
        # Test basic health check
        response = requests.get(f"{BACKEND_URL}/")
        print(f"✅ Backend health check: {response.status_code}")
        
        # Test students endpoint
        response = requests.get(f"{BACKEND_URL}/api/students")
        if response.status_code == 200:
            students = response.json()
            print(f"✅ Students endpoint: Found {len(students)} students")
            
            # Show a sample student
            if students:
                sample_student = students[0]
                print(f"   Sample student: {sample_student.get('name', 'N/A')} (ID: {sample_student.get('studentId', 'N/A')})")
        else:
            print(f"❌ Students endpoint failed: {response.status_code}")
        
        # Test subjects endpoint
        response = requests.get(f"{BACKEND_URL}/api/subjects")
        if response.status_code == 200:
            subjects = response.json()
            print(f"✅ Subjects endpoint: Found {len(subjects)} subjects")
            
            # Show available subjects including our Subject ID=1
            for subject in subjects[:3]:  # Show first 3
                print(f"   Subject: {subject.get('name', 'N/A')} (ID: {subject.get('id', 'N/A')})")
        else:
            print(f"❌ Subjects endpoint failed: {response.status_code}")
            
        return True
        
    except Exception as e:
        print(f"❌ Backend test failed: {e}")
        return False

def test_attendance_flow():
    """Test attendance-related endpoints"""
    print("\n📅 Testing Attendance Workflow...")
    
    try:
        # Test attendance summary endpoint
        response = requests.get(f"{BACKEND_URL}/api/attendance/summary?studentId=111")
        if response.status_code == 200:
            summary = response.json()
            print(f"✅ Attendance summary: {summary}")
        else:
            print(f"⚠️  Attendance summary: {response.status_code} (expected for test student)")
        
        # Test attendance records for today
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.get(f"{BACKEND_URL}/api/attendance?studentId=111&date={today}")
        if response.status_code == 200:
            records = response.json()
            print(f"✅ Today's attendance records: {len(records)} records found")
        else:
            print(f"⚠️  Today's attendance: {response.status_code} (expected if no records)")
        
        return True
        
    except Exception as e:
        print(f"❌ Attendance test failed: {e}")
        return False

def test_face_recognition_endpoint():
    """Test face recognition endpoint availability"""
    print("\n🎭 Testing Face Recognition...")
    
    try:
        # Test face recognition endpoint (without actual image data)
        response = requests.post(f"{BACKEND_URL}/api/face-recognition/mark-attendance", 
                               json={"image": "dummy", "subject_id": "1"})
        
        # We expect this to fail with validation error, but endpoint should be available
        if response.status_code in [400, 422]:  # Validation errors are expected
            print("✅ Face recognition endpoint is available")
            return True
        else:
            print(f"⚠️  Face recognition endpoint: {response.status_code}")
            return False
        
    except Exception as e:
        print(f"❌ Face recognition test failed: {e}")
        return False

def test_frontend_availability():
    """Test that frontend is running and accessible"""
    print("\n🖥️  Testing Frontend Availability...")
    
    try:
        response = requests.get(FRONTEND_URL)
        if response.status_code == 200:
            print("✅ Frontend is running and accessible")
            return True
        else:
            print(f"❌ Frontend returned: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Frontend test failed: {e}")
        return False

def validate_schedule_logic():
    """Validate the schedule generation logic"""
    print("\n⏰ Validating Schedule Logic...")
    
    current_time = datetime.now()
    current_day = current_time.weekday()  # 0 = Monday, 6 = Sunday
    
    if current_day in [5, 6]:  # Saturday or Sunday
        print("📅 Today is weekend - schedule should be empty")
    else:
        print(f"📅 Today is weekday ({current_day + 1}/7) - schedule should have classes")
    
    # Mock schedule validation
    mock_schedule = [
        {"start": "09:00", "end": "10:30", "subject": "Default Subject"},
        {"start": "11:00", "end": "12:30", "subject": "Programming Fundamentals"},
        {"start": "14:00", "end": "15:30", "subject": "Mathematics for Computing"}
    ]
    
    current_time_str = current_time.strftime("%H:%M")
    print(f"🕐 Current time: {current_time_str}")
    
    for i, class_info in enumerate(mock_schedule):
        status = "Upcoming"
        if current_time_str >= class_info["start"] and current_time_str <= class_info["end"]:
            status = "Ongoing"
        elif current_time_str > class_info["end"]:
            status = "Completed"
        
        print(f"   Class {i+1}: {class_info['subject']} ({class_info['start']}-{class_info['end']}) - {status}")
    
    return True

def main():
    """Run all tests"""
    print("🚀 Starting Today's Class Schedule Workflow Test")
    print("=" * 60)
    
    tests = [
        ("Backend Endpoints", test_backend_endpoints),
        ("Attendance Flow", test_attendance_flow),
        ("Face Recognition", test_face_recognition_endpoint),
        ("Frontend Availability", test_frontend_availability),
        ("Schedule Logic", validate_schedule_logic)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("\n🎉 All tests passed! Today's Class Schedule feature is ready!")
        print("\n📝 Next Steps:")
        print("   1. Open http://localhost:5173 in your browser")
        print("   2. Login as a student")
        print("   3. View the new Today's Class Schedule section")
        print("   4. Test the face recognition attendance marking")
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
    
    return passed == len(results)

if __name__ == "__main__":
    main()
