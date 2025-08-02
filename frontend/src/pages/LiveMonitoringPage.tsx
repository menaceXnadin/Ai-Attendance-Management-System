import React from 'react';
import LiveMonitoring from '@/components/LiveMonitoring';

const LiveMonitoringPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-8">
      <LiveMonitoring />
    </div>
  );
};

export default LiveMonitoringPage;
