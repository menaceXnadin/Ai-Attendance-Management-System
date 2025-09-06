import React from 'react';
import StudentProfile from '@/components/StudentProfile';
import StudentSidebar from '@/components/StudentSidebar';

const ProfilePage = () => {
  return (
    <StudentSidebar>
      <StudentProfile />
    </StudentSidebar>
  );
};

export default ProfilePage;
