import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check_marks_table():
    try:
        async with AsyncSessionLocal() as session:
            # Check if 'marks' table exists
            result = await session.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marks')"))
            marks_exists = result.scalar()
            
            if not marks_exists:
                print("'marks' table does not exist!")
                print("This could be causing errors when trying to delete students.")
                return False
            
            print("'marks' table exists.")
            return True
    except Exception as e:
        print(f"Error checking 'marks' table: {e}")
        return False

async def check_notifications_table():
    try:
        async with AsyncSessionLocal() as session:
            # Check if 'notifications' table exists
            result = await session.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications')"))
            notifications_exists = result.scalar()
            
            if not notifications_exists:
                print("'notifications' table does not exist!")
                print("This could be causing errors when trying to delete students.")
                return False
            
            print("'notifications' table exists.")
            return True
    except Exception as e:
        print(f"Error checking 'notifications' table: {e}")
        return False

async def main():
    print("Checking database tables that might cause student deletion errors...")
    await check_marks_table()
    await check_notifications_table()

if __name__ == "__main__":
    asyncio.run(main())
