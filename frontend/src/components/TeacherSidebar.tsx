import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import {
  Home20Regular,
  Home20Filled,
  ClipboardTaskListLtr20Regular,
  ClipboardTaskListLtr20Filled,
  Alert20Regular,
  Alert20Filled,
  CalendarLtr20Regular,
  CalendarLtr20Filled,
  PersonCircle20Regular,
  PersonCircle20Filled,
} from '@fluentui/react-icons';

interface TeacherSidebarProps {
  children: React.ReactNode;
}

const TeacherSidebar = ({ children }: TeacherSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/teacher') return { title: 'Teacher Dashboard', description: 'Overview of courses and classes' };
    if (path.includes('/teacher/attendance')) return { title: 'Mark Attendance', description: 'Take class attendance and review records' };
    if (path.includes('/teacher/notifications')) return { title: 'Notifications', description: 'Teacher notices and updates' };
    if (path.includes('/teacher/schedule')) return { title: 'My Schedule', description: 'Weekly teaching timetable and sessions' };
    if (path.includes('/teacher/subjects')) return { title: 'Subject Details', description: 'Course and curriculum resources' };
    if (path.includes('/teacher/profile')) return { title: 'My Profile', description: 'Personal account and preferences' };
    return { title: 'Teacher Portal', description: 'Welcome to AttendAI Teacher Portal' };
  };

  const pageInfo = getPageInfo();

  const navGroups: NavGroup[] = [
    {
      groupLabel: 'Teacher Portal',
      items: [
        { label: 'Dashboard', to: '/teacher', icon: Home20Regular, activeIcon: Home20Filled, end: true },
        { label: 'Mark Attendance', to: '/teacher/attendance', icon: ClipboardTaskListLtr20Regular, activeIcon: ClipboardTaskListLtr20Filled },
        { label: 'Notifications', to: '/teacher/notifications', icon: Alert20Regular, activeIcon: Alert20Filled },
        { label: 'My Schedule', to: '/teacher/schedule', icon: CalendarLtr20Regular, activeIcon: CalendarLtr20Filled },
        { label: 'My Profile', to: '/teacher/profile', icon: PersonCircle20Regular, activeIcon: PersonCircle20Filled },
      ]
    }
  ];

  // The shell's title-bar avatar menu (Teams account manager) provides the
  // profile + sign-out actions previously rendered by ProfileDropdown here.
  return (
    <AppShell
      roleLabel="Teacher"
      navGroups={navGroups}
      user={user}
      onSignOut={signOut}
      pageTitle={pageInfo.title}
      pageDescription={pageInfo.description}
      onViewProfile={() => navigate('/teacher/profile')}
    >
      {children}
    </AppShell>
  );
};

export default TeacherSidebar;
