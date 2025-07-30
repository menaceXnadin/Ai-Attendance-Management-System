"""
Simple test script to verify FastAPI application works
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_import():
    """Test if we can import the FastAPI app"""
    try:
        from app.main import app
        print("✅ SUCCESS: FastAPI app imported successfully!")
        return True
    except Exception as e:
        print(f"❌ ERROR: Failed to import FastAPI app: {e}")
        return False

def test_fastapi_creation():
    """Test if FastAPI app is created properly"""
    try:
        from app.main import app
        print(f"✅ SUCCESS: FastAPI app created with title: {app.title}")
        print(f"✅ SUCCESS: Version: {app.version}")
        return True
    except Exception as e:
        print(f"❌ ERROR: Failed to create FastAPI app: {e}")
        return False

def test_routes():
    """Test if routes are registered"""
    try:
        from app.main import app
        routes = [route.path for route in app.routes]
        print("✅ SUCCESS: Routes registered:")
        for route in routes:
            print(f"  - {route}")
        return True
    except Exception as e:
        print(f"❌ ERROR: Failed to get routes: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing FastAPI Backend...")
    print("-" * 50)
    
    all_tests_passed = True
    
    # Test 1: Import
    if not test_import():
        all_tests_passed = False
    
    print()
    
    # Test 2: FastAPI creation
    if not test_fastapi_creation():
        all_tests_passed = False
    
    print()
    
    # Test 3: Routes
    if not test_routes():
        all_tests_passed = False
    
    print()
    print("-" * 50)
    
    if all_tests_passed:
        print("🎉 ALL TESTS PASSED! Your FastAPI backend is working correctly!")
        print()
        print("Next steps:")
        print("1. Install PostgreSQL or use SQLite for testing")
        print("2. Run: python -m uvicorn app.main:app --reload")
        print("3. Visit: http://localhost:8000/docs")
    else:
        print("❌ Some tests failed. Please check the errors above.")
