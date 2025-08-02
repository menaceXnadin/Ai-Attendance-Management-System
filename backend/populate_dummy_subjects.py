#!/usr/bin/env python3
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models import Faculty, Subject
import random

# Number of semesters per faculty (assume max 8)
SEMESTERS = 8
# Number of subjects per semester
SUBJECTS_PER_SEMESTER = 5

# Dummy subject name generator
SUBJECT_NAMES = [
    "Mathematics", "Physics", "Chemistry", "Programming", "Algorithms",
    "Data Structures", "Electronics", "Digital Logic", "Operating Systems",
    "Database Systems", "Web Development", "Software Engineering",
    "Machine Learning", "Artificial Intelligence", "Networking",
    "Discrete Math", "Statistics", "Microprocessors", "Cloud Computing",
    "Mobile Development", "Cybersecurity", "Graphics", "Compiler Design",
    "Project Management", "Research Methods"
]

async def main():
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        faculties = (await session.execute(Faculty.__table__.select())).fetchall()
        faculties = [f for f in faculties]
        print(f"Found {len(faculties)} faculties.")
        subject_count = 0
        for faculty_row in faculties:
            faculty = Faculty(**faculty_row._mapping)
            for semester in range(1, SEMESTERS + 1):
                for i in range(SUBJECTS_PER_SEMESTER):
                    name = random.choice(SUBJECT_NAMES) + f" S{semester} F{faculty.id} #{i+1}"
                    code = f"{faculty.name[:3].upper()}-S{semester}-SUBJ{i+1}"
                    description = f"Dummy subject for {faculty.name}, semester {semester}"
                    subject = Subject(
                        name=name,
                        code=code,
                        description=description,
                        credits=random.choice([3, 4]),
                        faculty_id=faculty.id,
                        class_schedule={"semester": semester}
                    )
                    session.add(subject)
                    subject_count += 1
        await session.commit()
        print(f"Inserted {subject_count} dummy subjects across all faculties and semesters.")

if __name__ == "__main__":
    asyncio.run(main())
