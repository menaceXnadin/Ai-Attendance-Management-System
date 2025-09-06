import React from 'react';
import StudentSidebar from '@/components/StudentSidebar';
import AcademicCalendar from './AcademicCalendar';

const StudentCalendar = () => {
  return (
    <StudentSidebar>
      <div className="w-full">
        <AcademicCalendar embedded={true} />
      </div>
    </StudentSidebar>
  );
};

export default StudentCalendar;