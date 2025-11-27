import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import { 
  CalendarIcon, 
  HomeIcon, 
  LogOutIcon, 
  UserIcon, 
  CameraIcon,
  ClockIcon,
  MenuIcon,
  XIcon,
  CheckCircle,
  Bell
} from 'lucide-react';
import ProfileDropdown from '@/components/ProfileDropdown';
import logo from '@/assets/main.png';

interface StudentSidebarProps {
  children: React.ReactNode;
}

const StudentSidebar = ({ children }: StudentSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  
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
  
  // Map route to title for student pages
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/student' || path === '/student/dashboard') return 'Dashboard';
    if (path.includes('/student/attendance')) return 'My Attendance';
    if (path.includes('/student/calendar')) return 'Academic Calendar';
    // Removed My Marks page
    if (path.includes('/student/profile')) return 'My Profile';

    if (path.includes('/student/notifications')) return 'Notifications';
    if (path.includes('/student/face-registration') || path === '/face-registration') return 'Face Registration';
    return 'Student Portal';
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Fixed Sidebar */}
      <div
        className={`fixed top-0 left-0 h-screen z-40 bg-slate-900/70 backdrop-blur-md border-r border-slate-700/50 flex flex-col transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-center px-4 border-b border-slate-700/50 relative flex-shrink-0">
          <div className={`flex items-center gap-3 transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            <img src={logo} alt="AttendAI" className="h-10 w-10 object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.6))' }} />
            <span className="text-xl font-semibold text-white">AttendAI</span>
          </div>
          {/* Desktop collapse button - hidden on mobile */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:block absolute right-4 p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <MenuIcon className="h-5 w-5" /> : <XIcon className="h-5 w-5" />}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden absolute right-4 p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors"
            title="Close Menu"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto min-h-0">
          {/* Main Navigation */}
          <div>
            <div className="h-6 mb-3 flex items-center overflow-hidden">
              <h3 className={`text-xs font-semibold text-slate-400 uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'}`}>
                Student Portal
              </h3>
            </div>
            <nav className="space-y-1">
              <NavLink
                to="/student"
                end
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "Dashboard" : ""}
              >
                <HomeIcon className="w-6 h-6" />
                {!isCollapsed && "Dashboard"}
              </NavLink>

              <NavLink
                to="/student/attendance"
                end
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "My Attendance" : ""}
              >
                <ClockIcon className="w-6 h-6" />
                {!isCollapsed && "My Attendance"}
              </NavLink>

              <NavLink
                to="/student/calendar"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "Academic Calendar" : ""}
              >
                <CalendarIcon className="w-6 h-6" />
                {!isCollapsed && "Academic Calendar"}
              </NavLink>

              {/* My Marks navigation removed */}

              <NavLink
                to="/student/notifications"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "Notifications" : ""}
              >
                <Bell className="w-6 h-6" />
                {!isCollapsed && "Notifications"}
              </NavLink>

              <NavLink
                to="/student/profile"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "My Profile" : ""}
              >
                <UserIcon className="w-6 h-6" />
                {!isCollapsed && "My Profile"}
              </NavLink>

              <NavLink
                to="/face-registration"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-400/20 text-white border border-purple-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "Face Registration" : ""}
              >
                <div className="relative">
                  <CameraIcon className="w-6 h-6" />
                  {isFaceRegistered && (
                    <CheckCircle className="w-3 h-3 text-green-400 absolute -top-1 -right-1 bg-slate-900 rounded-full" />
                  )}
                </div>
                {!isCollapsed && (
                  <div className="flex items-center gap-2 flex-1">
                    <span>Face Registration</span>
                    {isFaceRegistered && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-400/30">
                        Ready
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            </nav>
          </div>

          {/* Settings Section (currently no additional items) */}
        </div>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-900/80 mt-auto flex-shrink-0">
          <div className="space-y-3">
            {/* User Info */}
            <div className={`transition-opacity duration-200 ${isCollapsed ? 'opacity-0 h-0' : 'opacity-100'}`}>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.name || 'Student User'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {user?.email || 'student@example.com'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={signOut}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2 rounded-lg text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-all`}
              title={isCollapsed ? "Sign Out" : ""}
            >
              <LogOutIcon className="w-4 h-4" />
              {!isCollapsed && "Sign Out"}
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isCollapsed ? 'pl-0 lg:pl-20' : 'pl-0 lg:pl-64'
        }`}
      >
        {/* Top Header Bar */}
        <div className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-700/50 flex items-center justify-between px-3 sm:px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors"
              title="Open Menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-white truncate">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:block text-xs sm:text-sm text-blue-200/80">
              Welcome back, <span className="font-medium text-white">{user?.name?.split(' ')[0] || 'Student'}</span>
            </div>
            <ProfileDropdown
              name={user?.name?.split(' ')[0] || 'Student'}
              onViewProfile={() => {
                window.location.href = '/student/profile';
              }}
              onSignOut={signOut}
            />
          </div>
        </div>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default StudentSidebar;
