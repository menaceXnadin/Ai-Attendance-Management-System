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
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Zap,
  Activity,
  Globe,
  GripVertical,
  GraduationCap,
  Users2
} from 'lucide-react';
import logo from '@/assets/main.png';
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

const SidebarNavItem = ({ icon, label, to, onClick, badge, isNew }: SidebarNavItemProps) => {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";

  const navContent = (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} w-full ${isCollapsed ? 'px-0 py-4' : 'px-3 py-2.5'} rounded-lg transition-all duration-300 ease-in-out ${
          isActive 
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-l-4 border-blue-300' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`
      }
      data-sidebar="menu-button"
      data-active={location.pathname === to ? "true" : "false"}
    >
      <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
        <div className={`flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'w-8 h-8' : ''}`}>
          {icon}
        </div>
        {!isCollapsed && (
          <>
            <span className="text-sm">{label}</span>
            {isNew && (
              <Badge className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0 border border-green-500/30">
                NEW
              </Badge>
            )}
          </>
        )}
      </div>
      {!isCollapsed && badge && (
        <Badge variant="outline" className="text-xs bg-slate-700 text-slate-300 border-slate-600">
          {badge}
        </Badge>
      )}
    </NavLink>
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        {isCollapsed ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                {navContent}
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                className="flex items-center gap-2 bg-slate-800 border-slate-700 text-white shadow-xl px-4 py-2.5 rounded-lg"
                sideOffset={12}
              >
                <span className="font-medium">{label}</span>
                {isNew && <Badge className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0 border border-green-500/30">NEW</Badge>}
                {badge && <Badge variant="outline" className="text-xs border-slate-600 bg-slate-700/50">{badge}</Badge>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          navContent
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

interface DashboardSidebarProps {
  children: React.ReactNode;
}

// Internal component that uses useSidebar hook
const SidebarHeaderContent = () => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarHeaderComponent className={`flex h-16 items-center border-b border-slate-800 transition-all duration-300 ${isCollapsed ? 'px-0 justify-center' : 'px-4'}`}>
      <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
        <img 
          src={logo} 
          alt="AttendAI" 
          className={`object-contain transition-all duration-300 hover:scale-110 hover:rotate-6 cursor-pointer ${isCollapsed ? 'h-10 w-10' : 'h-8 w-8'}`}
        />
        {!isCollapsed && (
          <div>
            <span className="text-lg font-semibold text-white">
              AttendAI
            </span>
            <p className="text-xs text-slate-500">Smart Attendance</p>
          </div>
        )}
      </div>
    </SidebarHeaderComponent>
  );
};

// Footer component with collapse support
const SidebarFooterContent = ({ user, signOut }: { user: any; signOut: () => void }) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
    <SidebarFooter className="px-0 py-5 border-t border-slate-800">
      <div className="space-y-5 flex flex-col items-center w-full">
        {/* User Avatar */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center hover:from-blue-500 hover:to-blue-400 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/50 hover:rotate-6 transition-all duration-300 cursor-pointer">
                <span className="text-lg font-bold text-white">
                  {user?.name?.charAt(0) || 'A'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              className="bg-slate-800 border-slate-700 text-white shadow-xl px-4 py-2.5 rounded-lg"
              sideOffset={12}
            >
              <p className="font-semibold">{user?.name || 'Admin'}</p>
              <p className="text-xs text-blue-400 mt-0.5">Administrator</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>          {/* Logout Icon Button */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={signOut}
                  className="w-12 h-12 p-0 border-slate-700 text-slate-400 hover:bg-red-900/30 hover:text-red-400 hover:border-red-600 hover:scale-110 hover:rotate-6 hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300"
                >
                  <LogOutIcon className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                className="bg-slate-800 border-slate-700 text-white shadow-xl px-4 py-2.5 rounded-lg"
                sideOffset={12}
              >
                <p className="font-medium text-red-400">Sign Out</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarFooter>
    );
  }

  return (
    <SidebarFooter className="px-3 py-3 border-t border-slate-800">
      <div className="space-y-2">
        {/* User Info */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-xs font-semibold text-white">
              {user?.name?.charAt(0) || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-[10px] text-slate-500">Administrator</p>
          </div>
        </div>

        {/* Logout Button */}
        <Button
          variant="outline"
          onClick={signOut}
          className="w-full border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white text-sm"
        >
          <LogOutIcon className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </SidebarFooter>
  );
};


import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

const DashboardSidebar = ({ children }: DashboardSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved) : 280;
  });
  const [isResizing, setIsResizing] = React.useState(false);

  // Handle mouse down on resize handle
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle mouse move for resizing
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      // Min width 200px, max width 400px
      if (newWidth >= 200 && newWidth <= 400) {
        setSidebarWidth(newWidth);
        localStorage.setItem('sidebarWidth', newWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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

  // Map route to title and description
  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/app') return { title: 'Dashboard', description: 'Comprehensive overview and analytics' };
    if (path.includes('/app/students')) return { title: 'Students', description: 'Manage student records and profiles' };
    if (path.includes('/app/teachers')) return { title: 'Teachers', description: 'Manage teacher accounts and assignments' };
    if (path.includes('/app/calendar')) return { title: 'Academic Calendar', description: 'Manage events, schedules, and academic calendar' };
    if (path.includes('/app/attendance')) return { title: 'Attendance', description: 'Track and analyze attendance data' };
    if (path.includes('/app/faculties')) return { title: 'Faculties', description: 'Manage faculties, semesters, and classes' };
    if (path.includes('/app/analytics')) return { title: 'Analytics', description: 'System-wide analytics and reporting' };
    if (path.includes('/app/monitoring')) return { title: 'System Monitor', description: 'Real-time monitoring, alerts, and system status' };
    if (path.includes('/app/auto-absent')) return { title: 'Auto-Absent Control', description: 'Manage automatic absent marking system' };
    if (path.includes('/app/notifications')) return { title: 'Notifications', description: 'System notifications and alerts management' };
    if (path.includes('/app/settings')) return { title: 'Settings', description: 'System configuration and preferences' };
    return { title: 'Dashboard', description: 'Welcome to AttendAI' };
  };

  const pageInfo = getPageInfo();

  // Inner content component that has access to sidebar state
  const MainContentArea = () => {
    const { state } = useSidebar();
    const isCollapsed = state === "collapsed";

    return (
      <>
        {/* Resize Handle - only show when NOT collapsed */}
        {!isCollapsed && (
          <div
            className={`fixed inset-y-0 z-50 hidden w-2 cursor-col-resize group transition-colors md:block ${
              isResizing ? 'bg-blue-500/40' : 'bg-transparent hover:bg-slate-600/30'
            }`}
            style={{ left: 'var(--sidebar-width)' }}
            onMouseDown={handleMouseDown}
            onDoubleClick={() => {
              const reset = 280
              setSidebarWidth(reset)
              localStorage.setItem('sidebarWidth', reset.toString())
            }}
          >
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-opacity ${
                isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <div className="bg-slate-700 rounded-full p-1 shadow-lg">
                <GripVertical className="h-4 w-4 text-slate-300" />
              </div>
            </div>
          </div>
        )}

        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-slate-400 hover:text-white" />
              <div>
                <h1 className="text-xl font-semibold text-white">
                  {pageInfo.title}
                </h1>
                <p className="text-xs text-slate-500">{pageInfo.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <NotificationCenter />
              
              {/* Theme Toggle */}
              <ThemeToggle />
            </div>
          </div>

          {/* Main Content */}
          <main className="w-full">{children}</main>
        </div>
      </>
    );
  };

  return (
    <SidebarProvider
      style={{ ["--sidebar-width" as any]: `${sidebarWidth}px` }}
    >
      <div className="relative flex min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 overflow-hidden">
        {/* Background decoration elements removed site-wide per user feedback (glow animation was distracting). */}
        <Sidebar collapsible="icon" className="border-r border-slate-800 bg-slate-900">
            <SidebarHeaderContent />
          
          <SidebarContent className="px-2 py-4">
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 mb-2 text-xs font-medium text-slate-500 uppercase">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2">
                  <SidebarNavItem 
                    icon={<HomeIcon className="w-5 h-5 transition-transform duration-300" />} 
                    label="Dashboard" 
                    to="/app" 
                  />
                  <SidebarNavItem 
                    icon={<UsersIcon className="w-5 h-5 transition-transform duration-300" />} 
                    label="Students" 
                    to="/app/students"
                    badge={students.length > 0 ? students.length.toString() : undefined}
                  />
                  <SidebarNavItem 
                    icon={<Users2 className="w-5 h-5 transition-transform duration-300" />} 
                    label="Teachers" 
                    to="/app/teachers"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<CalendarIcon className="w-5 h-5 transition-transform duration-300" />} 
                    label="Academic Calendar" 
                    to="/app/calendar"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<BookOpen className="w-5 h-5 transition-transform duration-300" />} 
                    label="Attendance" 
                    to="/app/attendance" 
                  />
                  <SidebarNavItem 
                    icon={<GraduationCap className="w-5 h-5 transition-transform duration-300" />} 
                    label="Faculties" 
                    to="/app/faculties"
                    badge={classes.length > 0 ? classes.length.toString() : undefined}
                  />
                  <SidebarNavItem 
                    icon={<CalendarIcon className="w-5 h-5 transition-transform duration-300" />} 
                    label="Schedules" 
                    to="/app/schedules"
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-6">
              <SidebarGroupLabel className="px-3 mb-2 text-xs font-medium text-slate-500 uppercase">
                Analytics
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2">
                  <SidebarNavItem 
                    icon={<BarChart3 className="w-5 h-5 transition-transform duration-300" />} 
                    label="Analytics" 
                    to="/app/analytics"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<Activity className="w-5 h-5 transition-transform duration-300" />} 
                    label="System Monitor" 
                    to="/app/monitoring"
                    isNew={true}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-6">
              <SidebarGroupLabel className="px-3 mb-2 text-xs font-medium text-slate-500 uppercase">
                System
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2">
                  <SidebarNavItem 
                    icon={<CalendarIcon className="w-5 h-5 transition-transform duration-300" />} 
                    label="Semester Setup" 
                    to="/app/admin/semester-configuration"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<Zap className="w-5 h-5 transition-transform duration-300" />} 
                    label="Auto-Absent Control" 
                    to="/app/auto-absent"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<Bell className="w-5 h-5 transition-transform duration-300" />} 
                    label="Notifications" 
                    to="/app/notifications"
                    isNew={true}
                  />
                  <SidebarNavItem 
                    icon={<Settings className="w-5 h-5 transition-transform duration-300" />} 
                    label="Settings" 
                    to="/app/settings" 
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          
          <SidebarFooterContent user={user} signOut={signOut} />
        </Sidebar>

        <MainContentArea />
      </div>
    </SidebarProvider>
  );
};

export default DashboardSidebar;
