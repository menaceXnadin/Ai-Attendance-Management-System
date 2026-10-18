import React from 'react';
import { Link } from 'react-router-dom';
import {
  DataBarVertical20Regular,
  DataTrending20Regular,
  ChartMultiple20Regular,
  DataPie20Regular,
  Board20Regular,
  ChevronRight20Regular,
} from '@fluentui/react-icons';
import ThemeToggle from '@/components/ThemeToggle';

const showcaseLinks = [
  { to: '/attendance-analytics-demo', label: 'AttendanceAnalytics Demo', icon: DataBarVertical20Regular },
  { to: '/advanced-analytics-demo', label: 'AdvancedAnalytics Demo', icon: DataTrending20Regular },
  { to: '/global-analytics-demo', label: 'Unified/Global Analytics Demo', icon: ChartMultiple20Regular },
  { to: '/merged-analytics-demo', label: 'Merged Analytics Demo', icon: DataPie20Regular },
  { to: '/app/analytics', label: 'Sidebar Analytics (Production)', icon: Board20Regular },
];

const AnalyticsShowcase: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border-subtle bg-titlebar px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-body-strong text-text-primary">AttendAI</span>
          <span className="h-4 w-px bg-border-default" aria-hidden />
          <span className="truncate text-body-strong text-text-secondary">Analytics Components Showcase</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-[1400px] p-6">
        <div className="page-header">
          <div>
            <h1 className="text-page-title text-text-primary">Analytics Components Showcase</h1>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {showcaseLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-lg border border-transparent bg-surface-default p-4 shadow transition-shadow duration-150 ease-fluent-standard hover:shadow-md dark:border-border-subtle"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                <Icon aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-strong text-text-primary">{label}</span>
                <span className="block truncate text-caption text-text-muted">{to}</span>
              </span>
              <ChevronRight20Regular
                className="shrink-0 text-text-muted transition-colors duration-150 group-hover:text-brand-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsShowcase;
