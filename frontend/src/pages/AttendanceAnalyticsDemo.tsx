import React from 'react';
import AttendanceAnalytics from '@/components/AttendanceAnalytics';

const AttendanceAnalyticsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Attendance Analytics Demo</h2>
        <AttendanceAnalytics />
      </div>
    </div>
  );
};

export default AttendanceAnalyticsDemo;
