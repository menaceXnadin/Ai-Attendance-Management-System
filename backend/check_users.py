import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def check_users():
    try:
        print("Opening database connection...")
        async with AsyncSessionLocal() as session:
            print("Executing query...")
            result = await session.execute(text("SELECT id, email, full_name, role FROM users"))
            users = result.fetchall()
            
            if not users:
                print("No users found in the database.")
            else:
                print(f"Found {len(users)} users:")
                for user in users:
                    print(f"ID: {user.id}, Email: {user.email}, Name: {user.full_name}, Role: {user.role}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    print("Starting user check...")
    asyncio.run(check_users())
    print("Check complete.")
