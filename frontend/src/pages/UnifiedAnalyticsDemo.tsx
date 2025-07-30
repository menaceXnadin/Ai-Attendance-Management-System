import React from 'react';
import AttendanceAnalytics from '@/components/AttendanceAnalytics';
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


const GlobalAnalyticsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex flex-col items-center justify-center p-8 gap-12">
      <div className="w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Global Analytics Demo</h2>
        <div>
          <h3 className="text-xl font-semibold text-green-200 mb-4 text-center">Advanced Analytics</h3>
          <AdvancedAnalytics data={demoData} />
        </div>
      </div>
    </div>
  );
};

export default GlobalAnalyticsDemo;
