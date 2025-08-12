import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentSidebar from '@/components/StudentSidebar';
import FaceRegistration from '@/components/FaceRegistration';

const StudentFaceRegistrationPage = () => {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <StudentSidebar>
      {/* Use the same FaceRegistration component used in the student dashboard */}
      <FaceRegistration
        isOpen={open}
        onSuccess={() => {
          setOpen(false);
          navigate('/student');
        }}
        onCancel={() => {
          setOpen(false);
          navigate('/student');
        }}
      />
      {/* Optional background content area (kept minimal as dialog overlays the page) */}
      <div className="px-6 py-6" />
    </StudentSidebar>
  );
};

export default StudentFaceRegistrationPage;
