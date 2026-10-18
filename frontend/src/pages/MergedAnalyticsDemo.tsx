
import React from 'react';
import MergedAnalytics from '@/components/MergedAnalytics';
import ThemeToggle from '@/components/ThemeToggle';

const MergedAnalyticsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border-subtle bg-titlebar px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-body-strong text-text-primary">AttendAI</span>
          <span className="h-4 w-px bg-border-default" aria-hidden />
          <span className="truncate text-body-strong text-text-secondary">Merged Analytics Dashboard Demo</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-[1400px] p-6">
        <div className="page-header">
          <div>
            <h1 className="text-page-title text-text-primary">Merged Analytics Dashboard Demo</h1>
          </div>
        </div>
        <MergedAnalytics />
      </main>
    </div>
  );
};

export default MergedAnalyticsDemo;
