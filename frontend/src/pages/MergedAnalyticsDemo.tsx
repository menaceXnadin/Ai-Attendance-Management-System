
import React from 'react';
import MergedAnalytics from '@/components/MergedAnalytics';

const MergedAnalyticsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold text-white mb-8 text-center">Merged Analytics Dashboard Demo</h2>
      <MergedAnalytics />
    </div>
  );
};

export default MergedAnalyticsDemo;
