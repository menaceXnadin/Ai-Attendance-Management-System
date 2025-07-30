import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def fix_aarohi_faculty():
    async with AsyncSessionLocal() as db:
        try:
            # Update Aarohi's faculty from roll number to proper faculty
            await db.execute(text("""
                UPDATE students 
                SET faculty = 'Information Technology' 
                WHERE student_id = 'STU20250321'
            """))
            await db.commit()
            print('✅ Updated Aarohi Panta\'s faculty to Information Technology')
            
            # Verify the update
            result = await db.execute(text("""
                SELECT s.student_id, s.faculty, u.full_name 
                FROM students s 
                JOIN users u ON s.user_id = u.id 
                WHERE s.student_id = 'STU20250321'
            """))
            
            student = result.fetchone()
            if student:
                print(f'✅ Verified: {student[2]} - Faculty: {student[1]}')
                
        except Exception as e:
            print(f'❌ Error: {e}')

if __name__ == "__main__":
    asyncio.run(fix_aarohi_faculty())
