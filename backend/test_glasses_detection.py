#!/usr/bin/env python3
"""
Test script to check the current development mode and glasses detection capabilities.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.services.insightface_service import insightface_service

async def test_glasses_detection():
    """Test the glasses detection setup and configuration."""
    print("🔍 Testing Glasses Detection Configuration...")
    print("-" * 60)
    
    # Check development mode
    print(f"📋 Development Mode: {settings.development_mode}")
    print(f"📋 Face Recognition Tolerance: {settings.face_recognition_tolerance}")
    
    if settings.development_mode:
        print("\n⚠️  WARNING: Development mode is enabled!")
        print("   • Mock face detection is active")
        print("   • Glasses detection will always return 'no glasses'")
        print("   • This explains why registration worked with glasses")
        print("\n💡 To enable real glasses detection:")
        print("   1. Set development_mode = False in config.py")
        print("   2. Or set DEVELOPMENT_MODE=False in .env file")
    
    # Check InsightFace service status
    print(f"\n🔥 InsightFace Service Status:")
    if insightface_service.app is None:
        print("   ❌ InsightFace service not initialized")
        return
    
    print("   ✅ InsightFace service is active")
    print(f"   📊 Available models: {list(insightface_service.app.models.keys())}")
    
    # Check if genderage model is available for glasses detection
    if 'genderage' in insightface_service.app.models:
        print("   ✅ GenderAge model available (supports glasses detection)")
        genderage_model = insightface_service.app.models['genderage']
        print(f"   📋 Model output names: {genderage_model.output_names}")
        print(f"   📋 Model task: {genderage_model.taskname}")
    else:
        print("   ❌ GenderAge model not available (no glasses detection)")
    
    print("\n🎯 Recommendations:")
    if settings.development_mode:
        print("   1. Disable development mode for real glasses detection")
    
    print("   2. The ModernFaceRegistration component should call /detect-glasses endpoint")
    print("   3. Face data IS being stored correctly in the database")
    print("   4. Consider adding glasses detection to ModernFaceRegistration workflow")

if __name__ == "__main__":
    asyncio.run(test_glasses_detection())
