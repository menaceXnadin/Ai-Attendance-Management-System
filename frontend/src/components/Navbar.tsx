import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  Close, 
  User, 
  Logout, 
  Home, 
  Information, 
  Dashboard 
} from '@carbon/icons-react';
import logo from '@/assets/main.png';
import { useAuth } from '@/contexts/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => setIsMenuOpen((open) => !open);

  const getDashboardLink = () => {
    if (user?.role === 'admin') return '/app';
    if (user?.role === 'faculty' || user?.role === 'teacher') return '/teacher';
    return '/student';
  };

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-200 ${
      isScrolled 
        ? 'bg-surface-default/95 backdrop-blur-md border-b border-border-subtle shadow-xs' 
        : 'bg-surface-default border-b border-border-subtle'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="AttendAI" className="h-8 w-8 object-contain" />
              <span className="text-lg font-bold text-text-primary tracking-tight">AttendAI</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <Link 
              to="/" 
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-canvas rounded-md transition-colors flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
            <Link 
              to="/about" 
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-canvas rounded-md transition-colors flex items-center gap-1.5"
            >
              <Information className="w-3.5 h-3.5" />
              <span>About</span>
            </Link>

            <div className="h-4 w-px bg-border-subtle mx-2" />

            <ThemeToggle className="mr-1" />

            {user ? (
              <div className="flex items-center gap-2">
                <Link to={getDashboardLink()}>
                  <Button variant="default" size="sm" className="text-xs h-8 flex items-center gap-1.5">
                    <Dashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs h-8 flex items-center gap-1.5 text-text-muted hover:text-status-error"
                  onClick={signOut}
                >
                  <Logout className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button size="sm" className="text-xs h-8">
                  Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-canvas focus:outline-none transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <Close className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-surface-default border-b border-border-subtle shadow-card">
          <div className="px-4 pt-2 pb-4 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-canvas transition-colors"
              onClick={toggleMenu}
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              to="/about"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-canvas transition-colors"
              onClick={toggleMenu}
            >
              <Information className="w-4 h-4" />
              <span>About</span>
            </Link>

            <div className="pt-2 border-t border-border-subtle mt-2">
              {user ? (
                <>
                  <Link
                    to={getDashboardLink()}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-action-primary hover:bg-surface-canvas transition-colors"
                    onClick={toggleMenu}
                  >
                    <Dashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      toggleMenu();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-status-error hover:bg-status-error/10 transition-colors"
                  >
                    <Logout className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-action-primary text-white transition-colors"
                  onClick={toggleMenu}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
