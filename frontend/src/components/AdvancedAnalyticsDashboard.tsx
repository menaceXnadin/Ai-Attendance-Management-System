import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  Award,
  Download,
  Filter,
  Clock,
  BookOpen,
  Activity,
  Zap,
  X,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

interface AdvancedAnalyticsDashboardProps {
  className?: string;
}

interface FilterState {
  dateRange: 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  showLowPerformers?: boolean;
}

interface SubjectAnalytics {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  attendance_rate: number;
  unique_students: number;
  first_class: string | null;
  last_class: string | null;
}

interface DayBreakdown {
  date: string;
  day: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

interface TopPerformer {
  student_id: string;
  name: string;
  email: string;
  attendance_rate: number;
  total_classes: number;
  present_count: number;
  absent_count: number;
  trend: string;
  recent_rate: number;
  faculty: string;
  semester: number;
}

interface Insight {
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  icon: string;
}

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'insights' | 'performance'>('overview');
  const [daysFilter, setDaysFilter] = useState(7);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'week',
    showLowPerformers: false
  });

  // Fetch real data from new analytics endpoints
  const { data: dashboardSummary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['analytics-dashboard-summary'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }
      const response = await fetch('http://localhost:8000/api/analytics/dashboard-summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Dashboard Summary Data:', data);
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
    retry: 2,
  });

  const { data: weeklyBreakdown } = useQuery({
    queryKey: ['analytics-weekly-breakdown', daysFilter],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No authentication token');
      const response = await fetch(`http://localhost:8000/api/analytics/weekly-breakdown?days=${daysFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch weekly breakdown');
      const data = await response.json();
      console.log('Weekly Breakdown Data:', data);
      return data;
    },
    refetchInterval: 60000,
    retry: 2,
  });

  const { data: topPerformers } = useQuery({
    queryKey: ['analytics-top-performers'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No authentication token');
      const response = await fetch('http://localhost:8000/api/analytics/top-performers?limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch top performers');
      const data = await response.json();
      console.log('Top Performers Data:', data);
      return data;
    },
    retry: 2,
  });

  const { data: subjectWise } = useQuery({
    queryKey: ['analytics-subject-wise'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No authentication token');
      const response = await fetch('http://localhost:8000/api/analytics/subject-wise', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch subject-wise data');
      const data = await response.json();
      console.log('Subject-Wise Data:', data);
      return data;
    },
    retry: 2,
  });

  const { data: insights } = useQuery({
    queryKey: ['analytics-insights'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No authentication token');
      const response = await fetch('http://localhost:8000/api/analytics/insights', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      console.log('Insights Data:', data);
      return data;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    retry: 2,
  });

  // Filter top performers based on toggle (must be before conditional returns)
  const filteredPerformers = useMemo(() => {
    if (!topPerformers?.top_performers) return [];
    if (filters.showLowPerformers) {
      // Show bottom performers instead
      return [...topPerformers.top_performers].reverse();
    }
    return topPerformers.top_performers;
  }, [topPerformers, filters.showLowPerformers]);

  if (summaryLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-white text-lg font-medium">Loading analytics...</p>
            <p className="text-slate-400 text-sm">Fetching real-time data</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border-slate-700/50 shadow-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-700/50 rounded-lg w-3/4"></div>
                  <div className="h-8 bg-slate-700/50 rounded-lg w-1/2"></div>
                  <div className="h-2 bg-slate-700/50 rounded-full w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/10 rounded-2xl blur-2xl"></div>
          <Card className="relative bg-gradient-to-br from-red-900/30 to-slate-900/30 backdrop-blur-xl border-red-500/50 shadow-2xl">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-red-500/30 to-pink-500/30 p-4 rounded-2xl">
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-red-400 font-bold text-2xl mb-3">Error Loading Analytics</h3>
                  <p className="text-red-300 mb-4 text-lg">{summaryError instanceof Error ? summaryError.message : 'Unknown error occurred'}</p>
                  
                  <div className="bg-slate-900/50 rounded-xl p-4 mb-4">
                    <p className="text-slate-300 text-sm font-medium mb-3">Troubleshooting Steps:</p>
                    <ul className="space-y-2 text-slate-400 text-sm">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                        Backend server is running on port 8000
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                        You are logged in with a valid authentication token
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                        CORS is properly configured for your domain
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                        Database connection is active
                      </li>
                    </ul>
                  </div>

                  <Button 
                    onClick={() => window.location.reload()}
                    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Connection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!dashboardSummary) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full"></div>
              <BarChart3 className="relative h-20 w-20 mx-auto text-slate-600" />
            </div>
            <p className="text-slate-400 text-xl font-medium mb-2">No Data Available</p>
            <p className="text-slate-500 text-sm">Analytics data will appear here once attendance records are created</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (rate: number) => {
    if (rate >= 90) return { color: 'text-blue-400', bgColor: 'bg-blue-500/20', status: 'Excellent' };
    if (rate >= 85) return { color: 'text-green-400', bgColor: 'bg-green-500/20', status: 'Good' };
    if (rate >= 75) return { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', status: 'Warning' };
    return { color: 'text-red-400', bgColor: 'bg-red-500/20', status: 'Critical' };
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Activity className="h-4 w-4 text-blue-400" />;
  };

  const getInsightIcon = (icon: string) => {
    switch (icon) {
      case 'alert-triangle': return <AlertTriangle className="h-6 w-6" />;
      case 'check-circle': return <CheckCircle className="h-6 w-6" />;
      case 'calendar': return <Calendar className="h-6 w-6" />;
      case 'trending-up': return <TrendingUp className="h-6 w-6" />;
      case 'trending-down': return <TrendingDown className="h-6 w-6" />;
      default: return <Activity className="h-6 w-6" />;
    }
  };

  // Export functionality
  const handleExportCSV = () => {
    if (!dashboardSummary) return;
    
    const csvData = [
      ['Analytics Report', 'Generated on', new Date().toLocaleDateString()],
      [],
      ['Period', 'Attendance Rate', 'Present', 'Absent', 'Late', 'Total Records'],
      ['Today', `${dashboardSummary.today?.rate || 0}%`, dashboardSummary.today?.present || 0, dashboardSummary.today?.absent || 0, dashboardSummary.today?.late || 0, dashboardSummary.today?.total_records || 0],
      ['This Week', `${dashboardSummary.this_week?.rate || 0}%`, dashboardSummary.this_week?.present || 0, dashboardSummary.this_week?.absent || 0, dashboardSummary.this_week?.late || 0, dashboardSummary.this_week?.total_records || 0],
      ['This Month', `${dashboardSummary.this_month?.rate || 0}%`, dashboardSummary.this_month?.present || 0, dashboardSummary.this_month?.absent || 0, dashboardSummary.this_month?.late || 0, dashboardSummary.this_month?.total_records || 0],
      [],
      ['System Statistics'],
      ['Total Students', dashboardSummary.system?.total_students || 0],
      ['Total Subjects', dashboardSummary.system?.total_subjects || 0],
      ['Total Records', dashboardSummary.system?.total_records || 0],
    ];

    if (subjectWise?.subjects) {
      csvData.push([], ['Subject Performance']);
      csvData.push(['Subject Name', 'Subject Code', 'Attendance Rate', 'Total Classes', 'Present', 'Absent']);
      subjectWise.subjects.forEach((subject: SubjectAnalytics) => {
        csvData.push([
          subject.subject_name,
          subject.subject_code,
          `${subject.attendance_rate}%`,
          subject.total_classes.toString(),
          subject.present.toString(),
          subject.absent.toString()
        ]);
      });
    }

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    // Create a printable version
    window.print();
    setShowExportMenu(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger refetch of all queries
    await Promise.all([
      dashboardSummary,
      weeklyBreakdown,
      topPerformers,
      subjectWise,
      insights
    ]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const todayStatus = getStatusColor(dashboardSummary?.today?.rate || 0);
  const weekStatus = getStatusColor(dashboardSummary?.this_week?.rate || 0);
  const monthStatus = getStatusColor(dashboardSummary?.this_month?.rate || 0);

  return (
    <div className={`space-y-6 ${className} print:bg-white`}>
      {/* Modern Header with Glassmorphism */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-cyan-600/10 to-blue-600/10 rounded-2xl blur-xl"></div>
        <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl blur-md opacity-50"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-2xl">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent flex items-center gap-3">
                  Advanced Analytics Dashboard
                </h2>
                <p className="text-slate-400 mt-1 text-sm md:text-base">Real-time insights • Live data • Comprehensive metrics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Refresh Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-slate-500 transition-all duration-300 backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* Export Menu */}
              <div className="relative">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="border-blue-600/50 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/50 transition-all duration-300 backdrop-blur-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className={`h-3 w-3 ml-2 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                </Button>
                
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={handleExportCSV}
                      className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150 flex items-center gap-3 group"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-green-400 group-hover:scale-110 transition-transform" />
                      <span>Export as CSV</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150 flex items-center gap-3 group border-t border-slate-700/50"
                    >
                      <FileText className="h-4 w-4 text-red-400 group-hover:scale-110 transition-transform" />
                      <span>Print / PDF</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Filters Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={`border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-slate-500 transition-all duration-300 backdrop-blur-sm ${showFilters ? 'ring-2 ring-blue-500/50' : ''}`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {showFilters && <X className="h-3 w-3 ml-2" />}
              </Button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Date Range</label>
                  <select 
                    value={filters.dateRange}
                    onChange={(e) => setFilters({...filters, dateRange: e.target.value as 'today' | 'week' | 'month' | 'custom'})}
                    className="w-full bg-slate-800/50 text-white px-3 py-2 rounded-lg border border-slate-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Performance View</label>
                  <button
                    onClick={() => setFilters({...filters, showLowPerformers: !filters.showLowPerformers})}
                    className={`w-full px-3 py-2 rounded-lg border transition-all duration-200 flex items-center justify-between ${
                      filters.showLowPerformers 
                        ? 'bg-red-500/10 border-red-500/50 text-red-400' 
                        : 'bg-green-500/10 border-green-500/50 text-green-400'
                    }`}
                  >
                    <span>{filters.showLowPerformers ? 'Low Performers' : 'Top Performers'}</span>
                    {filters.showLowPerformers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => setFilters({ dateRange: 'week', showLowPerformers: false })}
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50"
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modern Period Overview Cards with Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Today Card */}
        <div className="group relative">
          <div className={`absolute inset-0 bg-gradient-to-br ${
            todayStatus.status === 'Excellent' ? 'from-blue-500/20 to-cyan-500/20' :
            todayStatus.status === 'Good' ? 'from-green-500/20 to-emerald-500/20' :
            todayStatus.status === 'Warning' ? 'from-yellow-500/20 to-orange-500/20' :
            'from-red-500/20 to-pink-500/20'
          } rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300`}></div>
          
          <Card className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              todayStatus.status === 'Excellent' ? 'from-blue-500 via-cyan-400 to-blue-500' :
              todayStatus.status === 'Good' ? 'from-green-500 via-emerald-400 to-green-500' :
              todayStatus.status === 'Warning' ? 'from-yellow-500 via-orange-400 to-yellow-500' :
              'from-red-500 via-pink-400 to-red-500'
            }`}></div>
            
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-medium text-slate-400 mb-1">Today</p>
                  <div className={`text-4xl font-bold bg-gradient-to-br ${
                    todayStatus.status === 'Excellent' ? 'from-blue-400 to-cyan-400' :
                    todayStatus.status === 'Good' ? 'from-green-400 to-emerald-400' :
                    todayStatus.status === 'Warning' ? 'from-yellow-400 to-orange-400' :
                    'from-red-400 to-pink-400'
                  } bg-clip-text text-transparent`}>
                    {dashboardSummary?.today?.rate || 0}%
                  </div>
                </div>
                <div className={`relative h-16 w-16 rounded-2xl ${todayStatus.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl"></div>
                  <Clock className={`h-8 w-8 ${todayStatus.color} relative z-10`} />
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Present
                  </span>
                  <span className="text-green-400 font-bold">{dashboardSummary?.today?.present || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Absent
                  </span>
                  <span className="text-red-400 font-bold">{dashboardSummary?.today?.absent || 0}</span>
                </div>
                <div className="relative pt-2">
                  <Progress value={dashboardSummary?.today?.rate || 0} className="h-2.5" />
                </div>
              </div>
              
              <Badge variant="outline" className={`${todayStatus.bgColor} ${todayStatus.color} border-current px-3 py-1`}>
                {todayStatus.status}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* This Week Card */}
        <div className="group relative">
          <div className={`absolute inset-0 bg-gradient-to-br ${
            weekStatus.status === 'Excellent' ? 'from-blue-500/20 to-cyan-500/20' :
            weekStatus.status === 'Good' ? 'from-green-500/20 to-emerald-500/20' :
            weekStatus.status === 'Warning' ? 'from-yellow-500/20 to-orange-500/20' :
            'from-red-500/20 to-pink-500/20'
          } rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300`}></div>
          
          <Card className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              weekStatus.status === 'Excellent' ? 'from-blue-500 via-cyan-400 to-blue-500' :
              weekStatus.status === 'Good' ? 'from-green-500 via-emerald-400 to-green-500' :
              weekStatus.status === 'Warning' ? 'from-yellow-500 via-orange-400 to-yellow-500' :
              'from-red-500 via-pink-400 to-red-500'
            }`}></div>
            
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-medium text-slate-400 mb-1">This Week</p>
                  <div className={`text-4xl font-bold bg-gradient-to-br ${
                    weekStatus.status === 'Excellent' ? 'from-blue-400 to-cyan-400' :
                    weekStatus.status === 'Good' ? 'from-green-400 to-emerald-400' :
                    weekStatus.status === 'Warning' ? 'from-yellow-400 to-orange-400' :
                    'from-red-400 to-pink-400'
                  } bg-clip-text text-transparent`}>
                    {dashboardSummary?.this_week?.rate || 0}%
                  </div>
                </div>
                <div className={`relative h-16 w-16 rounded-2xl ${weekStatus.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl"></div>
                  <Calendar className={`h-8 w-8 ${weekStatus.color} relative z-10`} />
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total Classes</span>
                  <span className="text-white font-bold">{dashboardSummary?.this_week?.total_records || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Attended</span>
                  <span className="text-green-400 font-bold">{dashboardSummary?.this_week?.present || 0}</span>
                </div>
                <div className="relative pt-2">
                  <Progress value={dashboardSummary?.this_week?.rate || 0} className="h-2.5" />
                </div>
              </div>
              
              <Badge variant="outline" className={`${weekStatus.bgColor} ${weekStatus.color} border-current px-3 py-1`}>
                {weekStatus.status}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* This Month Card */}
        <div className="group relative">
          <div className={`absolute inset-0 bg-gradient-to-br ${
            monthStatus.status === 'Excellent' ? 'from-blue-500/20 to-cyan-500/20' :
            monthStatus.status === 'Good' ? 'from-green-500/20 to-emerald-500/20' :
            monthStatus.status === 'Warning' ? 'from-yellow-500/20 to-orange-500/20' :
            'from-red-500/20 to-pink-500/20'
          } rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300`}></div>
          
          <Card className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              monthStatus.status === 'Excellent' ? 'from-blue-500 via-cyan-400 to-blue-500' :
              monthStatus.status === 'Good' ? 'from-green-500 via-emerald-400 to-green-500' :
              monthStatus.status === 'Warning' ? 'from-yellow-500 via-orange-400 to-yellow-500' :
              'from-red-500 via-pink-400 to-red-500'
            }`}></div>
            
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-medium text-slate-400 mb-1">This Month</p>
                  <div className={`text-4xl font-bold bg-gradient-to-br ${
                    monthStatus.status === 'Excellent' ? 'from-blue-400 to-cyan-400' :
                    monthStatus.status === 'Good' ? 'from-green-400 to-emerald-400' :
                    monthStatus.status === 'Warning' ? 'from-yellow-400 to-orange-400' :
                    'from-red-400 to-pink-400'
                  } bg-clip-text text-transparent`}>
                    {dashboardSummary?.this_month?.rate || 0}%
                  </div>
                </div>
                <div className={`relative h-16 w-16 rounded-2xl ${monthStatus.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl"></div>
                  <BarChart3 className={`h-8 w-8 ${monthStatus.color} relative z-10`} />
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total Classes</span>
                  <span className="text-white font-bold">{dashboardSummary?.this_month?.total_records || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Attended</span>
                  <span className="text-green-400 font-bold">{dashboardSummary?.this_month?.present || 0}</span>
                </div>
                <div className="relative pt-2">
                  <Progress value={dashboardSummary?.this_month?.rate || 0} className="h-2.5" />
                </div>
              </div>
              
              <Badge variant="outline" className={`${monthStatus.bgColor} ${monthStatus.color} border-current px-3 py-1`}>
                {monthStatus.status}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modern System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="group relative">
          <div className="absolute inset-0 bg-blue-500/10 rounded-xl blur-xl group-hover:bg-blue-500/20 transition-all duration-300"></div>
          <Card className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md"></div>
                  <div className="relative bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-3 rounded-xl backdrop-blur-sm">
                    <Users className="h-8 w-8 text-blue-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-400 font-medium">Total Students</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                    {dashboardSummary?.system?.total_students || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-green-500/10 rounded-xl blur-xl group-hover:bg-green-500/20 transition-all duration-300"></div>
          <Card className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500/20 rounded-xl blur-md"></div>
                  <div className="relative bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-3 rounded-xl backdrop-blur-sm">
                    <BookOpen className="h-8 w-8 text-green-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-400 font-medium">Total Subjects</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-white to-green-100 bg-clip-text text-transparent">
                    {dashboardSummary?.system?.total_subjects || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-purple-500/10 rounded-xl blur-xl group-hover:bg-purple-500/20 transition-all duration-300"></div>
          <Card className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-500/20 rounded-xl blur-md"></div>
                  <div className="relative bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-3 rounded-xl backdrop-blur-sm">
                    <Target className="h-8 w-8 text-purple-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-400 font-medium">Records (30d)</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent">
                    {dashboardSummary?.this_month?.total_records || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modern Tabbed Analytics */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'trends' | 'insights' | 'performance')} className="space-y-6">
        <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2 shadow-xl">
          <TabsList className="grid w-full grid-cols-4 bg-transparent gap-2">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-xl"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="trends" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-xl"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Trends</span>
            </TabsTrigger>
            <TabsTrigger 
              value="performance" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-xl"
            >
              <Award className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger 
              value="insights" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-xl"
            >
              <Target className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-2 rounded-xl">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                  </div>
                  Subject-Wise Performance
                </CardTitle>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/50">
                  {subjectWise?.subjects?.length || 0} subjects
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {subjectWise?.subjects?.map((subject: SubjectAnalytics, index: number) => {
                  const status = getStatusColor(subject.attendance_rate);
                  return (
                    <div key={index} className="group relative">
                      <div className={`absolute inset-0 ${status.bgColor} rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                      
                      <div className="relative flex items-center justify-between p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/30 hover:border-slate-600/50 transition-all duration-300">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-2 h-2 rounded-full ${
                              subject.attendance_rate >= 90 ? 'bg-blue-400 animate-pulse' :
                              subject.attendance_rate >= 85 ? 'bg-green-400' :
                              subject.attendance_rate >= 75 ? 'bg-yellow-400' :
                              'bg-red-400'
                            }`}></div>
                            <span className="font-semibold text-white text-lg truncate">{subject.subject_name}</span>
                            <Badge variant="outline" className="text-xs bg-slate-700/50 text-slate-300 border-slate-600/50">
                              {subject.subject_code}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {subject.total_classes} classes
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {subject.unique_students} students
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right min-w-[80px]">
                            <div className={`text-2xl font-bold ${status.color}`}>
                              {subject.attendance_rate}%
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {subject.present}/{subject.total_classes}
                            </div>
                          </div>
                          <div className="w-24">
                            <Progress value={subject.attendance_rate} className="h-2.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!subjectWise?.subjects || subjectWise.subjects.length === 0) && (
                  <div className="text-center py-12">
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400 text-lg">No subject data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-2xl">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-2 rounded-xl">
                    <Calendar className="h-5 w-5 text-green-400" />
                  </div>
                  Daily Attendance Trends
                </CardTitle>
                <select 
                  value={daysFilter} 
                  onChange={(e) => setDaysFilter(Number(e.target.value))}
                  className="bg-slate-800/50 text-white px-4 py-2 rounded-xl border border-slate-700/50 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all duration-200 cursor-pointer"
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={14}>Last 14 Days</option>
                  <option value={30}>Last 30 Days</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {weeklyBreakdown?.breakdown?.map((day: DayBreakdown, index: number) => {
                  const dayStatus = getStatusColor(day.percentage);
                  return (
                    <div key={index} className="group relative">
                      <div className={`absolute inset-0 ${dayStatus.bgColor} rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                      
                      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/30 hover:border-slate-600/50 transition-all duration-300 gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-center min-w-[70px] bg-slate-700/30 px-3 py-2 rounded-lg">
                            <div className="text-base font-bold text-white">{day.day}</div>
                            <div className="text-xs text-slate-400">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          </div>
                          
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-lg">
                              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-sm font-semibold text-green-400">{day.present}</span>
                              <span className="text-xs text-slate-400">Present</span>
                            </div>
                            <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg">
                              <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                              <span className="text-sm font-semibold text-red-400">{day.absent}</span>
                              <span className="text-xs text-slate-400">Absent</span>
                            </div>
                            <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1.5 rounded-lg">
                              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
                              <span className="text-sm font-semibold text-yellow-400">{day.late}</span>
                              <span className="text-xs text-slate-400">Late</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="text-right">
                            <span className={`text-2xl font-bold ${dayStatus.color}`}>
                              {day.percentage}%
                            </span>
                            <div className="text-xs text-slate-400 mt-1">
                              {day.total} total records
                            </div>
                          </div>
                          <div className="w-32">
                            <Progress value={day.percentage} className="h-2.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!weeklyBreakdown?.breakdown || weeklyBreakdown.breakdown.length === 0) && (
                  <div className="text-center py-12">
                    <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400 text-lg">No attendance data for this period</p>
                    <p className="text-slate-500 text-sm mt-2">Try selecting a different time range</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-2 rounded-xl">
                    <Award className="h-5 w-5 text-yellow-400" />
                  </div>
                  {filters.showLowPerformers ? 'Students Needing Support' : 'Top Performing Students'}
                </CardTitle>
                <Badge variant="outline" className={`${filters.showLowPerformers ? 'bg-red-500/10 text-red-400 border-red-500/50' : 'bg-green-500/10 text-green-400 border-green-500/50'}`}>
                  {filteredPerformers.length} students
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredPerformers.map((student: TopPerformer, index: number) => (
                  <div key={index} className="group relative">
                    <div className={`absolute inset-0 ${
                      !filters.showLowPerformers && index === 0 ? 'bg-yellow-500/5' :
                      !filters.showLowPerformers && index === 1 ? 'bg-gray-500/5' :
                      !filters.showLowPerformers && index === 2 ? 'bg-orange-500/5' :
                      filters.showLowPerformers ? 'bg-red-500/5' :
                      'bg-blue-500/5'
                    } rounded-xl blur-sm group-hover:blur-md transition-all duration-300`}></div>
                    
                    <div className="relative flex items-center justify-between p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/30 hover:border-slate-600/50 transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg ${
                          !filters.showLowPerformers && index === 0 ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-yellow-400 ring-2 ring-yellow-500/50' :
                          !filters.showLowPerformers && index === 1 ? 'bg-gradient-to-br from-gray-500/30 to-slate-500/30 text-gray-300 ring-2 ring-gray-500/50' :
                          !filters.showLowPerformers && index === 2 ? 'bg-gradient-to-br from-orange-500/30 to-yellow-700/30 text-orange-400 ring-2 ring-orange-500/50' :
                          filters.showLowPerformers ? 'bg-gradient-to-br from-red-500/20 to-pink-500/20 text-red-400' :
                          'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400'
                        }`}>
                          {!filters.showLowPerformers && index < 3 ? (
                            <Award className="h-6 w-6" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-lg">{student.name}</div>
                          <div className="text-sm text-slate-400 flex items-center gap-2">
                            <span>{student.student_id}</span>
                            <span>•</span>
                            <span>{student.faculty}</span>
                            <span>•</span>
                            <span>Sem {student.semester}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            student.attendance_rate >= 90 ? 'text-green-400' :
                            student.attendance_rate >= 75 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {student.attendance_rate}%
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {student.present_count}/{student.total_classes} classes
                          </div>
                        </div>
                        <div className="flex items-center gap-2 min-w-[80px]">
                          {getTrendIcon(student.trend)}
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${
                              student.trend === 'up' ? 'text-green-400' :
                              student.trend === 'down' ? 'text-red-400' :
                              'text-blue-400'
                            }`}>
                              {student.recent_rate}%
                            </div>
                            <div className="text-xs text-slate-500">recent</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!filteredPerformers || filteredPerformers.length === 0) && (
                  <div className="text-center py-12">
                    <Award className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400 text-lg">No performance data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insights?.insights?.map((insight: Insight, index: number) => (
              <div key={index} className="group relative">
                <div className={`absolute inset-0 rounded-2xl blur-xl opacity-50 transition-opacity duration-300 ${
                  insight.priority === 'high' ? 'bg-red-500/20' :
                  insight.priority === 'medium' ? 'bg-yellow-500/20' :
                  'bg-blue-500/20'
                }`}></div>
                
                <Card className={`relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-slate-700/50 hover:border-slate-600/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                  insight.priority === 'high' ? 'border-l-4 border-l-red-500' :
                  insight.priority === 'medium' ? 'border-l-4 border-l-yellow-500' :
                  'border-l-4 border-l-blue-500'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`relative h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                        insight.type === 'success' ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 text-green-400' :
                        insight.type === 'warning' ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-yellow-400' :
                        insight.type === 'info' ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/30 text-blue-400' :
                        'bg-gradient-to-br from-red-500/30 to-pink-500/30 text-red-400'
                      }`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl"></div>
                        {getInsightIcon(insight.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="text-white font-bold text-lg">{insight.title}</h3>
                          <Badge variant="outline" className={`text-xs ${
                            insight.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/50' :
                            insight.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/50'
                          }`}>
                            {insight.priority}
                          </Badge>
                        </div>
                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">{insight.description}</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`${
                            insight.type === 'success' ? 'border-green-600/50 bg-green-600/10 text-green-400 hover:bg-green-600/20' :
                            insight.type === 'warning' ? 'border-yellow-600/50 bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20' :
                            insight.type === 'info' ? 'border-blue-600/50 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20' :
                            'border-red-600/50 bg-red-600/10 text-red-400 hover:bg-red-600/20'
                          } transition-all duration-200`}
                        >
                          {insight.action}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
            {(!insights?.insights || insights.insights.length === 0) && (
              <div className="col-span-2 text-center py-16">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full"></div>
                  <Activity className="relative h-20 w-20 mx-auto mb-4 text-slate-600" />
                </div>
                <p className="text-slate-400 text-xl font-medium mb-2">No insights available</p>
                <p className="text-slate-500 text-sm">System is monitoring attendance patterns</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Add custom CSS for scrollbar
const styles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(51, 65, 85, 0.3);
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(100, 116, 139, 0.5);
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(148, 163, 184, 0.7);
  }
  
  @media print {
    .print\\:hidden {
      display: none !important;
    }
    
    .print\\:bg-white {
      background: white !important;
    }
    
    @page {
      margin: 1cm;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('advanced-analytics-styles');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'advanced-analytics-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }
}

export default AdvancedAnalyticsDashboard;
