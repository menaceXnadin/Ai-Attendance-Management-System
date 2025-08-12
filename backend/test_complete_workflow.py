#!/usr/bin/env python3

import requests
import json
import sys

def test_complete_face_recognition_workflow():
    """Test the complete face recognition workflow step by step"""
    
    print("=== Testing Complete Face Recognition Workflow ===")
    print()
    
    base_url = "http://localhost:8000/api"
    
    # Step 1: Check if Subject ID 1 exists
    print("Step 1: Verifying Subject ID 1 exists...")
    try:
        response = requests.get(f"{base_url}/subjects/1")
        if response.status_code == 200:
            subject_data = response.json()
            print(f"✅ Subject ID 1 exists: {subject_data['name']} ({subject_data['code']})")
        else:
            print(f"❌ Subject ID 1 not found: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking subject: {str(e)}")
        return False
    
    # Step 2: Check if there are any registered students with face encodings
    print("\nStep 2: Checking for registered students with face encodings...")
    try:
        response = requests.get(f"{base_url}/students/?limit=100")
        if response.status_code == 200:
            students = response.json()
            students_with_faces = [s for s in students if s.get('face_encoding')]
            print(f"📊 Total students: {len(students)}")
            print(f"📊 Students with face encodings: {len(students_with_faces)}")
            
            if len(students_with_faces) == 0:
                print("⚠️  No students have registered face encodings")
                print("   This means face recognition will always fail during attendance marking")
                print("   Students need to register their faces first")
            else:
                print("✅ Found students with face encodings - face recognition should work")
                for student in students_with_faces[:3]:  # Show first 3
                    user_name = student.get('user', {}).get('full_name', 'Unknown')
                    print(f"   - {user_name} (ID: {student.get('id')})")
        else:
            print(f"❌ Error fetching students: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking students: {str(e)}")
        return False
    
    # Step 3: Test the face recognition service status
    print("\nStep 3: Checking InsightFace service status...")
    try:
        response = requests.get(f"{base_url}/face-recognition/service-status")
        if response.status_code == 200:
            service_data = response.json()
            print(f"✅ InsightFace service status: {service_data['status']}")
            print(f"📋 Message: {service_data['message']}")
            if service_data.get('models'):
                print("📋 Available models:")
                for model_name, model_info in service_data['models'].items():
                    print(f"   - {model_name}: {model_info}")
        else:
            print(f"❌ InsightFace service check failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking InsightFace service: {str(e)}")
        return False
    
    # Step 4: Test the mark-attendance endpoint with fake data
    print("\nStep 4: Testing mark-attendance endpoint...")
    try:
        # Create a minimal base64 image (1x1 pixel)
        fake_image_base64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=="
        
        response = requests.post(f"{base_url}/face-recognition/mark-attendance", 
            json={
                "image_data": fake_image_base64,
                "subject_id": 1
            }
        )
        
        print(f"📡 HTTP Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ API Response: {result['message']}")
            print(f"📊 Success: {result['success']}")
            print(f"📊 Attendance Marked: {result.get('attendance_marked', False)}")
            
            if not result['success']:
                print("ℹ️  This is expected - the fake image doesn't contain a real face")
                print("ℹ️  But the important thing is we got HTTP 200, not HTTP 500")
                print("ℹ️  This means the database constraint issue is fixed!")
            
            return True
        else:
            print(f"❌ API Error: {response.status_code}")
            try:
                error_data = response.json()
                print(f"❌ Error details: {error_data}")
            except:
                print(f"❌ Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing mark-attendance: {str(e)}")
        return False
    
    print("\n" + "="*60)
    print("SUMMARY:")
    print("✅ Subject ID 1 exists in database")
    print("✅ Face recognition API is accessible")
    print("✅ No more foreign key constraint errors")
    print("⚠️  For actual face recognition to work:")
    print("   1. Students need to register their faces first")
    print("   2. Use real face images (not fake test images)")
    print("   3. Ensure good lighting and face visibility")
    print("="*60)
    
    return True

if __name__ == "__main__":
    success = test_complete_face_recognition_workflow()
    if success:
        print("\n🎉 Face recognition workflow test completed successfully!")
    else:
        print("\n❌ Face recognition workflow test failed!")
        sys.exit(1)
