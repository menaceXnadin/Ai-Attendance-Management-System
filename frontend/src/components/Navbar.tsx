
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, User, LogOut, Home, Book, Info, LayoutDashboard, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => setIsMenuOpen((open) => !open);

  const styles = {
    background: isScrolled ? 'bg-slate-900/90 backdrop-blur-lg shadow-lg' : 'bg-transparent',
    textColor: 'text-blue-100',
    hoverColor: 'hover:text-teal-300',
    logoGradient: 'from-white to-blue-200',
    logoHoverGradient: 'group-hover:from-blue-300 group-hover:to-teal-300',
    buttonBorder: 'border-blue-400/30',
    buttonHoverBorder: 'hover:border-teal-400/50',
    mobileMenuBg: 'bg-slate-900/95',
  };

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${styles.background}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center group">
              {/* Plain logo image — no rounded mask or gradient wrapper */}
              <img src="/main.png" alt="AttendAI" className="h-10 w-10 object-contain" />
              <span className={`ml-3 text-xl font-bold bg-gradient-to-r ${styles.logoGradient} bg-clip-text text-transparent ${styles.logoHoverGradient} transition-all duration-300`}>AttendAI</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <Link to="/" className={`px-3 py-2 ${styles.textColor} ${styles.hoverColor} flex items-center gap-1.5 transition-colors`}>
              <Home size={18} />
              <span>Home</span>
            </Link>
            <Link to="/blog" className={`px-3 py-2 ${styles.textColor} ${styles.hoverColor} flex items-center gap-1.5 transition-colors`}>
              <Book size={18} />
              <span>Blog</span>
            </Link>
            <Link to="/about" className={`px-3 py-2 ${styles.textColor} ${styles.hoverColor} flex items-center gap-1.5 transition-colors`}>
              <Info size={18} />
              <span>About</span>
            </Link>
            {user ? (
              <>
                <Link to="/app">
                  <Button variant="outline" className={`ml-4 ${styles.buttonBorder} ${styles.buttonHoverBorder} ${styles.textColor} ${styles.hoverColor} hover:bg-blue-900/50 transition-all duration-300 flex gap-2 items-center`}>
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className={`flex gap-2 items-center ${styles.textColor} hover:text-red-300 hover:bg-red-950/20 transition-all duration-300`}
                  onClick={signOut}
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] transition-all duration-300 border-0">
                    Login
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className={`inline-flex items-center justify-center p-2 rounded-md ${styles.textColor} ${styles.hoverColor} focus:outline-none transition-colors`}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className={`md:hidden ${styles.mobileMenuBg} backdrop-blur-lg shadow-lg rounded-b-xl border border-slate-700/50 animate-fade-in-up overflow-hidden`}>
          <div className="px-4 pt-3 pb-4 space-y-2">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-base font-medium ${styles.textColor} hover:bg-blue-800/20 ${styles.hoverColor} transition-colors`}
              onClick={toggleMenu}
            >
              <Home size={18} />
              <span>Home</span>
            </Link>
            <Link
              to="/blog"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-base font-medium ${styles.textColor} hover:bg-blue-800/20 ${styles.hoverColor} transition-colors`}
              onClick={toggleMenu}
            >
              <Book size={18} />
              <span>Blog</span>
            </Link>
            <Link
              to="/about"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-base font-medium ${styles.textColor} hover:bg-blue-800/20 ${styles.hoverColor} transition-colors`}
              onClick={toggleMenu}
            >
              <Info size={18} />
              <span>About</span>
            </Link>
            {user ? (
              <>
                <Link
                  to="/app"
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-base font-medium ${styles.textColor} hover:bg-blue-800/20 ${styles.hoverColor} transition-colors`}
                  onClick={toggleMenu}
                >
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    toggleMenu();
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-base font-medium ${styles.textColor} hover:bg-red-950/20 hover:text-red-300 transition-colors`}
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 px-3 py-3 mt-2 rounded-lg text-base font-medium bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white shadow-md transition-all"
                  onClick={toggleMenu}
                >
                  <User size={18} />
                  <span>Login</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
