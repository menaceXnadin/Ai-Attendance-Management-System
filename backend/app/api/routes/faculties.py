from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_, delete as sa_delete
from sqlalchemy.exc import IntegrityError
from app.core.database import get_db
from app.models import Faculty, Student, Subject, AttendanceRecord, AcademicEvent, ClassSchedule
from app.models.notifications import EnhancedNotification
from app.schemas import FacultyCreate, FacultyOut
from app.api.dependencies import require_admin_role

router = APIRouter(prefix="/faculties", tags=["faculties"])


@router.get("/", response_model=list[FacultyOut])
async def get_faculties(db: AsyncSession = Depends(get_db)):
    # Public catalogue (names/codes only); used by forms before role-specific data loads.
    result = await db.execute(select(Faculty))
    return result.scalars().all()


@router.post("/", response_model=FacultyOut)
async def create_faculty(
    faculty: FacultyCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin_role),
):
    # Validate faculty name uniqueness
    existing = await db.execute(select(Faculty.id).where(Faculty.name == faculty.name).limit(1))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Faculty name already exists")

    # Validate faculty code format (4 uppercase letters)
    code = faculty.code.upper().strip()
    if len(code) != 4 or not code.isalpha():
        raise HTTPException(status_code=400, detail="Faculty code must be exactly 4 letters")

    # Validate faculty code uniqueness
    existing = await db.execute(select(Faculty.id).where(Faculty.code == code).limit(1))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail=f"Faculty code '{code}' already exists")

    new_faculty = Faculty(
        name=faculty.name,
        code=code,
        description=faculty.description
    )
    db.add(new_faculty)
    await db.commit()
    await db.refresh(new_faculty)
    return new_faculty


async def _faculty_references(db: AsyncSession, faculty_id: int) -> dict:
    """Count everything that references a faculty (directly or via its subjects/students)."""

    async def scalar(stmt) -> int:
        return int((await db.execute(stmt)).scalar() or 0)

    student_ids = select(Student.id).where(Student.faculty_id == faculty_id)
    subject_ids = select(Subject.id).where(Subject.faculty_id == faculty_id)

    return {
        "students": await scalar(
            select(func.count(Student.id)).where(Student.faculty_id == faculty_id)
        ),
        "subjects": await scalar(
            select(func.count(Subject.id)).where(Subject.faculty_id == faculty_id)
        ),
        "class_schedules": await scalar(
            select(func.count(ClassSchedule.id)).where(
                or_(
                    ClassSchedule.faculty_id == faculty_id,
                    ClassSchedule.subject_id.in_(subject_ids),
                )
            )
        ),
        "attendance_records": await scalar(
            select(func.count(AttendanceRecord.id)).where(
                or_(
                    AttendanceRecord.student_id.in_(student_ids),
                    AttendanceRecord.subject_id.in_(subject_ids),
                )
            )
        ),
        "academic_events": await scalar(
            select(func.count(AcademicEvent.id)).where(
                or_(
                    AcademicEvent.faculty_id == faculty_id,
                    AcademicEvent.subject_id.in_(subject_ids),
                )
            )
        ),
        "notifications": await scalar(
            select(func.count(EnhancedNotification.id)).where(
                EnhancedNotification.target_faculty_id == faculty_id
            )
        ),
    }


def _blocking(refs: dict, force: bool) -> dict:
    """References that prevent deletion.

    Never deletable: students, attendance history, calendar events and targeted
    notifications (deleting would cascade students/attendance or silently re-scope
    events to every faculty). With force=true, unused subjects and schedules are
    removed together with the empty faculty.
    """
    hard = {k: refs[k] for k in ("students", "attendance_records", "academic_events", "notifications") if refs[k]}
    if not force:
        hard.update({k: refs[k] for k in ("subjects", "class_schedules") if refs[k]})
    return hard


@router.get("/{faculty_id}/cascade-preview")
async def get_cascade_preview(
    faculty_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin_role),
):
    """
    Preview what deleting this faculty would do.

    A faculty that has students, attendance history, calendar events or targeted
    notifications cannot be deleted (409). An otherwise empty faculty can be deleted
    with force=true, which also removes its unused subjects and class schedules.
    """
    faculty = await db.get(Faculty, faculty_id)
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    refs = await _faculty_references(db, faculty_id)
    blockers = _blocking(refs, force=True)
    can_delete = not blockers

    if can_delete:
        warning = (
            f"Deleting this faculty will also remove {refs['subjects']} unused subjects and "
            f"{refs['class_schedules']} class schedules."
            if refs["subjects"] or refs["class_schedules"] else None
        )
    else:
        warning = "This faculty cannot be deleted while it has " + ", ".join(
            f"{count} {name.replace('_', ' ')}" for name, count in blockers.items()
        ) + "."

    return {
        "faculty_id": faculty_id,
        "faculty_name": faculty.name,
        "faculty_code": faculty.code,
        "will_delete": {
            "students": 0,
            "subjects": refs["subjects"] if can_delete else 0,
            "attendance_records": 0,
            "class_schedules": refs["class_schedules"] if can_delete else 0,
        },
        "will_orphan": {
            "academic_events": 0,
        },
        "references": refs,
        "blockers": blockers,
        "can_delete": can_delete,
        "is_safe_to_delete": can_delete,
        "warning": warning,
    }


@router.delete("/{faculty_id}")
async def delete_faculty(
    faculty_id: int,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin_role),
):
    """
    Delete a faculty (admin only).

    - 409 if the faculty has students, attendance history, calendar events or
      targeted notifications (never cascaded).
    - 409 without force=true if it still has subjects or class schedules.
    - force=true deletes only the empty faculty plus its unused subjects/schedules.
    """
    faculty = await db.get(Faculty, faculty_id)
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    refs = await _faculty_references(db, faculty_id)
    blockers = _blocking(refs, force=force)
    if blockers:
        only_catalogue = set(blockers) <= {"subjects", "class_schedules"}
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Cannot delete faculty that is still in use",
                "student_count": refs["students"],
                "references": refs,
                "blockers": blockers,
                "suggestion": (
                    "Use force=true to also delete its unused subjects and schedules"
                    if only_catalogue else
                    "Transfer its students and keep faculties with attendance history; deletion never removes students or attendance"
                ),
            },
        )

    faculty_name = faculty.name
    subject_ids = select(Subject.id).where(Subject.faculty_id == faculty_id)
    try:
        # Core DELETEs in dependency order; no ORM cascades are involved.
        await db.execute(
            sa_delete(ClassSchedule).where(
                or_(ClassSchedule.faculty_id == faculty_id, ClassSchedule.subject_id.in_(subject_ids))
            ).execution_options(synchronize_session=False)
        )
        await db.execute(
            sa_delete(Subject).where(Subject.faculty_id == faculty_id).execution_options(synchronize_session=False)
        )
        await db.execute(
            sa_delete(Faculty).where(Faculty.id == faculty_id).execution_options(synchronize_session=False)
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Cannot delete faculty: other records still reference it or its subjects",
                "student_count": refs["students"],
            },
        )

    return {
        "success": True,
        "message": f"Faculty '{faculty_name}' deleted successfully",
        "deleted_students": 0,
        "deleted_subjects": refs["subjects"],
        "deleted_class_schedules": refs["class_schedules"],
    }
