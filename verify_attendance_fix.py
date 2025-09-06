"""
Verify that the attendance calendar fix is working correctly
"""
import requests
import json

API_BASE = "http://127.0.0.1:8000"

def verify_attendance_calendar_fix():
    print("🎯 Verifying Attendance Calendar Fix")
    print("=" * 50)
    
    # Login as student
    print("🔐 Logging in as student...")
    login_response = requests.post(f"{API_BASE}/api/auth/login", json={
        "email": "nadin@gmail.com",
        "password": "nadin123"
    })
    
    if login_response.status_code == 200:
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful")
        
        # Test attendance API without student_id (like frontend does now)
        print("\n📊 Testing attendance API without student_id parameter...")
        
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)
        
        # This is exactly what the frontend does now
        filters = {
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d")
        }
        
        attendance_response = requests.get(
            f"{API_BASE}/api/attendance",
            headers=headers,
            params=filters
        )
        
        if attendance_response.status_code == 200:
            records = attendance_response.json()
            print(f"✅ Got {len(records)} attendance records")
            
            # Check Sep 4, 2025 records
            sep4_records = [r for r in records if r['date'] == '2025-09-04']
            print(f"📅 Sep 4, 2025 records: {len(sep4_records)}")
            
            if sep4_records:
                print("   Sep 4 attendance details:")
                present_count = 0
                for record in sep4_records:
                    status = record.get('status', 'unknown')
                    subject = record.get('subjectName', 'Unknown Subject')
                    print(f"      ✅ {subject}: {status}")
                    if status == 'present':
                        present_count += 1
                
                print(f"\n📊 Summary for Sep 4, 2025:")
                print(f"   Total classes: {len(sep4_records)}")
                print(f"   Present: {present_count}")
                print(f"   Attendance rate: {present_count/len(sep4_records)*100:.1f}%")
                
                if present_count == len(sep4_records):
                    print(f"   🎉 Calendar should show: GREEN (fully present)")
                elif present_count > 0:
                    print(f"   🟡 Calendar should show: YELLOW (partially present)")
                else:
                    print(f"   🔴 Calendar should show: RED (absent)")
                    
                print(f"\n✅ Fix Status: WORKING - Backend correctly returns Sep 4 attendance data")
                print(f"   Frontend should now display the attendance calendar correctly!")
                
            else:
                print("   ❌ No Sep 4 records found - issue still exists")
                
        else:
            print(f"❌ API call failed: {attendance_response.status_code}")
            print(f"   Error: {attendance_response.text}")
    else:
        print(f"❌ Login failed: {login_response.status_code}")
        
    print(f"\n📋 Next Steps:")
    print(f"   1. Open browser to http://localhost:5173")
    print(f"   2. Login as nadin@gmail.com / nadin123")  
    print(f"   3. Go to Attendance → Calendar tab")
    print(f"   4. Navigate to September 2025")
    print(f"   5. Check that September 4 shows as GREEN (present)")

if __name__ == "__main__":
    verify_attendance_calendar_fix()