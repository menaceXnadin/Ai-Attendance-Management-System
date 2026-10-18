import * as React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dismiss20Regular,
  Navigation20Regular,
  PanelLeftContract20Regular,
  PanelLeftExpand20Regular,
  Search20Regular,
  SignOut20Regular,
} from '@fluentui/react-icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import logo from '@/assets/main.png';
import { cn } from '@/lib/utils';
import type { NavGroup, ShellUser } from './shell-types';
import { ShellNav } from './ShellNav';
import { ShellCommandPalette, ShellSearchBox } from './ShellCommandPalette';
import { ShellAccountMenu, ShellAvatar } from './ShellAccountMenu';

export type { NavGroup, NavItem, NavIcon, ShellUser } from './shell-types';

export interface AppShellProps {
  roleLabel: string;
  navGroups: NavGroup[];
  user?: ShellUser | null;
  onSignOut: () => void;
  pageTitle?: string;
  pageDescription?: string;
  /** Rendered in the title bar, left of the theme toggle (e.g. `<NotificationCenter />`). */
  headerActions?: React.ReactNode;
  /** When provided, the avatar menu shows a "View profile" entry. */
  onViewProfile?: () => void;
  children: React.ReactNode;
}

const COLLAPSE_STORAGE_KEY = 'attendai-shell-collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/** Neutral icon button used on the title bar (Fluent "subtle" button, 32px). */
const titleBarButtonClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 ease-fluent-standard hover:bg-surface-default hover:text-text-primary active:bg-surface-pressed';

const Brand: React.FC<{ roleLabel: string; showRole?: boolean }> = ({ roleLabel, showRole = true }) => (
  <div className="flex min-w-0 items-center gap-2">
    <img src={logo} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 object-contain" />
    <span className="truncate text-body-strong text-text-primary">AttendAI</span>
    {showRole && (
      <>
        <span aria-hidden="true" className="hidden h-4 w-px shrink-0 bg-border-default md:block" />
        <span className="hidden truncate text-caption text-text-muted md:block">{roleLabel}</span>
      </>
    )}
  </div>
);

