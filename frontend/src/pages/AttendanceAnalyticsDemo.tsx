import React from 'react';
import AttendanceAnalytics from '@/components/AttendanceAnalytics';
import ThemeToggle from '@/components/ThemeToggle';

const AttendanceAnalyticsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border-subtle bg-titlebar px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-body-strong text-text-primary">AttendAI</span>
          <span className="h-4 w-px bg-border-default" aria-hidden />
          <span className="truncate text-body-strong text-text-secondary">Attendance Analytics Demo</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-[1400px] p-6">
        <div className="page-header">
          <div>
            <h1 className="text-page-title text-text-primary">Attendance Analytics Demo</h1>
          </div>
        </div>
        <AttendanceAnalytics />
      </main>
    </div>
  );
};

export default AttendanceAnalyticsDemo;
