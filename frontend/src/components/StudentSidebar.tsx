import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import {
  Home20Regular,
  Home20Filled,
  ClipboardTaskListLtr20Regular,
  ClipboardTaskListLtr20Filled,
  CalendarLtr20Regular,
  CalendarLtr20Filled,
  Alert20Regular,
  Alert20Filled,
  PersonCircle20Regular,
  PersonCircle20Filled,
  Camera20Regular,
  Camera20Filled,
  ScanPerson20Regular,
  ScanPerson20Filled,
} from '@fluentui/react-icons';

interface StudentSidebarProps {
  children: React.ReactNode;
}

const StudentSidebar = ({ children }: StudentSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
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

  // `face_encoding` is always null in payloads; use `face_registered`.
  const isFaceRegistered = !!studentData?.face_registered;

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/student' || path === '/student/dashboard') return { title: 'Student Dashboard', description: 'Overview of your academic attendance' };
    if (path.startsWith('/student/attendance/mark')) return { title: 'Check in', description: 'Face check-in for your current class' };
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
        { label: 'Dashboard', to: '/student', icon: Home20Regular, activeIcon: Home20Filled, end: true },
        { label: 'Check in', to: '/student/attendance/mark', icon: ScanPerson20Regular, activeIcon: ScanPerson20Filled },
        { label: 'My Attendance', to: '/student/attendance', icon: ClipboardTaskListLtr20Regular, activeIcon: ClipboardTaskListLtr20Filled, end: true },
        { label: 'Academic Calendar', to: '/student/calendar', icon: CalendarLtr20Regular, activeIcon: CalendarLtr20Filled },
        { label: 'Notifications', to: '/student/notifications', icon: Alert20Regular, activeIcon: Alert20Filled },
        { label: 'My Profile', to: '/student/profile', icon: PersonCircle20Regular, activeIcon: PersonCircle20Filled },
        {
          label: 'Face Registration',
          to: '/face-registration',
          icon: Camera20Regular,
          activeIcon: Camera20Filled,
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
      onViewProfile={() => navigate('/student/profile')}
    >
      {children}
    </AppShell>
  );
};

export default StudentSidebar;
