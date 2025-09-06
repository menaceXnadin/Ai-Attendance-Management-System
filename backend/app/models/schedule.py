from sqlalchemy import Column, Integer, String, Time, Boolean, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class DayOfWeek(enum.Enum):
    SUNDAY = "sunday"
    MONDAY = "monday" 
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"

class ClassSchedule(Base):
    """
    Class Schedule/Timetable table
    Defines when and where each subject is taught
    """
    __tablename__ = "class_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Subject and Faculty relationships
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=False)
    
    # Time and day information
    day_of_week = Column(SQLEnum(DayOfWeek, name="day_of_week"), nullable=False)
    start_time = Column(Time, nullable=False)  # e.g., 08:00:00
    end_time = Column(Time, nullable=False)    # e.g., 09:30:00
    
    # Academic information
    semester = Column(Integer, nullable=False)  # 1-8
    academic_year = Column(Integer, nullable=False)  # e.g., 2025
    
    # Classroom and instructor information
    classroom = Column(String, nullable=True)  # e.g., "Room 101", "Lab A"
    instructor_name = Column(String, nullable=True)  # e.g., "Dr. Smith"
    
    # Status and metadata
    is_active = Column(Boolean, default=True)  # Can be disabled without deletion
    notes = Column(String, nullable=True)  # Additional notes
    
    # Relationships
    subject = relationship("Subject", backref="schedules")
    faculty = relationship("Faculty", backref="class_schedules")
    
    # Constraints
    __table_args__ = (
        # Prevent time conflicts: same faculty, day, semester, year cannot have overlapping times
        UniqueConstraint('faculty_id', 'day_of_week', 'semester', 'academic_year', 'start_time', 
                        name='unique_faculty_time_slot'),
        # Prevent classroom conflicts: same classroom, day, time cannot be double-booked
        UniqueConstraint('classroom', 'day_of_week', 'start_time', 'academic_year',
                        name='unique_classroom_time_slot'),
    )
    
    def __repr__(self):
        return f"<ClassSchedule {self.subject.name if self.subject else 'Unknown'} - {self.day_of_week.value} {self.start_time}-{self.end_time}>"
    
    @property
    def duration_minutes(self):
        """Calculate class duration in minutes"""
        if self.start_time and self.end_time:
            start_minutes = self.start_time.hour * 60 + self.start_time.minute
            end_minutes = self.end_time.hour * 60 + self.end_time.minute
            return end_minutes - start_minutes
        return 0
    
    @property
    def time_slot_display(self):
        """Human-readable time slot"""
        if self.start_time and self.end_time:
            return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"
        return "Unknown"