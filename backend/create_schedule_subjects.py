import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def create_computer_architecture_subject():
    """Create Computer Architecture subject with ID 24 to match frontend schedule"""
    
    async with AsyncSessionLocal() as db:
        print("🏗️ Creating Computer Architecture subject...")
        
        # Check if subject ID 24 already exists
        existing = await db.execute(
            text("SELECT id, name FROM subjects WHERE id = 24")
        )
        existing_subject = existing.fetchone()
        
        if existing_subject:
            print(f"  Subject ID 24 already exists: {existing_subject[1]}")
            
            # Update it to be Computer Architecture
            await db.execute(
                text("""
                    UPDATE subjects 
                    SET name = 'Computer Architecture',
                        code = 'CSE104',
                        description = 'Introduction to computer architecture and organization',
                        faculty_id = 1
                    WHERE id = 24
                """)
            )
            print("  ✅ Updated existing subject to Computer Architecture")
        else:
            # Create new subject with specific ID 24
            await db.execute(
                text("""
                    INSERT INTO subjects (id, name, code, description, faculty_id, created_at, updated_at)
                    VALUES (24, 'Computer Architecture', 'CSE104', 
                           'Introduction to computer architecture and organization', 
                           1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)
            )
            print("  ✅ Created new Computer Architecture subject with ID 24")
        
        # Also create other subjects used in the frontend schedule
        subjects_to_create = [
            (21, 'Programming Fundamentals', 'CSE101'),
            (22, 'Mathematics for Computing', 'CSE102'), 
            (23, 'Digital Logic Design', 'CSE103'),
            (25, 'Data Structures', 'CSE105'),
            (26, 'Database Systems', 'CSE106')
        ]
        
        for subject_id, name, code in subjects_to_create:
            # Check if exists
            check = await db.execute(
                text("SELECT id FROM subjects WHERE id = :id"), {"id": subject_id}
            )
            if not check.fetchone():
                await db.execute(
                    text("""
                        INSERT INTO subjects (id, name, code, description, faculty_id, created_at, updated_at)
                        VALUES (:id, :name, :code, :desc, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """), {
                        "id": subject_id,
                        "name": name, 
                        "code": code,
                        "desc": f"Course covering {name.lower()}"
                    }
                )
                print(f"  ✅ Created {name} (ID: {subject_id})")
            else:
                print(f"  ℹ️  {name} (ID: {subject_id}) already exists")
        
        await db.commit()
        
        # Verify subjects
        print(f"\nVerifying created subjects:")
        result = await db.execute(
            text("SELECT id, name, code FROM subjects WHERE id IN (21, 22, 23, 24, 25, 26) ORDER BY id")
        )
        subjects = result.fetchall()
        
        for subject in subjects:
            print(f"  ID: {subject[0]:<3} | Name: {subject[1]:<25} | Code: {subject[2]}")
        
        print("✅ Subject creation complete!")

if __name__ == "__main__":
    asyncio.run(create_computer_architecture_subject())
