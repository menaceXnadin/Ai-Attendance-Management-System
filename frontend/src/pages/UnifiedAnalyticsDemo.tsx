import React from 'react';
import AttendanceAnalytics from '@/components/AttendanceAnalytics';
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


const GlobalAnalyticsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border-subtle bg-titlebar px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-body-strong text-text-primary">AttendAI</span>
          <span className="h-4 w-px bg-border-default" aria-hidden />
          <span className="truncate text-body-strong text-text-secondary">Global Analytics Demo</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-[1400px] p-6">
        <div className="page-header">
          <div>
            <h1 className="text-page-title text-text-primary">Global Analytics Demo</h1>
          </div>
        </div>
        <section>
          <h2 className="text-section-title text-text-primary mb-4">Advanced Analytics</h2>
          <AdvancedAnalytics data={demoData} />
        </section>
      </main>
    </div>
  );
};

export default GlobalAnalyticsDemo;
