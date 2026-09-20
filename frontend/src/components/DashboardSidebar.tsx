import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import NotificationCenter from '@/components/NotificationCenter';
import {
  Dashboard,
  UserMultiple,
  Collaborate,
  Calendar,
  Notebook,
  Enterprise,
  Time,
  ChartLine,
  Activity,
  SettingsAdjust,
  Flash,
  Notification,
  Password,
  Settings,
} from '@carbon/icons-react';

interface DashboardSidebarProps {
  children: React.ReactNode;
}

const DashboardSidebar = ({ children }: DashboardSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  // Fetch students for count badge
  const { data: students = [] } = useQuery({
    queryKey: ['sidebar-students'],
    queryFn: () => api.students.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch classes for count badge
  const { data: classes = [] } = useQuery({
    queryKey: ['sidebar-classes'],
    queryFn: () => api.classes.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/app') return { title: 'Dashboard', description: 'Comprehensive overview and analytics' };
    if (path.includes('/app/students')) return { title: 'Students', description: 'Manage student records and profiles' };
    if (path.includes('/app/teachers')) return { title: 'Teachers', description: 'Manage teacher accounts and assignments' };
    if (path.includes('/app/calendar')) return { title: 'Academic Calendar', description: 'Manage events, schedules, and academic calendar' };
    if (path.includes('/app/attendance')) return { title: 'Attendance', description: 'Track and analyze attendance data' };
    if (path.includes('/app/faculties')) return { title: 'Faculties', description: 'Manage faculties, semesters, and classes' };
    if (path.includes('/app/schedules')) return { title: 'Schedules', description: 'Class and exam scheduling management' };
    if (path.includes('/app/analytics')) return { title: 'Analytics', description: 'System-wide analytics and reporting' };
    if (path.includes('/app/monitoring')) return { title: 'System Monitor', description: 'Real-time monitoring, alerts, and system status' };
    if (path.includes('/app/auto-absent')) return { title: 'Auto-Absent Control', description: 'Manage automatic absent marking system' };
    if (path.includes('/app/notifications')) return { title: 'Notifications', description: 'System notifications and alerts management' };
    if (path.includes('/app/tools/reset-link')) return { title: 'Password Reset', description: 'Generate secure password reset links for users' };
    if (path.includes('/app/settings')) return { title: 'Settings', description: 'System configuration and preferences' };
    return { title: 'Dashboard', description: 'Welcome to AttendAI' };
  };

  const pageInfo = getPageInfo();

  const navGroups: NavGroup[] = [
    {
      groupLabel: 'Navigation',
      items: [
        { label: 'Dashboard', to: '/app', icon: Dashboard, end: true },
        { label: 'Students', to: '/app/students', icon: UserMultiple, badge: students.length > 0 ? students.length.toString() : undefined },
        { label: 'Teachers', to: '/app/teachers', icon: Collaborate, isNew: true },
        { label: 'Academic Calendar', to: '/app/calendar', icon: Calendar, isNew: true },
        { label: 'Attendance', to: '/app/attendance', icon: Notebook },
        { label: 'Faculties', to: '/app/faculties', icon: Enterprise, badge: classes.length > 0 ? classes.length.toString() : undefined },
        { label: 'Schedules', to: '/app/schedules', icon: Time },
      ]
    },
    {
      groupLabel: 'Analytics',
      items: [
        { label: 'Analytics', to: '/app/analytics', icon: ChartLine, isNew: true },
        { label: 'System Monitor', to: '/app/monitoring', icon: Activity, isNew: true },
      ]
    },
    {
      groupLabel: 'System',
      items: [
        { label: 'Semester Setup', to: '/app/admin/semester-configuration', icon: SettingsAdjust, isNew: true },
        { label: 'Auto-Absent Control', to: '/app/auto-absent', icon: Flash, isNew: true },
        { label: 'Notifications', to: '/app/notifications', icon: Notification, isNew: true },
        { label: 'Password Reset', to: '/app/tools/reset-link', icon: Password, isNew: true },
        { label: 'Settings', to: '/app/settings', icon: Settings },
      ]
    }
  ];

  return (
    <AppShell
      roleLabel="Administrator"
      navGroups={navGroups}
      user={user}
      onSignOut={signOut}
      pageTitle={pageInfo.title}
      pageDescription={pageInfo.description}
      headerActions={<NotificationCenter />}
    >
      {children}
    </AppShell>
  );
};

export default DashboardSidebar;
