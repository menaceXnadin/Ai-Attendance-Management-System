import React from 'react';
import AdvancedAnalytics from '@/components/AdvancedAnalytics';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Advanced Analytics Demo</h2>
        <AdvancedAnalytics data={demoData} />
      </div>
    </div>
  );
};

export default AdvancedAnalyticsDemo;
