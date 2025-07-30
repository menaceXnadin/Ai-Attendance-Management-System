"""
Simple test to verify face recognition library is working
"""
import face_recognition
import numpy as np
from PIL import Image
import base64
from io import BytesIO

def test_face_recognition():
    try:
        print("Testing face_recognition library...")
        
        # Create a simple test image (just a solid color)
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        print("✓ NumPy array created")
        
        # Test face_recognition.face_locations
        locations = face_recognition.face_locations(test_image)
        print(f"✓ face_locations worked: found {len(locations)} faces")
        
        print("✓ Face recognition library is working!")
        return True
        
    except Exception as e:
        print(f"✗ Face recognition test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_face_recognition()
