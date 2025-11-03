import React from 'react';
import EnhancedNotificationSystem from '@/components/EnhancedNotificationSystem';
import StudentSidebar from '@/components/StudentSidebar';

const StudentNotificationsPage = () => {
  return (
    <StudentSidebar>
      <div className="w-full">
        <EnhancedNotificationSystem />
      </div>
    </StudentSidebar>
  );
};

export default StudentNotificationsPage;
