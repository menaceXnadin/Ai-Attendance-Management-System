import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select, func, text

async def query_nadin():
    async with AsyncSessionLocal() as db:
        # Find user Nadin Tamang
        user_query = text("SELECT id, name FROM users WHERE name = 'Nadin Tamang'")
        user_result = await db.execute(user_query)
        user = user_result.first()
        if not user:
            print("User 'Nadin Tamang' not found")
            return
        user_id = user[0]
        
        # Find student
        student_query = text("SELECT id, student_id FROM students WHERE user_id = :user_id")
        student_result = await db.execute(student_query, {"user_id": user_id})
        student = student_result.first()
        if not student:
            print("Student not found for user")
            return
        student_id = student[0]
        student_student_id = student[1]
        
        # Count attended classes (present or late)
        attendance_query = text("SELECT COUNT(*) FROM attendance WHERE student_id = :student_id AND status IN ('present', 'late')")
        count_result = await db.execute(attendance_query, {"student_id": student_id})
        total_attended = count_result.scalar()
        
        print(f"Student Nadin Tamang (Student ID: {student_student_id}) has attended {total_attended} classes in total.")

if __name__ == "__main__":
    asyncio.run(query_nadin())