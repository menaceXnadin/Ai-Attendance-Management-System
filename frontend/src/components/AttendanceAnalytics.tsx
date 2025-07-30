import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  Target,
  Award,
  AlertTriangle,
  Download,
  Filter,
  Eye,
  ChevronRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

interface AttendanceAnalyticsProps {
  className?: string;
}

interface AnalyticsData {
  totalStudents: number;
  presentToday: number;
  attendanceRate: number;
  weeklyTrend: number;
  monthlyTrend: number;
  topPerformers: Array<{
    name: string;
    rate: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  attendanceByTime: Array<{
    hour: string;
    count: number;
  }>;
  weeklyData: Array<{
    day: string;
    present: number;
    absent: number;
    late: number;
  }>;
  insights: Array<{
    type: 'positive' | 'warning' | 'negative';
    title: string;
    description: string;
    action?: string;
  }>;
}

const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({ className = '' }) => {
  const [data, setData] = useState<AnalyticsData>({
    totalStudents: 125,
    presentToday: 98,
    attendanceRate: 78.4,
    weeklyTrend: 5.2,
    monthlyTrend: -2.1,
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
    ]
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'insights'>('overview');

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400';
    if (rate >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <Target className="h-4 w-4 text-blue-400" />;
    }
  };

  return (
    <Card className={`bg-slate-900/60 backdrop-blur-md border-slate-700/50 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Attendance Analytics</CardTitle>
              <p className="text-sm text-slate-400">Comprehensive insights and trends</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg mt-4">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
            { id: 'insights', label: 'Insights', icon: Target }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'trends' | 'insights')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {activeTab === 'overview' && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-slate-400">Total Students</span>
                </div>
                <p className="text-xl font-bold text-white">{data.totalStudents}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-slate-400">Present Today</span>
                </div>
                <p className="text-xl font-bold text-white">{data.presentToday}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-slate-400">Attendance Rate</span>
                </div>
                <p className={`text-xl font-bold ${getAttendanceColor(data.attendanceRate)}`}>
                  {data.attendanceRate}%
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-slate-400">Weekly Trend</span>
                </div>
                <div className="flex items-center gap-1">
                  <p className={`text-xl font-bold ${data.weeklyTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.weeklyTrend > 0 ? '+' : ''}{data.weeklyTrend}%
                  </p>
                  {data.weeklyTrend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Rate Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Today's Attendance Progress</span>
                <span className="text-sm font-medium text-white">
                  {data.presentToday} / {data.totalStudents}
                </span>
              </div>
              <Progress value={(data.presentToday / data.totalStudents) * 100} className="h-3" />
            </div>
          </>
        )}

        {activeTab === 'trends' && (
          <>
            {/* Weekly Data */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white">Weekly Attendance Pattern</h4>
              {data.weeklyData.map((day) => (
                <div key={day.day} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{day.day}</span>
                    <span className="text-sm text-white">
                      {day.present + day.absent + day.late} students
                    </span>
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-2">
                    <div 
                      className="bg-green-500" 
                      style={{ width: `${(day.present / (day.present + day.absent + day.late)) * 100}%` }}
                    />
                    <div 
                      className="bg-yellow-500" 
                      style={{ width: `${(day.late / (day.present + day.absent + day.late)) * 100}%` }}
                    />
                    <div 
                      className="bg-red-500" 
                      style={{ width: `${(day.absent / (day.present + day.absent + day.late)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
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
          </>
        )}

        {activeTab === 'insights' && (
          <>
            {/* Top Performers */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-400" />
                Top Performers
              </h4>
              {data.topPerformers.map((student, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{index + 1}</span>
                    </div>
                    <span className="text-sm text-white">{student.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-400">{student.rate}%</span>
                    {student.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-400" />}
                    {student.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Insights */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">AI Insights</h4>
              {data.insights.map((insight, index) => (
                <div key={index} className="p-4 rounded-lg bg-slate-800/50 border-l-4 border-purple-500">
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-white mb-1">{insight.title}</h5>
                      <p className="text-xs text-slate-400 mb-2">{insight.description}</p>
                      {insight.action && (
                        <button className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                          {insight.action}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceAnalytics;
