import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navigation20Regular, Dismiss20Regular, ArrowRight16Regular } from '@fluentui/react-icons';
import logo from '@/assets/main.png';
import { useAuth } from '@/contexts/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import '@/components/landing/landing.css';

/**
 * Public site navigation (home, about, sign-in pages). Section links point at
 * anchors on the home page; HomePage scrolls to `location.hash` itself because
 * react-router does not.
 */
const NAV_LINKS: { label: string; to: string; section?: boolean }[] = [
  { label: 'Product', to: '/#product', section: true },
  { label: 'How it works', to: '/#how-it-works', section: true },
  { label: 'Trust', to: '/#trust', section: true },
  { label: 'About', to: '/about' },
];

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => setIsMenuOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  const isActive = (to: string, section?: boolean) => !section && location.pathname.startsWith(to);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b bg-surface-default transition-[border-color,box-shadow] duration-150 ease-fluent-standard',
        isScrolled || isMenuOpen ? 'border-border-subtle shadow-xs' : 'border-transparent'
      )}
    >
      <nav aria-label="Main" className="lp-container">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex h-full min-w-0 items-center gap-8">
            <Link to="/" className="flex shrink-0 items-center gap-2 rounded-sm" aria-label="AttendAI home">
              <img src={logo} alt="" className="h-7 w-7 object-contain" />
              <span className="text-[17px] font-semibold leading-6 tracking-[-0.01em] text-text-primary">AttendAI</span>
            </Link>

            <ul className="hidden h-full items-center gap-1 md:flex">
              {NAV_LINKS.map(({ label, to, section }) => {
                const active = isActive(to, section);
                return (
                  <li key={to} className="h-full">
                    <Link
                      to={to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-full items-center px-3 text-body transition-colors duration-150 ease-fluent-standard',
                        'after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:transition-colors',
                        active
                          ? 'text-text-primary after:bg-brand'
                          : 'text-text-secondary after:bg-transparent hover:text-text-primary hover:after:bg-border-strong'
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />
            {user ? (
              <>
                <Button variant="subtle" size="default" onClick={signOut}>
                  Sign out
                </Button>
                <Button asChild size="default">
                  <Link to="/dashboard">
                    <span>Open dashboard</span>
                    <ArrowRight16Regular aria-hidden />
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild size="default" className="px-4">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle size="icon" />
            <Button
              type="button"
              variant="subtle"
              size="icon"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
              aria-controls="site-mobile-menu"
            >
              {isMenuOpen ? <Dismiss20Regular aria-hidden /> : <Navigation20Regular aria-hidden />}
            </Button>
          </div>
        </div>
      </nav>

      {isMenuOpen && (
        // Overlays the page instead of pushing it down, so opening and closing never shifts the layout.
        <div
          id="site-mobile-menu"
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-y border-border-subtle bg-surface-default shadow-lg md:hidden"
        >
          <div className="lp-container pb-5 pt-2">
            <ul>
              {NAV_LINKS.map(({ label, to, section }) => {
                const active = isActive(to, section);
                return (
                  <li key={to} className="border-b border-border-subtle">
                    <Link
                      to={to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-12 items-center text-[15px] transition-colors duration-150',
                        active ? 'font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-col gap-2">
              {user ? (
                <>
                  <Button asChild size="lg" className="w-full">
                    <Link to="/dashboard">Open dashboard</Link>
                  </Button>
                  <Button type="button" variant="outline" size="lg" className="w-full" onClick={signOut}>
                    Sign out
                  </Button>
                </>
              ) : (
                <Button asChild size="lg" className="w-full">
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
