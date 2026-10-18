import React from 'react';
import AdvancedAnalytics from '@/components/AdvancedAnalytics';
import ThemeToggle from '@/components/ThemeToggle';

const demoData = {
  totalStudents: 120,
  presentToday: 95,
  attendanceRate: 82.5,
  weeklyTrend: 3.2,
  averageArrivalTime: '9:12 AM',
  topPerformingClass: 'Computer Science',
  lowAttendanceCount: 7
};

const AdvancedAnalyticsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border-subtle bg-titlebar px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-body-strong text-text-primary">AttendAI</span>
          <span className="h-4 w-px bg-border-default" aria-hidden />
          <span className="truncate text-body-strong text-text-secondary">Advanced Analytics Demo</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-[1400px] p-6">
        <div className="page-header">
          <div>
            <h1 className="text-page-title text-text-primary">Advanced Analytics Demo</h1>
          </div>
        </div>
        <AdvancedAnalytics data={demoData} />
      </main>
    </div>
  );
};

export default AdvancedAnalyticsDemo;
