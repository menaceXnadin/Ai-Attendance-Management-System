
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users, Calendar, Target, Clock, TrendingUp, TrendingDown, Award, AlertTriangle, BarChart3, PieChart, Activity, AlertCircle, ChevronRight, Filter, Download } from 'lucide-react';

// Demo data merged from both analytics
const analytics = {
  totalStudents: 125,
  presentToday: 98,
  attendanceRate: 78.4,
  weeklyTrend: 5.2,
  monthlyTrend: -2.1,
  averageArrivalTime: '9:12 AM',
  topPerformers: [
    { name: 'Aarohi Sharma', rate: 98.5, trend: 'up' },
    { name: 'Bibek Gurung', rate: 96.8, trend: 'stable' },
    { name: 'Priya Tamang', rate: 95.2, trend: 'up' }
  ],
  attendanceByTime: [
    { hour: '8:00', count: 15 },
    { hour: '9:00', count: 45 },
    { hour: '10:00', count: 28 },
    { hour: '11:00', count: 10 }
  ],
  weeklyData: [
    { day: 'Mon', present: 88, absent: 12, late: 5 },
    { day: 'Tue', present: 92, absent: 8, late: 3 },
    { day: 'Wed', present: 85, absent: 15, late: 8 },
    { day: 'Thu', present: 94, absent: 6, late: 2 },
    { day: 'Fri', present: 78, absent: 22, late: 10 }
  ],
  insights: [
    {
      type: 'positive',
      title: 'Improved Morning Attendance',
      description: 'Students are arriving earlier this week compared to last week',
      action: 'View Details'
    },
    {
      type: 'warning',
      title: 'Friday Attendance Drop',
      description: '15% lower attendance on Fridays. Consider engagement activities',
      action: 'Create Plan'
    }
  ],
  topPerformingClass: 'Computer Science',
  lowAttendanceCount: 8,
  timeSlotData: [
    { time: '8:00-9:00', students: 45, percentage: 78 },
    { time: '9:00-10:00', students: 52, percentage: 90 },
    { time: '10:00-11:00', students: 48, percentage: 83 },
    { time: '11:00-12:00', students: 41, percentage: 71 }
  ],
  departmentData: [
    { name: 'Computer Science', attendance: 92, students: 45 },
    { name: 'Engineering', attendance: 88, students: 38 },
    { name: 'Business', attendance: 85, students: 33 },
    { name: 'Arts', attendance: 79, students: 28 }
  ]
};

const getAttendanceColor = (rate: number) => {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 80) return 'text-yellow-400';
  if (rate >= 70) return 'text-orange-400';
  return 'text-red-400';
};

const getTrendIcon = (trend: number) => {
  if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <TrendingUp className="h-4 w-4 text-slate-400" />;
};

const getInsightIcon = (type: string) => {
  if (type === 'positive') return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Activity className="h-4 w-4 text-blue-400" />;
};

// Main component
const MergedAnalytics: React.FC = () => {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <Card className="bg-[#101624] border border-[#232b3b] shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">Unified Analytics Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-10">
          {/* TODAY SECTION */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Today</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Present Today */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Present Today</span>
                    <div className="text-2xl font-bold text-white mt-1">{analytics.presentToday}</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              {/* Total Students */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Total Students</span>
                    <div className="text-2xl font-bold text-white mt-1">{analytics.totalStudents}</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              {/* Attendance Rate */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-400 to-pink-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Attendance Rate</span>
                    <div className="text-2xl font-bold text-yellow-400 mt-1">{analytics.attendanceRate}%</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              {/* Need Attention */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Need Attention</span>
                    <div className="text-2xl font-bold text-amber-400 mt-1">{analytics.lowAttendanceCount}</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* WEEKLY SECTION */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Weekly</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
              {/* Weekly Trend */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Weekly Trend</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold text-green-400">{analytics.weeklyTrend > 0 ? '+' : ''}{analytics.weeklyTrend}%</span>
                      {analytics.weeklyTrend > 0 ? <TrendingUp className="h-6 w-6 text-green-400" /> : <TrendingDown className="h-6 w-6 text-red-400" />}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              {/* Overall Attendance (Weekly) */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Overall Attendance</span>
                    <div className="text-2xl font-bold text-yellow-400 mt-1">{analytics.attendanceRate}%</div>
                    <div className="flex items-center gap-2 mt-2">
                      {getTrendIcon(analytics.weeklyTrend)}
                      <span className="text-green-400 text-sm font-medium">{Math.abs(analytics.weeklyTrend)}% this week</span>
                    </div>
                    <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-400">Good</span>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              {/* Avg. Arrival Time (Weekly) */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-400 to-pink-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Avg. Arrival Time</span>
                    <div className="text-2xl font-bold text-purple-400 mt-1">{analytics.averageArrivalTime}</div>
                    <span className="text-xs text-slate-400">across all classes</span>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
            {/* Weekly Attendance Pattern */}
            <div className="space-y-4 mt-4">
              <h4 className="text-sm font-medium text-white">Weekly Attendance Pattern</h4>
              {analytics.weeklyData.map((day) => (
                <div key={day.day} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{day.day}</span>
                    <span className="text-sm text-white">{day.present + day.absent + day.late} students</span>
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-2">
                    <div className="bg-green-500" style={{ width: `${(day.present / (day.present + day.absent + day.late)) * 100}%` }} />
                    <div className="bg-yellow-500" style={{ width: `${(day.late / (day.present + day.absent + day.late)) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(day.absent / (day.present + day.absent + day.late)) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-slate-400">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-slate-400">Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-slate-400">Absent</span>
                </div>
              </div>
            </div>
          </div>

          {/* MONTHLY SECTION (placeholder, can add more metrics) */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Monthly</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Example: Monthly Trend (using monthlyTrend from analytics) */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Monthly Trend</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold text-green-400">{analytics.monthlyTrend > 0 ? '+' : ''}{analytics.monthlyTrend}%</span>
                      {analytics.monthlyTrend > 0 ? <TrendingUp className="h-6 w-6 text-green-400" /> : <TrendingDown className="h-6 w-6 text-red-400" />}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* YEARLY SECTION (placeholder, can add more metrics) */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Yearly</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Example: Yearly Attendance (placeholder, no data in analytics) */}
              <div className="relative rounded-xl bg-[#151c27] border border-[#232b3b] p-3 flex flex-col min-h-[100px] h-[110px] shadow-md opacity-60" style={{overflow: 'hidden'}}>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-400 to-purple-500 rounded-t-xl" />
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-slate-300">Yearly Attendance</span>
                    <div className="text-2xl font-bold text-white mt-1">N/A</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MergedAnalytics;
