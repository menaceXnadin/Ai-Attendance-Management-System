import * as React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-blue-950 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center">
              <span className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </span>
              <span className="ml-2 text-xl font-bold text-blue-400">AttendAI</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/" className="px-3 py-2 text-blue-100 hover:text-blue-400">Home</Link>
            <Link to="/blog" className="px-3 py-2 text-blue-100 hover:text-blue-400">Blog</Link>
            <Link to="/about" className="px-3 py-2 text-blue-100 hover:text-blue-400">About</Link>
            
            {user ? (
              <>
                <Link to="/app">
                  <Button variant="outline" className="ml-4">Dashboard</Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="flex gap-2 items-center" 
                  onClick={signOut}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button className="bg-blue-400 hover:bg-blue-500 text-blue-950">Login</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-brand-500 focus:outline-none"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white shadow-lg rounded-b-lg">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-500"
              onClick={toggleMenu}
            >
              Home
            </Link>
            <Link
              to="/blog"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-500"
              onClick={toggleMenu}
            >
              Blog
            </Link>
            <Link
              to="/about"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-500"
              onClick={toggleMenu}
            >
              About
            </Link>
            
            {user ? (
              <>
                <Link
                  to="/app"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-500"
                  onClick={toggleMenu}
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    toggleMenu();
                  }}
                  className="flex w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-500"
                >
                  <LogOut size={16} className="mr-2" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-3 py-2 mt-4 rounded-md text-base font-medium bg-brand-500 text-white hover:bg-brand-600"
                  onClick={toggleMenu}
                >
                  Login
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
