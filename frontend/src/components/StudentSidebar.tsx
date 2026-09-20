import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import {
  Dashboard,
  Time,
  Calendar,
  Notification,
  User,
  Camera,
} from '@carbon/icons-react';

interface StudentSidebarProps {
  children: React.ReactNode;
}

const StudentSidebar = ({ children }: StudentSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  // Check face registration status
  const { data: studentData } = useQuery({
    queryKey: ['current-student-sidebar', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const students = await api.students.getAll();
        const found = students.find(s => s.email === user.email);
        if (!found) {
          const foundInsensitive = students.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
          return foundInsensitive || null;
        }
        return found;
      } catch (error) {
        return null;
      }
    },
    enabled: !!user?.email,
  });

  const isFaceRegistered = !!studentData?.face_encoding;

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/student' || path === '/student/dashboard') return { title: 'Student Dashboard', description: 'Overview of your academic attendance' };
    if (path.includes('/student/attendance')) return { title: 'My Attendance', description: 'Attendance records and session history' };
    if (path.includes('/student/calendar')) return { title: 'Academic Calendar', description: 'Institutional dates, exams, and holidays' };
    if (path.includes('/student/notifications')) return { title: 'Notifications', description: 'Student announcements and alerts' };
    if (path.includes('/student/profile')) return { title: 'My Profile', description: 'Student record and personal details' };
    if (path.includes('/student/face-registration') || path === '/face-registration') return { title: 'Face Registration', description: 'Biometric registration for automated check-in' };
    return { title: 'Student Portal', description: 'Welcome to AttendAI Student Portal' };
  };

  const pageInfo = getPageInfo();

  const navGroups: NavGroup[] = [
    {
      groupLabel: 'Student Portal',
      items: [
        { label: 'Dashboard', to: '/student', icon: Dashboard, end: true },
        { label: 'My Attendance', to: '/student/attendance', icon: Time, end: true },
        { label: 'Academic Calendar', to: '/student/calendar', icon: Calendar },
        { label: 'Notifications', to: '/student/notifications', icon: Notification },
        { label: 'My Profile', to: '/student/profile', icon: User },
        {
          label: 'Face Registration',
          to: '/face-registration',
          icon: Camera,
          badge: isFaceRegistered ? 'Ready' : undefined
        },
      ]
    }
  ];

  return (
    <AppShell
      roleLabel="Student"
      navGroups={navGroups}
      user={user}
      onSignOut={signOut}
      pageTitle={pageInfo.title}
      pageDescription={pageInfo.description}
    >
      {children}
    </AppShell>
  );
};

export default StudentSidebar;
