import * as React from 'react';
import { NavLink } from 'react-router-dom';
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
} from '@/components/ui/sidebar';
import { CalendarIcon, HomeIcon, LogOutIcon, UsersIcon, Settings, BookOpen } from 'lucide-react';

interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
}

const SidebarNavItem = ({ icon, label, to }: SidebarNavItemProps) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <NavLink
        to={to}
        className={({ isActive }) =>
          isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
        }
      >
        {icon}
        <span>{label}</span>
      </NavLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

interface DashboardSidebarProps {
  children: React.ReactNode;
}

const DashboardSidebar = ({ children }: DashboardSidebarProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeaderComponent className="flex h-16 items-center px-6">
            <span className="text-xl font-semibold text-sidebar-foreground">AttendAI</span>
          </SidebarHeaderComponent>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarNavItem 
                    icon={<HomeIcon className="w-5 h-5" />} 
                    label="Dashboard" 
                    to="/app" 
                  />
                  <SidebarNavItem 
                    icon={<UsersIcon className="w-5 h-5" />} 
                    label="Students" 
                    to="/app/students" 
                  />
                  <SidebarNavItem 
                    icon={<UsersIcon className="w-5 h-5" />} 
                    label="Clients" 
                    to="/app/clients" 
                  />
                  <SidebarNavItem 
                    icon={<CalendarIcon className="w-5 h-5" />} 
                    label="Attendance" 
                    to="/app/attendance" 
                  />
                  <SidebarNavItem 
                    icon={<BookOpen className="w-5 h-5" />} 
                    label="Classes" 
                    to="/app/classes" 
                  />
                  <SidebarNavItem 
                    icon={<Settings className="w-5 h-5" />} 
                    label="Settings" 
                    to="/app/settings" 
                  />
                  <SidebarNavItem 
                    icon={<LogOutIcon className="w-5 h-5" />} 
                    label="Logout" 
                    to="/login" 
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        
        <div className="flex-1">
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <SidebarTrigger />
            <h1 className="ml-4 text-xl font-semibold text-gray-900">Admin Dashboard</h1>
          </div>
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardSidebar;
