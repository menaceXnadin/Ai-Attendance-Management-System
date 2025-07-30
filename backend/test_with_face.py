#!/usr/bin/env python3
"""
Test face registration with actual face image
"""
import requests
import base64
import cv2
import numpy as np

def create_test_face_image():
    """Create a simple test image with face-like features"""
    
    # Create a 300x300 image 
    img = np.ones((300, 300, 3), dtype=np.uint8) * 200  # Light gray background
    
    # Draw a simple face
    # Face circle
    cv2.circle(img, (150, 150), 80, (255, 220, 177), -1)  # Face color
    
    # Eyes
    cv2.circle(img, (130, 130), 8, (0, 0, 0), -1)  # Left eye
    cv2.circle(img, (170, 130), 8, (0, 0, 0), -1)  # Right eye
    
    # Nose
    cv2.circle(img, (150, 150), 3, (0, 0, 0), -1)  # Nose
    
    # Mouth
    cv2.ellipse(img, (150, 170), (15, 8), 0, 0, 180, (0, 0, 0), 2)  # Mouth
    
    # Convert to base64
    _, buffer = cv2.imencode('.jpg', img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return img_base64

def test_face_registration_with_face():
    """Test face registration with an actual face image"""
    
    base_url = "http://127.0.0.1:8000"
    
    print("🎯 Testing Face Registration with Real Face Image")
    print("=" * 55)
    
    # Login first
    login_data = {
        "email": "nadin@gmail.com",
        "password": "nadin123"
    }
    
    try:
        login_response = requests.post(
            f"{base_url}/api/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return
        
        token = login_response.json().get('access_token')
        print("✅ Login successful")
        
        # Create test face image
        print("🎨 Creating test face image...")
        face_image_b64 = create_test_face_image()
        print(f"📷 Created face image, base64 length: {len(face_image_b64)}")
        
        # Test face registration
        print("🎯 Testing face registration...")
        face_response = requests.post(
            f"{base_url}/api/face-recognition/register-face",
            json={"image_data": face_image_b64},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            timeout=30
        )
        
        print(f"📊 Status: {face_response.status_code}")
        print(f"📝 Response: {face_response.text}")
        
        if face_response.status_code == 200:
            print("✅ Face registration successful!")
        else:
            print("❌ Face registration failed")
            
            # Parse error details
            try:
                error_data = face_response.json()
                detail = error_data.get('detail', 'Unknown error')
                print(f"Error details: {detail}")
            except:
                pass
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_face_registration_with_face()
