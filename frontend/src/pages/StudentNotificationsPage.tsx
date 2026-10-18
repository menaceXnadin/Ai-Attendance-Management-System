import React from 'react';
import EnhancedNotificationSystem from '@/components/EnhancedNotificationSystem';
import StudentSidebar from '@/components/StudentSidebar';

const StudentNotificationsPage = () => {
  return (
    <StudentSidebar>
      {/* Teams-style activity feed: a single, centered reading column */}
      <div className="mx-auto w-full max-w-5xl py-2">
        <EnhancedNotificationSystem />
      </div>
    </StudentSidebar>
  );
};

export default StudentNotificationsPage;
