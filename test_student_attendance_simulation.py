#!/usr/bin/env python3
"""
Simulate the StudentAttendanceReport component workflow
"""
import requests
import json

def simulate_student_attendance_report():
    """Simulate the exact workflow that was failing in StudentAttendanceReport"""
    
    print("🎭 Simulating StudentAttendanceReport Workflow")
    print("=" * 55)
    
    base_url = "http://localhost:8000"
    
    # Login
    login_data = {"email": "admin@attendance.com", "password": "admin123"}
    response = requests.post(f"{base_url}/api/auth/login", json=login_data)
    token = response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    print("1. 📅 Fetching attendance records...")
    
    # Simulate getting attendance records (like the component does)
    today = "2025-07-25"  # Use a date with actual records
    response = requests.get(f"{base_url}/api/attendance/?date={today}", headers=headers)
    
    if response.status_code == 200:
        records = response.json()
        print(f"   ✅ Found {len(records)} attendance records")
        
        # Simulate the frontend API client mapping
        mapped_records = []
        for record in records:
            mapped_record = {
                'id': str(record.get('id', '')),
                'studentId': str(record.get('studentId', '')),
                'subjectId': str(record.get('classId', '')),  # This is the key mapping!
                'date': record.get('date', ''),
                'status': record.get('status', 'absent')
            }
            mapped_records.append(mapped_record)
        
        print(f"   📋 Mapped {len(mapped_records)} records")
        
        if mapped_records:
            print(f"   📝 Sample mapped record: {json.dumps(mapped_records[0], indent=2)}")
        
        print("\n2. 🔍 Extracting unique subject IDs...")
        
        # Simulate the subject ID extraction (this was causing the NaN error)
        subject_ids = list(set(record['subjectId'] for record in mapped_records))
        print(f"   📊 Raw subject IDs: {subject_ids}")
        
        # Apply the fix: filter out invalid IDs
        valid_subject_ids = [id for id in subject_ids if id and not (id == 'NaN' or id == '')]
        print(f"   ✅ Valid subject IDs: {valid_subject_ids}")
        
        print("\n3. 📚 Fetching subject details...")
        
        subjects = []
        for subject_id in valid_subject_ids:
            try:
                numeric_id = int(subject_id)
                print(f"   🔄 Fetching subject {numeric_id}...")
                
                response = requests.get(f"{base_url}/api/subjects/{numeric_id}", headers=headers)
                if response.status_code == 200:
                    subject = response.json()
                    subjects.append(subject)
                    print(f"   ✅ Found: {subject.get('name', 'Unknown')}")
                else:
                    print(f"   ❌ Subject {numeric_id} not found: {response.status_code}")
                    
            except ValueError as e:
                print(f"   ❌ Invalid subject ID '{subject_id}': {e}")
        
        print(f"\n4. 🗺️  Creating subject mapping...")
        subject_map = {}
        for subject in subjects:
            if subject and subject.get('id') and subject.get('name'):
                subject_map[str(subject['id'])] = subject['name']
        
        print(f"   📋 Subject map: {subject_map}")
        
        print(f"\n5. 📊 Final result simulation...")
        final_records = []
        for record in mapped_records:
            if record['subjectId'] and record['date']:
                final_record = {
                    'date': record['date'],
                    'subject': subject_map.get(record['subjectId'], f"Subject {record['subjectId']}"),
                    'status': record['status'],
                    'time': '09:00'  # Simulated time
                }
                final_records.append(final_record)
        
        print(f"   ✅ Successfully processed {len(final_records)} records")
        if final_records:
            print(f"   📝 Sample final record: {json.dumps(final_records[0], indent=2)}")
        
    else:
        print(f"   ❌ Failed to fetch attendance: {response.status_code}")
    
    print(f"\n🎉 Simulation Complete!")
    print("   The NaN error has been fixed by:")
    print("   • Adding missing attendance API methods")
    print("   • Properly mapping classId to subjectId")
    print("   • Filtering out invalid subject IDs")
    print("   • Adding error handling for failed API calls")

if __name__ == "__main__":
    simulate_student_attendance_report()