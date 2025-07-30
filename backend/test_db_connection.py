import asyncio
import asyncpg

async def test_connection():
    try:
        conn = await asyncpg.connect('postgresql://postgres:nadin123@localhost:5432/attendancedb')
        print("✅ Database connection successful!")
        await conn.close()
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_connection())
