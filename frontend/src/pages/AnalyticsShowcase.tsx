import React from 'react';
import { Link } from 'react-router-dom';

const AnalyticsShowcase: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Analytics Components Showcase</h1>
      <div className="space-y-4">
        <Link to="/attendance-analytics-demo">
          <button className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">AttendanceAnalytics Demo</button>
        </Link>
        <Link to="/advanced-analytics-demo">
          <button className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition">AdvancedAnalytics Demo</button>
        </Link>
        <Link to="/global-analytics-demo">
          <button className="px-6 py-3 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition">Unified/Global Analytics Demo</button>
        </Link>
        <Link to="/merged-analytics-demo">
          <button className="px-6 py-3 rounded-lg bg-pink-600 text-white font-semibold hover:bg-pink-700 transition">Merged Analytics Demo</button>
        </Link>
        <Link to="/app/analytics">
          <button className="px-6 py-3 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition">Sidebar Analytics (Production)</button>
        </Link>
      </div>
    </div>
  );
};

export default AnalyticsShowcase;
