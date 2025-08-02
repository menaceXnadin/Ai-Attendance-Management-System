import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader as SidebarHeaderComponent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarProvider,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CalendarIcon, 
  HomeIcon, 
  LogOutIcon, 
  UsersIcon, 
  Settings, 
  BookOpen,
  BarChart3,
  Bell,
  Camera,
  Shield,
  Zap,
  Activity,
  Target,
  Globe
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationCenter from '@/components/NotificationCenter';
import { useAuth } from '@/contexts/useAuth';

interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  onClick?: () => void | Promise<void>;
  badge?: string;
  isNew?: boolean;
}

const SidebarNavItem = ({ icon, label, to, onClick, badge, isNew }: SidebarNavItemProps) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
          `flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all duration-200 hover:bg-sidebar-accent/50 ${
            isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-lg' : ''
          }`
        }
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
          {isNew && (
            <Badge className="bg-green-500/20 text-green-300 text-xs px-1 py-0">
              NEW
            </Badge>
          )}
        </div>
        {badge && (
          <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/30">
            {badge}
          </Badge>
        )}
      </NavLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

interface DashboardSidebarProps {
  children: React.ReactNode;
}


import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

const DashboardSidebar = ({ children }: DashboardSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  // Fetch students for real count
  const { data: students = [] } = useQuery({
    queryKey: ['sidebar-students'],
    queryFn: () => api.students.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch classes for real count
  const { data: classes = [] } = useQuery({
    queryKey: ['sidebar-classes'],
    queryFn: () => api.classes.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch system health for sidebar stats
  const { data: systemHealth } = useQuery({
    queryKey: ['sidebar-system-health'],
    queryFn: () => api.dashboard.getSystemHealth(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });

  // Map route to title and description
  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/app') return { title: 'Dashboard', description: 'Comprehensive overview and analytics' };
    if (path.includes('/app/students')) return { title: 'Students', description: 'Manage student records and profiles' };
    if (path.includes('/app/attendance')) return { title: 'Attendance', description: 'Track and analyze attendance data' };
    if (path.includes('/app/faculties')) return { title: 'Faculties', description: 'Manage faculties, semesters, and classes' };
    if (path.includes('/app/settings')) return { title: 'Settings', description: 'System configuration and preferences' };
    return { title: 'Dashboard', description: 'Welcome to AttendAI' };
  };

  const pageInfo = getPageInfo();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
        <Sidebar className="border-r border-slate-700/50 bg-slate-900/60 backdrop-blur-md">
          <SidebarHeaderComponent className="flex h-20 items-center px-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
                  AttendAI
                </span>
                <p className="text-xs text-slate-400">Smart Attendance System</p>
              </div>
            </div>
          </SidebarHeaderComponent>
          
          <SidebarContent className="px-4 py-6">
            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-400 font-medium mb-4">
                Main Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2">
                  <SidebarNavItem 
                    icon={<HomeIcon className="w-5 h-5" />} 
                    label="Dashboard" 
                    to="/app" 
                  />
                  <SidebarNavItem 
                    icon={<UsersIcon className="w-5 h-5" />} 
                    label="Students" 
                    to="/app/students"
                    badge={students.length > 0 ? students.length.toString() : undefined}
                  />
                  <SidebarNavItem 
                    icon={<CalendarIcon className="w-5 h-5" />} 
                    label="Attendance" 
                    to="/app/attendance" 
                  />
                  <SidebarNavItem 
                    icon={<Shield className="w-5 h-5" />} 
                    label="Faculties" 
                    to="/app/faculties"
                    badge={classes.length > 0 ? classes.length.toString() : undefined}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-8">
              <SidebarGroupLabel className="text-slate-400 font-medium mb-4">
                Analytics & Reports
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2">
                  <SidebarNavItem 
                    icon={<BarChart3 className="w-5 h-5" />} 
                    label="Analytics" 
                    to="/app/analytics"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<Activity className="w-5 h-5" />} 
                    label="Live Monitoring" 
                    to="/app/monitoring"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<Target className="w-5 h-5" />} 
                    label="Performance" 
                    to="/app/performance"
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-8">
              <SidebarGroupLabel className="text-slate-400 font-medium mb-4">
                System
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2">
                  <SidebarNavItem 
                    icon={<Bell className="w-5 h-5" />} 
                    label="Notifications" 
                    to="/app/notifications"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<Settings className="w-5 h-5" />} 
                    label="Settings" 
                    to="/app/settings" 
                  />
                  <SidebarNavItem 
                    icon={<Shield className="w-5 h-5" />} 
                    label="Security" 
                    to="/app/security"
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          
          <SidebarFooter className="px-4 py-4 border-t border-slate-700/50">
            <div className="space-y-4">
              {/* System Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-slate-300">System Online</span>
                </div>
                <Badge className="bg-green-500/20 text-green-300 text-xs">
                  {systemHealth?.uptime_percentage ? `${systemHealth.uptime_percentage}%` : '99.9%'}
                </Badge>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {user?.name?.charAt(0) || 'A'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{user?.name || 'Admin'}</p>
                  <p className="text-xs text-slate-400">Administrator</p>
                </div>
              </div>

              {/* Logout Button */}
              <Button
                variant="outline"
                onClick={signOut}
                className="w-full border-red-600/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
              >
                <LogOutIcon className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex-1">
          {/* Enhanced Header */}
          <div className="relative z-50 flex items-center justify-between h-20 px-6 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-slate-300 hover:text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">{pageInfo.title}</h1>
                <p className="text-sm text-slate-400">{pageInfo.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/50">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-slate-300">Fast Processing</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/50">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-slate-300">Cloud Sync</span>
                </div>
              </div>
              
              {/* Notifications */}
              <NotificationCenter />
              
              {/* Theme Toggle */}
              <ThemeToggle />
            </div>
          </div>

          {/* Main Content */}
          <main className="p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardSidebar;
