import asyncio
import aiohttp
import json

async def investigate_api_issue():
    """Investigate the 403 error on the events API"""
    
    api_base = 'http://localhost:8000'
    
    async with aiohttp.ClientSession() as session:
        
        # Test 1: Check health endpoint
        print("🔍 Investigating API Issues...")
        print("=" * 50)
        
        try:
            async with session.get(f"{api_base}/health") as resp:
                print(f"1. Health Check: {resp.status}")
                if resp.status == 200:
                    health_data = await resp.json()
                    print(f"   Response: {health_data}")
                else:
                    print(f"   Error: {await resp.text()}")
        except Exception as e:
            print(f"1. Health Check Failed: {e}")
        
        # Test 2: Check events endpoint without auth
        try:
            async with session.get(f"{api_base}/api/calendar/events") as resp:
                print(f"2. Events API (no auth): {resp.status}")
                if resp.status == 403:
                    error_data = await resp.text()
                    print(f"   403 Response: {error_data}")
                elif resp.status == 401:
                    print("   ✅ 401 Unauthorized (expected for protected endpoint)")
                else:
                    print(f"   Unexpected status: {resp.status}")
                    print(f"   Response: {await resp.text()}")
        except Exception as e:
            print(f"2. Events API Failed: {e}")
        
        # Test 3: Try to get a token and test with auth
        print("\n3. Testing with Authentication...")
        try:
            # Try to login
            login_data = {
                "email": "admin@attendance.com",
                "password": "admin123"
            }
            
            async with session.post(f"{api_base}/api/auth/login", json=login_data) as resp:
                print(f"   Login attempt: {resp.status}")
                if resp.status == 200:
                    auth_response = await resp.json()
                    token = auth_response.get('access_token')
                    print(f"   ✅ Got token: {token[:20]}...")
                    
                    # Test events API with token
                    headers = {'Authorization': f'Bearer {token}'}
                    async with session.get(f"{api_base}/api/calendar/events", headers=headers) as resp:
                        print(f"   Events API (with auth): {resp.status}")
                        if resp.status == 200:
                            events = await resp.json()
                            print(f"   ✅ Got {len(events)} events")
                        else:
                            print(f"   Error: {await resp.text()}")
                
                else:
                    error_text = await resp.text()
                    print(f"   ❌ Login failed: {error_text}")
                    
        except Exception as e:
            print(f"3. Authentication test failed: {e}")
        
        # Test 4: Check API documentation/routes
        print("\n4. Available Endpoints:")
        try:
            async with session.get(f"{api_base}/docs") as resp:
                if resp.status == 200:
                    print("   ✅ API docs accessible at /docs")
                else:
                    print(f"   ❌ API docs issue: {resp.status}")
        except Exception as e:
            print(f"4. Docs check failed: {e}")

if __name__ == "__main__":
    asyncio.run(investigate_api_issue())