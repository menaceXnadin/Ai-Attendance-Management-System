import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Close, Logout, ChevronLeft, ChevronRight } from '@carbon/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import logo from '@/assets/main.png';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  badge?: string | number;
  isNew?: boolean;
  end?: boolean;
}

export interface NavGroup {
  groupLabel?: string;
  items: NavItem[];
}

export interface AppShellProps {
  roleLabel: string;
  navGroups: NavGroup[];
  user?: {
    name?: string;
    email?: string;
    role?: string;
  } | null;
  onSignOut: () => void;
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  roleLabel,
  navGroups,
  user,
  onSignOut,
  pageTitle,
  pageDescription,
  headerActions,
  children,
}) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('attendai-shell-collapsed') === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Toggle collapsed state and persist
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('attendai-shell-collapsed', String(next));
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-hidden bg-nav-surface text-nav-text">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-border-subtle/20 px-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img src={logo} alt="AttendAI" className="h-7 w-7 shrink-0 object-contain" />
          {(!isCollapsed || isMobileOpen) && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-white">
                AttendAI
              </span>
              <span className="block text-[11px] font-medium text-text-muted">
                {roleLabel}
              </span>
            </div>
          )}
        </div>
        {/* Mobile close button */}
        {isMobileOpen && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsMobileOpen(false)}
            className="text-nav-text hover:bg-nav-hover hover:text-white lg:hidden"
            aria-label="Close navigation drawer"
          >
            <Close size={18} aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {group.groupLabel && (!isCollapsed || isMobileOpen) && (
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {group.groupLabel}
              </div>
            )}
            {group.items.map((item) => {
              const IconComp = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150 relative",
                      isActive
                        ? "bg-nav-active text-white before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-action-primary"
                        : "text-nav-text/80 hover:bg-nav-hover hover:text-white",
                      isCollapsed && !isMobileOpen && "justify-center px-0 py-2.5"
                    )
                  }
                  title={isCollapsed && !isMobileOpen ? item.label : undefined}
                >
                  <IconComp size={18} className="shrink-0" aria-hidden="true" />
                  {(!isCollapsed || isMobileOpen) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {(!isCollapsed || isMobileOpen) && item.badge && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-nav-hover border-transparent text-nav-text">
                      {item.badge}
                    </Badge>
                  )}
                  {(!isCollapsed || isMobileOpen) && item.isNew && (
                    <Badge variant="success" className="px-1 py-0 text-[10px] h-4">
                      NEW
                    </Badge>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer / User Profile & Sign Out */}
      <div className="border-t border-border-subtle/20 p-2 space-y-2">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-md p-2 bg-nav-hover/40",
            isCollapsed && !isMobileOpen && "justify-center p-1.5"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-action-primary text-xs font-semibold text-white">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user?.name || 'User'}</p>
              <p className="truncate text-[10px] text-text-muted">{user?.email || roleLabel}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className={cn(
              "w-full justify-start text-xs text-nav-text/80 hover:bg-nav-hover hover:text-status-error",
              isCollapsed && !isMobileOpen && "justify-center px-0"
            )}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <Logout size={16} className="shrink-0" aria-hidden="true" />
            {(!isCollapsed || isMobileOpen) && <span className="ml-2">Sign Out</span>}
          </Button>

          {/* Desktop Collapse Toggle */}
          {!isMobileOpen && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleCollapse}
              className="hidden lg:flex shrink-0 text-nav-text/70 hover:bg-nav-hover hover:text-white"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight size={14} aria-hidden="true" />
              ) : (
                <ChevronLeft size={14} aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-surface-canvas text-text-primary antialiased">
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden lg:block shrink-0 border-r border-border-subtle/40 transition-all duration-200 z-30 sticky top-0 h-screen",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Mobile navigation"
      >
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-default bg-surface-default px-4 sm:px-6 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu Toggle Button */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden text-text-secondary hover:text-text-primary"
              aria-label="Open navigation menu"
            >
              <Menu size={20} aria-hidden="true" />
            </Button>

            <div className="min-w-0">
              {pageTitle && (
                <h1 className="text-base font-semibold leading-tight text-text-primary truncate">
                  {pageTitle}
                </h1>
              )}
              {pageDescription && (
                <p className="text-xs text-text-muted truncate hidden sm:block">
                  {pageDescription}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {headerActions}
            <div className="h-4 w-px bg-border-subtle mx-0.5 hidden sm:block" />
            <ThemeToggle />
          </div>
        </header>

        {/* Page Main Content */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
