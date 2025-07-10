import * as React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-blue-950 pt-10 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <Link to="/" className="flex items-center">
              <span className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </span>
              <span className="ml-2 text-xl font-bold text-blue-400">AttendAI</span>
            </Link>
            <p className="mt-4 text-blue-100">
              Revolutionizing classroom attendance with AI-powered facial recognition.
            </p>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-blue-300 tracking-wider uppercase">Features</h3>
            <ul className="mt-4 space-y-2">
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Facial Recognition</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Attendance Reports</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Student Management</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Analytics Dashboard</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-blue-300 tracking-wider uppercase">Support</h3>
            <ul className="mt-4 space-y-2">
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Help Center</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Documentation</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Contact Us</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">FAQ</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-blue-300 tracking-wider uppercase">Legal</h3>
            <ul className="mt-4 space-y-2">
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Privacy Policy</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Terms of Service</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">Data Processing</Link></li>
              <li><Link to="/" className="text-blue-100 hover:text-blue-400">GDPR Compliance</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 border-t border-blue-900 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-blue-200">
            &copy; {new Date().getFullYear()} AttendAI. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-blue-400 hover:text-blue-300">
              <span className="sr-only">Facebook</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-blue-400 hover:text-blue-300">
              <span className="sr-only">Twitter</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
            <a href="#" className="text-blue-400 hover:text-blue-300">
              <span className="sr-only">LinkedIn</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
