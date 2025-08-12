import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  CalendarIcon, 
  HomeIcon, 
  LogOutIcon, 
  UserIcon, 
  BarChart3Icon, 
  GraduationCapIcon,
  CameraIcon,
  ClockIcon,
  MenuIcon,
  XIcon
} from 'lucide-react';
import ProfileDropdown from '@/components/ProfileDropdown';
import { useAuth } from '@/contexts/useAuth';

interface StudentSidebarProps {
  children: React.ReactNode;
}

const StudentSidebar = ({ children }: StudentSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  
  // Map route to title for student pages
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/student' || path === '/student/dashboard') return 'Dashboard';
    if (path.includes('/student/attendance')) return 'My Attendance';
    if (path.includes('/student/marks')) return 'My Marks';
    if (path.includes('/student/profile')) return 'My Profile';
    if (path.includes('/student/face-registration') || path === '/face-registration') return 'Face Registration';
    return 'Student Portal';
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
      {/* Fixed Sidebar */}
      <div
        className="fixed top-0 left-0 h-screen z-40 bg-slate-900/70 backdrop-blur-md border-r border-slate-700/50 flex flex-col"
        style={{
          width: isCollapsed ? 80 : 256,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700/50">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                <GraduationCapIcon className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">AttendAI</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <MenuIcon className="h-5 w-5" /> : <XIcon className="h-5 w-5" />}
          </button>
        </div>
        
        {/* Navigation */}
  <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto min-h-0">
          {/* Main Navigation */}
          <div>
            {!isCollapsed && (
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Student Portal
              </h3>
            )}
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
                to="/student/attendance/mark"
                end
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "Mark Attendance" : ""}
              >
                <CameraIcon className="w-6 h-6" />
                {!isCollapsed && "Mark Attendance"}
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
                <CalendarIcon className="w-6 h-6" />
                {!isCollapsed && "My Attendance"}
              </NavLink>

              <NavLink
                to="/student/marks"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? "My Marks" : ""}
              >
                <BarChart3Icon className="w-6 h-6" />
                {!isCollapsed && "My Marks"}
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
                <CameraIcon className="w-6 h-6" />
                {!isCollapsed && "Face Registration"}
              </NavLink>
            </nav>
          </div>

          {/* Settings Section (currently no additional items) */}
        </div>
        
        {/* Sidebar Footer */}
  <div className="p-4 border-t border-slate-700/50 bg-slate-900/80 mt-auto">
          <div className="space-y-3">
            {/* User Info */}
            {!isCollapsed && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
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
            )}
            
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
    className="flex flex-col min-h-screen transition-all duration-300"
    style={{ marginLeft: isCollapsed ? 80 : 256, transition: 'margin-left 0.3s' }}
  >
        {/* Top Header Bar */}
        <div className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-700/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-blue-200/80">
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
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default StudentSidebar;
