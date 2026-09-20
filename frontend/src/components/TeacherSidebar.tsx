import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import ProfileDropdown from '@/components/ProfileDropdown';
import {
  Dashboard,
  Notebook,
  Notification,
  Calendar,
  User,
} from '@carbon/icons-react';

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
        { label: 'Dashboard', to: '/teacher', icon: Dashboard, end: true },
        { label: 'Mark Attendance', to: '/teacher/attendance', icon: Notebook },
        { label: 'Notifications', to: '/teacher/notifications', icon: Notification },
        { label: 'My Schedule', to: '/teacher/schedule', icon: Calendar },
        { label: 'My Profile', to: '/teacher/profile', icon: User },
      ]
    }
  ];

  return (
    <AppShell
      roleLabel="Teacher"
      navGroups={navGroups}
      user={user}
      onSignOut={signOut}
      pageTitle={pageInfo.title}
      pageDescription={pageInfo.description}
      headerActions={
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted hidden md:inline">
            Welcome, <span className="font-medium text-text-primary">{user?.name?.split(' ')[0] || 'Teacher'}</span>
          </span>
          <ProfileDropdown
            name={user?.name?.split(' ')[0] || 'Teacher'}
            onViewProfile={() => navigate('/teacher/profile')}
            onSignOut={signOut}
          />
        </div>
      }
    >
      {children}
    </AppShell>
  );
};

export default TeacherSidebar;