export const AppShell: React.FC<AppShellProps> = ({
  roleLabel,
  navGroups,
  user,
  onSignOut,
  pageTitle,
  pageDescription,
  headerActions,
  onViewProfile,
  children,
}) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(readCollapsed);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const drawerCloseRef = React.useRef<HTMLButtonElement>(null);
  const drawerId = React.useId();

  // Toggle collapsed state and persist
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        /* storage unavailable — keep in-memory state only */
      }
      return next;
    });
  };

  // Close mobile drawer on route change; reset content scroll position
  React.useEffect(() => {
    setIsMobileOpen(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  React.useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // Escape closes the mobile drawer; move focus into it when it opens
  React.useEffect(() => {
    if (!isMobileOpen) return;
    drawerCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileOpen]);

  // Ctrl+K / ⌘K opens the quick-navigation palette
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setIsMobileOpen(false);
        setIsSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openSearch = () => {
    setIsMobileOpen(false);
    setIsSearchOpen(true);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-titlebar text-text-primary antialiased">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-body-strong focus:text-text-primary focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* ------------------------------------------------------------------ */}
      {/* Title bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 bg-titlebar px-2 sm:gap-3 sm:px-3">
        <div className="flex min-w-0 flex-1 basis-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className={cn(titleBarButtonClass, 'lg:hidden')}
            aria-label="Open navigation menu"
            aria-controls={drawerId}
            aria-expanded={isMobileOpen}
          >
            <Navigation20Regular className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 pl-1">
            <Brand roleLabel={roleLabel} />
          </div>
        </div>

        <div className="hidden min-w-0 flex-[0_1_560px] sm:flex">
          <ShellSearchBox onOpen={openSearch} />
        </div>

        <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-1">
          <button
            type="button"
            onClick={openSearch}
            className={cn(titleBarButtonClass, 'sm:hidden')}
            aria-label="Search"
            aria-haspopup="dialog"
          >
            <Search20Regular className="h-5 w-5" aria-hidden="true" />
          </button>
          {headerActions}
          <ThemeToggle className="h-8 w-8 rounded-md text-text-secondary hover:bg-surface-default hover:text-text-primary [&_svg]:size-5" />
          <div className="ml-1">
            <ShellAccountMenu
              user={user}
              roleLabel={roleLabel}
              onSignOut={onSignOut}
              onViewProfile={onViewProfile}
            />
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Navigation + content                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-0 flex-1 bg-nav-surface">
        {/* Desktop navigation: NavDrawer (240px) or Teams app bar rail (68px) */}
        <aside
          aria-label="Primary"
          className={cn(
            'hidden shrink-0 flex-col overflow-hidden bg-nav-surface transition-[width] duration-200 ease-fluent-standard lg:flex',
            isCollapsed ? 'w-[68px]' : 'w-60'
          )}
        >
          <ShellNav navGroups={navGroups} variant={isCollapsed ? 'rail' : 'drawer'} />
          <div className={cn('shrink-0 border-t border-border-subtle p-2', isCollapsed && 'flex justify-center px-1')}>
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              className={cn(
                'flex h-9 items-center gap-3 rounded-md text-body text-nav-text transition-colors duration-150 ease-fluent-standard hover:bg-nav-hover hover:text-text-primary active:bg-surface-pressed',
                isCollapsed ? 'w-[60px] justify-center' : 'w-full px-3'
              )}
            >
              {isCollapsed ? (
                <PanelLeftExpand20Regular className="h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <PanelLeftContract20Regular className="h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              {!isCollapsed && <span className="truncate">Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Content pane */}
        <main
          id="app-main"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto bg-surface-canvas outline-none lg:rounded-tl-lg lg:border-l lg:border-t lg:border-border-subtle"
        >
          <div className="shell-content mx-auto w-full max-w-[1600px] p-4 sm:p-6">
            {/* Fallback page header; hidden via CSS when the page renders its own <h1> */}
            {(pageTitle || pageDescription) && (
              <div className="shell-page-header mb-4 min-w-0 sm:mb-6">
                {pageTitle && (
                  <h1 className="truncate text-section-title text-text-primary sm:text-page-title">{pageTitle}</h1>
                )}
                {pageDescription && <p className="mt-1 text-body text-text-muted">{pageDescription}</p>}
              </div>
            )}
            <div className="shell-page-body">{children}</div>
          </div>
        </main>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile navigation drawer                                           */}
      {/* ------------------------------------------------------------------ */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 animate-in fade-in-0 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id={drawerId}
        aria-label="Navigation"
        aria-hidden={!isMobileOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-nav-surface shadow-xl transition-[transform,visibility] duration-200 ease-fluent-decelerate lg:hidden',
          isMobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-3">
          <div className="min-w-0">
            <Brand roleLabel={roleLabel} showRole={false} />
          </div>
          <button
            ref={drawerCloseRef}
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className={cn(titleBarButtonClass, 'hover:bg-nav-hover')}
            aria-label="Close navigation drawer"
          >
            <Dismiss20Regular className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <ShellNav navGroups={navGroups} variant="drawer" onNavigate={() => setIsMobileOpen(false)} />

        <div className="shrink-0 space-y-1 border-t border-border-subtle p-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <ShellAvatar name={user?.name} size="md" presence presenceRingClassName="ring-nav-surface" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-strong text-text-primary">{user?.name || 'User'}</p>
              <p className="truncate text-caption text-text-muted">{user?.email || roleLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-body text-nav-text transition-colors duration-150 ease-fluent-standard hover:bg-nav-hover hover:text-text-primary active:bg-surface-pressed"
          >
            <SignOut20Regular className="h-5 w-5 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <ShellCommandPalette
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        navGroups={navGroups}
        onSignOut={onSignOut}
      />
    </div>
  );
};

export default AppShell;
