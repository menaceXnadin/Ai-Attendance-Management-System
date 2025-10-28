import * as React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-slate-950 to-blue-950 pt-20 pb-10 relative overflow-hidden">
      {/* Background decoration elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-5 blur-3xl"></div>
        <div className="absolute bottom-60 -left-20 w-60 h-60 bg-teal-400 rounded-full opacity-5 blur-3xl"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Newsletter Section */}
        <div className="mb-20">
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-slate-700/50 shadow-lg max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
                  Join Our Newsletter
                </h3>
                <p className="text-blue-200/80 mb-0">
                  Stay updated with the latest features, tips, and educational insights from AttendAI.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="flex-grow px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/70 text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
                <Button className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] transition-all duration-300 border-0">
                  Subscribe <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="col-span-1 md:col-span-4">
            <Link to="/" className="flex items-center group">
              {/* Footer logo: use uploaded main.png from public folder */}
              <img
                src="/main.png"
                alt="AttendAI"
                className="h-10 w-10 rounded-xl object-cover shadow-[0_0_15px_rgba(56,189,248,0.3)]"
              />
              <span className="ml-3 text-xl font-bold bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent">AttendAI</span>
            </Link>
            <p className="mt-5 text-blue-200/80 max-w-md">
              Revolutionizing classroom attendance with AI-powered facial recognition technology that saves time and improves accuracy for educators worldwide.
            </p>
            <div className="mt-6 flex items-center space-x-5">
              <a href="#" className="text-blue-300 hover:text-teal-300 transition-colors">
                <span className="sr-only">Facebook</span>
                <Facebook size={20} />
              </a>
              <a href="#" className="text-blue-300 hover:text-teal-300 transition-colors">
                <span className="sr-only">Twitter</span>
                <Twitter size={20} />
              </a>
              <a href="#" className="text-blue-300 hover:text-teal-300 transition-colors">
                <span className="sr-only">LinkedIn</span>
                <Linkedin size={20} />
              </a>
            </div>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-base font-semibold text-white tracking-wider uppercase mb-5 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">Features</h3>
            <ul className="space-y-3">
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Facial Recognition</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Attendance Reports</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Student Management</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Analytics Dashboard</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-base font-semibold text-white tracking-wider uppercase mb-5 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">Support</h3>
            <ul className="space-y-3">
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Help Center</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Documentation</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Contact Us</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">FAQ</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-base font-semibold text-white tracking-wider uppercase mb-5 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">Legal</h3>
            <ul className="space-y-3">
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Terms of Service</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">Data Processing</Link></li>
              <li><Link to="/" className="text-blue-200/80 hover:text-teal-300 transition-colors">GDPR Compliance</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-base font-semibold text-white tracking-wider uppercase mb-5 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-blue-200/80">
                <Mail size={16} className="text-teal-400" />
                <span>support@attendai.com</span>
              </li>
              <li className="flex items-center gap-2 text-blue-200/80">
                <Phone size={16} className="text-teal-400" />
                <span>+977 9862748653</span>
              </li>
              <li className="flex items-start gap-2 text-blue-200/80">
                <MapPin size={16} className="text-teal-400 mt-1" />
                <span>PatanDhoka, Lalitpur<br />Nepal</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-slate-700/40 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-blue-200/70">
            &copy; {new Date().getFullYear()} AttendAI. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 text-sm text-blue-200/70 flex flex-wrap gap-6">
            <Link to="/" className="hover:text-teal-300 transition-colors">Privacy</Link>
            <Link to="/" className="hover:text-teal-300 transition-colors">Terms</Link>
            <Link to="/" className="hover:text-teal-300 transition-colors">Cookies</Link>
            <Link to="/" className="hover:text-teal-300 transition-colors">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
