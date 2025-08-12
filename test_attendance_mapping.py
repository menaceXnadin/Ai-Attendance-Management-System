#!/usr/bin/env python3
"""
Test script to check attendance data mapping
"""
import requests
import json

def test_attendance_mapping():
    """Test the attendance data mapping to understand the field structure"""
    
    print("🔍 Testing Attendance Data Mapping")
    print("=" * 50)
    
    base_url = "http://localhost:8000"
    
    # Login
    login_data = {"email": "admin@attendance.com", "password": "admin123"}
    response = requests.post(f"{base_url}/api/auth/login", json=login_data)
    token = response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Get attendance data
    response = requests.get(f"{base_url}/api/attendance/", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"📊 Found {len(data)} attendance records")
        
        if data:
            # Analyze the first few records
            for i, record in enumerate(data[:3]):
                print(f"\n📝 Record {i+1}:")
                print(f"   Raw data: {json.dumps(record, indent=2)}")
                
                # Check all possible subject ID fields
                subject_fields = ['subject_id', 'subjectId', 'classId', 'class_id']
                for field in subject_fields:
                    value = record.get(field)
                    if value is not None:
                        print(f"   ✅ {field}: {value} (type: {type(value)})")
                    else:
                        print(f"   ❌ {field}: None")
        
        # Test the frontend API client mapping
        print(f"\n🔧 Testing Frontend API Client Mapping:")
        print("   This simulates what the frontend API client would do...")
        
        if data:
            sample_record = data[0]
            
            # Simulate the mapping logic from the API client
            mapped_subject_id = (
                sample_record.get('subject_id') or 
                sample_record.get('subjectId') or 
                sample_record.get('classId') or 
                ''
            )
            
            print(f"   📋 Mapped subjectId: '{mapped_subject_id}' (type: {type(mapped_subject_id)})")
            
            if mapped_subject_id:
                try:
                    numeric_id = int(mapped_subject_id)
                    print(f"   ✅ Converted to integer: {numeric_id}")
                    
                    # Test if this subject exists
                    subject_response = requests.get(f"{base_url}/api/subjects/{numeric_id}", headers=headers)
                    if subject_response.status_code == 200:
                        subject_data = subject_response.json()
                        print(f"   ✅ Subject found: {subject_data.get('name', 'Unknown')}")
                    else:
                        print(f"   ❌ Subject not found: {subject_response.status_code}")
                        
                except ValueError:
                    print(f"   ❌ Cannot convert '{mapped_subject_id}' to integer - this would cause NaN!")
            else:
                print(f"   ❌ No subject ID found - this would cause NaN!")
    
    print(f"\n🎯 Analysis Complete!")
    print("   The fix should handle cases where subject IDs are missing or invalid.")

if __name__ == "__main__":
    test_attendance_mapping()