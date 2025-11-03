"""
Student ID Auto-Generation Utility
Generates unique student IDs based on faculty and year
Format: {FACULTY_CODE}{YEAR}{SEQUENCE}
Example: CSCI2025001, MATH2025015
"""
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Student, Faculty
import logging

logger = logging.getLogger(__name__)


def generate_faculty_code(faculty_name: str) -> str:
    """
    Generate faculty code from faculty name.
    
    Examples:
        "Computer Science" -> "CSCI"
        "Computer Science & Engineering" -> "CSCI"
        "Electrical Engineering" -> "ELET"
        "Electronics Engineering" -> "ELEN"
        "Electronics & Communication Engineering" -> "ELCE"
        "Electronics & Communication" -> "ELCO"
        "Electronics" -> "ELEC"
        "Mathematics" -> "MATH"
        "Information Technology" -> "ITEC"
    
    Args:
        faculty_name: Name of the faculty
        
    Returns:
        Faculty code (4 uppercase letters)
    """
    if not faculty_name:
        return "STUD"
    
    # Handle special cases with exact matching for disambiguation
    special_cases = {
        'Computer Science': 'CSCI',
        'Computer Science & Engineering': 'CSEG',
        'Information Technology': 'ITEC',
        'Electronics & Communication Engineering': 'ELCE',
        'Electronics & Communication': 'ELCO',
        'Electronics Engineering': 'ELEN',
        'Electronics': 'ELEC',
        'Electrical Engineering': 'ELET',
        'Electrical': 'ELET',
        'Mechanical Engineering': 'MECH',
        'Mechanical': 'MECH',
        'Civil Engineering': 'CIVI',
        'Civil': 'CIVI',
        'Chemical Engineering': 'CHEM',
        'Chemical': 'CHEM',
        'Mathematics': 'MATH',
        'Physics': 'PHYS',
        'Chemistry': 'CHEM',
        'Biology': 'BIOL',
        'Business Administration': 'BADM',
    }
    
    # Try exact match first
    if faculty_name in special_cases:
        return special_cases[faculty_name]
    
    # Try case-insensitive match
    for key, code in special_cases.items():
        if faculty_name.lower() == key.lower():
            return code
    
    # Default algorithm for unknown faculties
    # Remove common suffixes
    import re
    name = re.sub(r'\s+(Engineering|Science|Technology|Studies|Department)$', '', faculty_name, flags=re.IGNORECASE)
    
    # Split into words and generate code
    words = name.split()
    if len(words) >= 2:
        # Multi-word: take first 2 letters of first 2 words
        code = (words[0][:2] + words[1][:2]).upper()
    else:
        # Single word: take first 4 letters
        code = words[0][:4].upper()
    
    return code


async def generate_student_id(faculty_id: int, db: AsyncSession) -> str:
    """
    Generate unique student ID based on faculty and year.
    
    Format: {FACULTY_CODE}{YEAR}{SEQUENCE}
    - FACULTY_CODE: 4 letters from faculty.code (stored in database)
    - YEAR: Current year (4 digits)
    - SEQUENCE: 3-digit sequential number (001, 002, ...)
    
    Examples:
        CSCI2025001 (Computer Science, 2025, 1st student)
        CSEG2025001 (CSE, 2025, 1st student)
        MATH2025015 (Mathematics, 2025, 15th student)
        ELEC2026001 (Electronics, 2026, 1st student)
    
    Args:
        faculty_id: ID of the faculty
        db: Database session
        
    Returns:
        Generated student ID
        
    Raises:
        ValueError: If faculty not found or invalid data
    """
    try:
        # Step 1: Get faculty information
        faculty_result = await db.execute(
            select(Faculty).where(Faculty.id == faculty_id)
        )
        faculty = faculty_result.scalar_one_or_none()
        
        if not faculty:
            logger.error(f"Faculty with ID {faculty_id} not found")
            raise ValueError(f"Faculty with ID {faculty_id} not found")
        
        logger.info(f"Generating student ID for faculty: {faculty.name} (ID: {faculty_id})")
        
        # Step 2: Get faculty code from database (or generate if not set)
        if faculty.code:
            faculty_code = faculty.code
            logger.info(f"Using faculty code from database: {faculty_code}")
        else:
            # Fallback: generate code if not set in database
            faculty_code = generate_faculty_code(faculty.name)
            logger.warning(f"Faculty code not set in database, generated: {faculty_code}")
        
        # Step 3: Get current year
        year = datetime.now().year
        
        # Step 4: Find the last student ID for this faculty+year pattern
        pattern = f"{faculty_code}{year}%"
        result = await db.execute(
            select(Student.student_id)
            .where(Student.student_id.like(pattern))
            .order_by(Student.student_id.desc())
            .limit(1)
        )
        last_id = result.scalar_one_or_none()
        
        # Step 5: Calculate next sequence number
        if last_id:
            try:
                # Extract last 3 digits and increment
                last_sequence = int(last_id[-3:])
                next_sequence = last_sequence + 1
                logger.info(f"Last ID: {last_id}, Next sequence: {next_sequence}")
            except (ValueError, IndexError) as e:
                # If extraction fails, start from 1
                logger.warning(f"Could not parse last ID '{last_id}': {e}. Starting from 1")
                next_sequence = 1
        else:
            # First student for this faculty+year
            next_sequence = 1
            logger.info(f"No existing IDs for pattern {pattern}, starting from 001")
        
        # Step 6: Generate final ID with zero-padding
        new_student_id = f"{faculty_code}{year}{next_sequence:03d}"
        
        # Step 7: Verify uniqueness (safety check)
        check_result = await db.execute(
            select(Student).where(Student.student_id == new_student_id)
        )
        existing = check_result.scalar_one_or_none()
        
        if existing:
            # Collision detected (very rare), increment and try again
            logger.warning(f"Collision detected for {new_student_id}, incrementing")
            next_sequence += 1
            new_student_id = f"{faculty_code}{year}{next_sequence:03d}"
        
        logger.info(f"Generated student ID: {new_student_id}")
        return new_student_id
        
    except Exception as e:
        logger.error(f"Error generating student ID: {str(e)}")
        raise ValueError(f"Failed to generate student ID: {str(e)}")
