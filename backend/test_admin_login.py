import asyncio
from app.core.security import verify_password, create_access_token
from app.models import User
from app.core.database import AsyncSessionLocal
from sqlalchemy import select

async def test_admin_login():
    async with AsyncSessionLocal() as db:
        # Get admin user
        result = await db.execute(select(User).filter(User.email == 'admin@attendance.com'))
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            print('❌ Admin user not found!')
            return
            
        print(f'✅ Admin user found: {admin_user.email}')
        print(f'   Role: {admin_user.role}')
        print(f'   Active: {admin_user.is_active}')
        print(f'   ID: {admin_user.id}')
        
        # Test password verification
        test_password = 'admin123'
        is_valid = verify_password(test_password, admin_user.hashed_password)
        print(f'   Password valid for admin123: {is_valid}')
        
        if is_valid:
            # Test token creation
            token = create_access_token(data={'sub': str(admin_user.id), 'role': admin_user.role})
            print(f'   Token created: {token[:50]}...')
        else:
            print('❌ Password verification failed!')

if __name__ == "__main__":
    asyncio.run(test_admin_login())
