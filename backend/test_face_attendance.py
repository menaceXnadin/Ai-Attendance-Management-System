#!/usr/bin/env python3

import requests
import base64
import json
import sys
import os
from pathlib import Path
import io
from PIL import Image, ImageDraw
import numpy as np

# Get script directory
script_dir = Path(__file__).parent

# Create a simple test image with a face-like shape
def create_test_face_image():
    """Create a simple test face image"""
    # Create a new image with white background
    img = Image.new('RGB', (300, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw a simple face
    # Face outline (circle)
    draw.ellipse((50, 50, 250, 250), outline=(0, 0, 0), width=2)
    
    # Eyes (two circles)
    draw.ellipse((100, 120, 130, 150), fill=(0, 0, 0))  # Left eye
    draw.ellipse((170, 120, 200, 150), fill=(0, 0, 0))  # Right eye
    
    # Mouth (arc)
    draw.arc((100, 150, 200, 200), start=0, end=180, fill=(0, 0, 0), width=2)
    
    # Convert to bytes
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    
    return img_byte_arr.getvalue()

# Get test image data
test_image_data = create_test_face_image()

def test_face_recognition_attendance():
    """Test the face recognition attendance marking endpoint"""
    
    print("=== Testing Face Recognition Attendance Marking ===")
    
    try:
        # Encode the generated test image
        base64_image = base64.b64encode(test_image_data).decode('utf-8')
        
        print(f"📸 Using generated test face image")
        
        # Set API endpoint
        url = "http://localhost:8000/api/face-recognition/mark-attendance"
        
        # Set request data
        data = {
            "image_data": base64_image,
            "subject_id": 1  # Using subject ID 1 as an integer
        }
        
        print("🔄 Sending request to mark attendance...")
        
        # Send POST request
        response = requests.post(url, json=data)
        
        # Check response
        print(f"📡 Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success: {json.dumps(result, indent=2)}")
        else:
            print(f"❌ Error: {response.status_code}")
            try:
                error = response.json()
                print(f"Error details: {json.dumps(error, indent=2)}")
            except:
                print(f"Response text: {response.text}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        
if __name__ == "__main__":
    test_face_recognition_attendance()
