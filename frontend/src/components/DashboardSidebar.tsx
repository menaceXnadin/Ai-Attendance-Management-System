import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import { AppShell, type NavGroup } from '@/components/layout/AppShell';
import NotificationCenter from '@/components/NotificationCenter';
import {
  Home20Regular,
  Home20Filled,
  People20Regular,
  People20Filled,
  PeopleTeam20Regular,
  PeopleTeam20Filled,
  CalendarLtr20Regular,
  CalendarLtr20Filled,
  ClipboardTaskListLtr20Regular,
  ClipboardTaskListLtr20Filled,
  BuildingMultiple20Regular,
  BuildingMultiple20Filled,
  Clock20Regular,
  Clock20Filled,
  DataTrending20Regular,
  DataTrending20Filled,
  Pulse20Regular,
  Pulse20Filled,
  CalendarSettings20Regular,
  CalendarSettings20Filled,
  Flash20Regular,
  Flash20Filled,
  Alert20Regular,
  Alert20Filled,
  Key20Regular,
  Key20Filled,
  Settings20Regular,
  Settings20Filled,
} from '@fluentui/react-icons';

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
        { label: 'Dashboard', to: '/app', icon: Home20Regular, activeIcon: Home20Filled, end: true },
        { label: 'Students', to: '/app/students', icon: People20Regular, activeIcon: People20Filled, badge: students.length > 0 ? students.length.toString() : undefined },
        { label: 'Teachers', to: '/app/teachers', icon: PeopleTeam20Regular, activeIcon: PeopleTeam20Filled, isNew: true },
        { label: 'Academic Calendar', to: '/app/calendar', icon: CalendarLtr20Regular, activeIcon: CalendarLtr20Filled, isNew: true },
        { label: 'Attendance', to: '/app/attendance', icon: ClipboardTaskListLtr20Regular, activeIcon: ClipboardTaskListLtr20Filled },
        { label: 'Faculties', to: '/app/faculties', icon: BuildingMultiple20Regular, activeIcon: BuildingMultiple20Filled, badge: classes.length > 0 ? classes.length.toString() : undefined },
        { label: 'Schedules', to: '/app/schedules', icon: Clock20Regular, activeIcon: Clock20Filled },
      ]
    },
    {
      groupLabel: 'Analytics',
      items: [
        { label: 'Analytics', to: '/app/analytics', icon: DataTrending20Regular, activeIcon: DataTrending20Filled, isNew: true },
        { label: 'System Monitor', to: '/app/monitoring', icon: Pulse20Regular, activeIcon: Pulse20Filled, isNew: true },
      ]
    },
    {
      groupLabel: 'System',
      items: [
        { label: 'Semester Setup', to: '/app/admin/semester-configuration', icon: CalendarSettings20Regular, activeIcon: CalendarSettings20Filled, isNew: true },
        { label: 'Auto-Absent Control', to: '/app/auto-absent', icon: Flash20Regular, activeIcon: Flash20Filled, isNew: true },
        { label: 'Notifications', to: '/app/notifications', icon: Alert20Regular, activeIcon: Alert20Filled, isNew: true },
        { label: 'Password Reset', to: '/app/tools/reset-link', icon: Key20Regular, activeIcon: Key20Filled, isNew: true },
        { label: 'Settings', to: '/app/settings', icon: Settings20Regular, activeIcon: Settings20Filled },
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
