import * as React from 'react';
import { Link } from 'react-router-dom';
import { 
  LogoFacebook, 
  LogoTwitter, 
  LogoLinkedin, 
  Email, 
  Phone, 
  Location, 
  ArrowRight 
} from '@carbon/icons-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/main.png';

const Footer: React.FC = () => {
  return (
    <footer className="bg-surface-default border-t border-border-subtle pt-16 pb-12 text-text-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Newsletter Section - Clean divided layout without card nesting */}
        <div className="mb-14 pb-12 border-b border-border-subtle">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                Institutional Updates & Release Notes
              </h3>
              <p className="text-xs text-text-muted max-w-md">
                Stay updated with platform patches, security improvements, and attendance telemetry enhancements.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 max-w-md md:ml-auto w-full">
              <input 
                type="email" 
                placeholder="department@institution.edu" 
                className="flex-1 px-3 py-2 rounded-md bg-surface-canvas border border-border-subtle text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
              />
              <Button size="sm" className="text-xs h-9 flex items-center justify-center gap-1.5 flex-shrink-0">
                <span>Subscribe</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="col-span-1 md:col-span-4 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="AttendAI" className="h-7 w-7 object-contain" />
              <span className="text-base font-bold text-text-primary tracking-tight">AttendAI</span>
            </Link>
            <p className="text-xs text-text-muted leading-relaxed max-w-sm">
              Enterprise classroom attendance management engine powered by high-accuracy biometric facial verification and institutional analytics.
            </p>
            <div className="flex items-center space-x-3 pt-1">
              <a href="#" className="p-1.5 rounded-md hover:bg-surface-canvas text-text-muted hover:text-text-primary transition-colors" aria-label="Facebook">
                <LogoFacebook className="w-4 h-4" />
              </a>
              <a href="#" className="p-1.5 rounded-md hover:bg-surface-canvas text-text-muted hover:text-text-primary transition-colors" aria-label="Twitter">
                <LogoTwitter className="w-4 h-4" />
              </a>
              <a href="#" className="p-1.5 rounded-md hover:bg-surface-canvas text-text-muted hover:text-text-primary transition-colors" aria-label="LinkedIn">
                <LogoLinkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">Platform</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/app" className="text-text-muted hover:text-text-primary transition-colors">Admin Portal</Link></li>
              <li><Link to="/teacher" className="text-text-muted hover:text-text-primary transition-colors">Teacher Portal</Link></li>
              <li><Link to="/student" className="text-text-muted hover:text-text-primary transition-colors">Student Portal</Link></li>
              <li><Link to="/app/calendar" className="text-text-muted hover:text-text-primary transition-colors">Academic Calendar</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">Support</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/about" className="text-text-muted hover:text-text-primary transition-colors">About AttendAI</Link></li>
              <li><Link to="/status" className="text-text-muted hover:text-text-primary transition-colors">System Telemetry</Link></li>
              <li><Link to="/forgot-password" className="text-text-muted hover:text-text-primary transition-colors">Account Recovery</Link></li>
              <li><Link to="/login" className="text-text-muted hover:text-text-primary transition-colors">Portal Authentication</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1 md:col-span-4">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">Institutional Contact</h3>
            <ul className="space-y-2 text-xs text-text-muted">
              <li className="flex items-center gap-2">
                <Email className="w-3.5 h-3.5 text-action-primary flex-shrink-0" />
                <span>support@attendai.edu</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-action-primary flex-shrink-0" />
                <span>+977 (01) 554-1234</span>
              </li>
              <li className="flex items-start gap-2">
                <Location className="w-3.5 h-3.5 text-action-primary flex-shrink-0 mt-0.5" />
                <span>Department of Computer Engineering, Lalitpur, Nepal</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-6 border-t border-border-subtle flex flex-col sm:flex-row justify-between items-center text-xs text-text-muted gap-4">
          <p>
            &copy; {new Date().getFullYear()} AttendAI Engineering System. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/" className="hover:text-text-primary transition-colors">Institutional Privacy Policy</Link>
            <Link to="/" className="hover:text-text-primary transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-text-primary transition-colors">Security Architecture</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
