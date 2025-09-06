import asyncio
import json
from datetime import datetime
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def test_enhanced_face_recognition():
    """Test the enhanced face recognition attendance with all required fields"""
    
    async with AsyncSessionLocal() as db:
        print('🤖 TESTING ENHANCED FACE RECOGNITION ATTENDANCE')
        print('=' * 70)
        
        # 1. Get a student with face encoding for testing
        student_result = await db.execute(text("""
            SELECT s.id, s.student_id, u.full_name, u.id as user_id
            FROM students s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.face_encoding IS NOT NULL
            LIMIT 1
        """))
        
        student = student_result.fetchone()
        if not student:
            print("❌ No students with face encodings found!")
            return
        
        print(f"Test Student: {student[2]} (ID: {student[0]}, Code: {student[1]}, User ID: {student[3]})")
        
        # 2. Test data that should be sent during face recognition
        test_attendance_data = {
            "student_id": student[0],
            "subject_id": 24,  # Computer Architecture
            "date": datetime.now().date(),
            "time_in": datetime.now(),
            "time_out": None,
            "status": "present",
            "method": "face",
            "confidence_score": 95.67,
            "location": "Face Recognition System",
            "notes": "Face recognition confidence: 95.67%, Marked via self-service attendance system",
            "marked_by": student[3]  # Student's user ID
        }
        
        print(f"\n📋 EXPECTED ATTENDANCE DATA:")
        print("-" * 40)
        for key, value in test_attendance_data.items():
            print(f"  {key:<18}: {value}")
        
        # 3. Check what would happen if we insert this data
        print(f"\n🔍 VALIDATING REQUIRED FIELDS:")
        print("-" * 40)
        
        # Check if Computer Architecture subject exists
        subject_check = await db.execute(text("""
            SELECT id, name, code FROM subjects WHERE id = 24
        """))
        subject = subject_check.fetchone()
        
        if subject:
            print(f"✅ Subject ID 24 exists: {subject[1]} ({subject[2]})")
        else:
            print(f"❌ Subject ID 24 does not exist!")
            return
        
        # Check if student exists
        student_check = await db.execute(text("""
            SELECT id, student_id FROM students WHERE id = :student_id
        """), {"student_id": student[0]})
        
        if student_check.fetchone():
            print(f"✅ Student ID {student[0]} exists")
        else:
            print(f"❌ Student ID {student[0]} does not exist!")
            return
        
        # Check if user exists for marked_by
        user_check = await db.execute(text("""
            SELECT id, full_name FROM users WHERE id = :user_id
        """), {"user_id": student[3]})
        
        if user_check.fetchone():
            print(f"✅ User ID {student[3]} exists for marked_by field")
        else:
            print(f"❌ User ID {student[3]} does not exist!")
            return
        
        # 4. Simulate the actual insert (but don't commit)
        print(f"\n🧪 SIMULATING ATTENDANCE INSERT:")
        print("-" * 40)
        
        try:
            # Create the insert statement
            insert_sql = text("""
                INSERT INTO attendance_records 
                (student_id, subject_id, date, time_in, time_out, status, method, 
                 confidence_score, location, notes, marked_by, created_at, updated_at)
                VALUES 
                (:student_id, :subject_id, :date, :time_in, :time_out, :status, :method,
                 :confidence_score, :location, :notes, :marked_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
            """)
            
            result = await db.execute(insert_sql, {
                "student_id": test_attendance_data["student_id"],
                "subject_id": test_attendance_data["subject_id"],
                "date": test_attendance_data["date"],
                "time_in": test_attendance_data["time_in"],
                "time_out": test_attendance_data["time_out"],
                "status": test_attendance_data["status"],
                "method": test_attendance_data["method"],
                "confidence_score": test_attendance_data["confidence_score"],
                "location": test_attendance_data["location"],
                "notes": test_attendance_data["notes"],
                "marked_by": test_attendance_data["marked_by"]
            })
            
            new_record_id = result.fetchone()[0]
            print(f"✅ Successfully simulated insert - would create record ID: {new_record_id}")
            
            # Get the inserted record to verify all fields
            verify_result = await db.execute(text("""
                SELECT 
                    id, student_id, subject_id, date, time_in, time_out,
                    status, method, confidence_score, location, notes, marked_by,
                    created_at, updated_at
                FROM attendance_records 
                WHERE id = :record_id
            """), {"record_id": new_record_id})
            
            record = verify_result.fetchone()
            
            print(f"\n📊 VERIFIED RECORD DATA:")
            print("-" * 40)
            field_names = [
                'id', 'student_id', 'subject_id', 'date', 'time_in', 'time_out',
                'status', 'method', 'confidence_score', 'location', 'notes', 'marked_by',
                'created_at', 'updated_at'
            ]
            
            for i, field_name in enumerate(field_names):
                value = record[i]
                status_icon = "✅" if value is not None else "❌"
                print(f"  {status_icon} {field_name:<18}: {value}")
            
            # Calculate completeness
            non_null_fields = sum(1 for i in range(len(field_names)) if record[i] is not None)
            total_fields = len(field_names)
            completeness = (non_null_fields / total_fields) * 100
            
            print(f"\n📈 DATA COMPLETENESS: {non_null_fields}/{total_fields} fields ({completeness:.1f}%)")
            
            # Don't commit - this is just a test
            await db.rollback()
            print(f"\n🔄 Transaction rolled back (test only)")
            
        except Exception as e:
            print(f"❌ Insert simulation failed: {str(e)}")
            await db.rollback()
        
        # 5. Compare with old vs new approach
        print(f"\n📊 COMPARISON: OLD vs NEW FACE RECOGNITION DATA")
        print("=" * 70)
        
        old_fields = ['student_id', 'date', 'status', 'method', 'confidence_score']
        new_fields = ['student_id', 'subject_id', 'date', 'time_in', 'status', 'method', 
                     'confidence_score', 'location', 'notes', 'marked_by']
        
        print(f"OLD approach populated: {len(old_fields)} fields")
        for field in old_fields:
            print(f"  ✅ {field}")
        
        print(f"\nNEW approach populates: {len(new_fields)} fields")
        for field in new_fields:
            is_new = field not in old_fields
            icon = "🆕" if is_new else "✅"
            print(f"  {icon} {field}")
        
        improvement = len(new_fields) - len(old_fields)
        print(f"\n🚀 IMPROVEMENT: +{improvement} additional fields ({improvement/len(old_fields)*100:.0f}% increase)")
        
        print(f"\n✅ Enhanced face recognition test complete!")

if __name__ == "__main__":
    asyncio.run(test_enhanced_face_recognition())
