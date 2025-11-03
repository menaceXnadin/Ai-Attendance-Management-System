import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { LogOutIcon, HomeIcon, UserIcon, MenuIcon, XIcon, Bell, FileText, Calendar, Users, BookOpen } from 'lucide-react';
import ProfileDropdown from '@/components/ProfileDropdown';
import logo from '@/assets/main.png';

interface TeacherSidebarProps {
  children: React.ReactNode;
}

const TeacherSidebar = ({ children }: TeacherSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/teacher') return 'Teacher Dashboard';
    if (path.includes('/teacher/attendance')) return 'Mark Attendance';
    if (path.includes('/teacher/notifications')) return 'Notifications';
    if (path.includes('/teacher/schedule')) return 'My Schedule';
    if (path.includes('/teacher/subjects')) return 'Subject Details';
    if (path.includes('/teacher/profile')) return 'My Profile';
    return 'Teacher Portal';
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 overflow-hidden">
      {/* Fixed Sidebar */}
      <div
        className={`fixed top-0 left-0 h-screen z-40 bg-slate-900/70 backdrop-blur-md border-r border-slate-700/50 flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-center px-4 border-b border-slate-700/50 relative flex-shrink-0">
          <div className={`flex items-center gap-3 transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            <img src={logo} alt="AttendAI" className="h-10 w-10 object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.6))' }} />
            <span className="text-xl font-semibold text-white">AttendAI</span>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute right-4 p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <MenuIcon className="h-5 w-5" /> : <XIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto min-h-0">
          <div>
            <div className="h-6 mb-3 flex items-center overflow-hidden">
              <h3 className={`text-xs font-semibold text-slate-400 uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'}`}>
                Teacher Portal
              </h3>
            </div>
            <nav className="space-y-1">
              <NavLink
                to="/teacher"
                end
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? 'Dashboard' : ''}
              >
                <HomeIcon className="w-5 h-5" />
                {!isCollapsed && 'Dashboard'}
              </NavLink>
              
              <NavLink
                to="/teacher/attendance"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? 'Mark Attendance' : ''}
              >
                <FileText className="w-5 h-5" />
                {!isCollapsed && 'Mark Attendance'}
              </NavLink>
              
              <NavLink
                to="/teacher/notifications"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? 'Notifications' : ''}
              >
                <Bell className="w-5 h-5" />
                {!isCollapsed && 'Notifications'}
              </NavLink>
              
              <NavLink
                to="/teacher/schedule"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? 'My Schedule' : ''}
              >
                <Calendar className="w-5 h-5" />
                {!isCollapsed && 'My Schedule'}
              </NavLink>
              
              <NavLink
                to="/teacher/profile"
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-teal-400/20 text-white border border-blue-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`
                }
                title={isCollapsed ? 'My Profile' : ''}
              >
                <UserIcon className="w-5 h-5" />
                {!isCollapsed && 'My Profile'}
              </NavLink>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-900/80 mt-auto flex-shrink-0">
          <div className="space-y-3">
            <div className={`transition-opacity duration-200 ${isCollapsed ? 'opacity-0 h-0' : 'opacity-100'}`}>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-400 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name || 'Teacher'}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email || 'teacher@example.com'}</p>
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2 rounded-lg text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-all`}
              title={isCollapsed ? 'Sign Out' : ''}
            >
              <LogOutIcon className="w-4 h-4" />
              {!isCollapsed && 'Sign Out'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-20' : 'pl-64'}`}>
        {/* Top Header Bar */}
        <div className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-700/50 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-blue-200/80">
              Welcome, <span className="font-medium text-white">{user?.name?.split(' ')[0] || 'Teacher'}</span>
            </div>
            <ProfileDropdown
              name={user?.name?.split(' ')[0] || 'Teacher'}
              onViewProfile={() => navigate('/teacher/profile')}
              onSignOut={signOut}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
};

export default TeacherSidebar;
