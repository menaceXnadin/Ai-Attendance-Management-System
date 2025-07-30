#!/usr/bin/env python3
"""
Test attendance marking with face recognition
"""

import requests
import json
from PIL import Image, ImageDraw
import base64
from io import BytesIO
import asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def create_test_face_image():
    """Create a simple test face image"""
    img = Image.new('RGB', (200, 200), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple face
    draw.ellipse([50, 50, 150, 150], fill='pink')  # Face
    draw.ellipse([75, 75, 85, 85], fill='black')   # Left eye
    draw.ellipse([115, 75, 125, 85], fill='black') # Right eye
    draw.ellipse([95, 100, 105, 110], fill='red')  # Nose
    draw.arc([80, 120, 120, 140], 0, 180, fill='black', width=2)  # Mouth
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    image_b64 = base64.b64encode(buffer.getvalue()).decode()
    
    return image_b64

def test_attendance_marking():
    """Test the complete attendance marking flow"""
    
    base_url = "http://127.0.0.1:8000"
    
    print("🎯 Testing Attendance Marking with Face Recognition")
    print("=" * 55)
    
    try:
        # 1. Login
        print("1. 🔑 Logging in...")
        login_response = requests.post(
            f"{base_url}/api/auth/login",
            json={"email": "nadin@gmail.com", "password": "nadin123"},
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return False
        
        token = login_response.json().get('access_token')
        print("✅ Login successful")
        
        # 2. Check subjects in database
        print("\n2. 📚 Checking available subjects...")
        engine = create_engine('postgresql://postgres:nadin123@localhost:5432/attendancedb')
        Session = sessionmaker(bind=engine)
        session = Session()
        
        result = session.execute(text('SELECT id, name, code FROM subjects LIMIT 5'))
        subjects = result.fetchall()
        
        if not subjects:
            print("⚠️ No subjects found, creating a test subject...")
            session.execute(text("""
                INSERT INTO subjects (name, code, description, credits) 
                VALUES ('Computer Science', 'CS101', 'Introduction to Computer Science', 3)
                ON CONFLICT (code) DO NOTHING
            """))
            session.commit()
            
            result = session.execute(text('SELECT id, name, code FROM subjects LIMIT 1'))
            subjects = result.fetchall()
        
        session.close()
        
        if subjects:
            subject_id = subjects[0][0]
            subject_name = subjects[0][1]
            print(f"✅ Using subject: {subject_name} (ID: {subject_id})")
        else:
            print("❌ Could not create or find subjects")
            return False
        
        # 3. Create test face image
        print("\n3. 🎨 Creating test face image...")
        face_image_b64 = create_test_face_image()
        print(f"✅ Face image created, size: {len(face_image_b64)} characters")
        
        # 4. Test attendance marking
        print("\n4. 🎯 Testing attendance marking...")
        attendance_response = requests.post(
            f"{base_url}/api/face-recognition/mark-attendance",
            json={
                "image_data": face_image_b64,
                "subject_id": subject_id
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            timeout=30
        )
        
        print(f"📊 Attendance Status: {attendance_response.status_code}")
        
        if attendance_response.status_code == 200:
            response_data = attendance_response.json()
            print(f"✅ Attendance marking response:")
            print(f"   Success: {response_data.get('success', False)}")
            print(f"   Message: {response_data.get('message', 'N/A')}")
            print(f"   Student ID: {response_data.get('student_id', 'N/A')}")
            print(f"   Confidence: {response_data.get('confidence_score', 'N/A')}")
            print(f"   Attendance Marked: {response_data.get('attendance_marked', False)}")
            
            if response_data.get('success'):
                print("🎉 Attendance marking successful!")
                return True
            else:
                print(f"⚠️ Attendance marking failed: {response_data.get('message')}")
                return False
        else:
            print(f"❌ Attendance marking failed: {attendance_response.text}")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 Starting Attendance Marking Test")
    success = test_attendance_marking()
    
    print("\n" + "=" * 55)
    if success:
        print("🎉 ATTENDANCE MARKING TEST PASSED!")
        print("✅ Face recognition attendance system is working!")
    else:
        print("❌ ATTENDANCE MARKING TEST FAILED!")
        print("⚠️ There may be issues with face recognition or database")
    print("=" * 55)
