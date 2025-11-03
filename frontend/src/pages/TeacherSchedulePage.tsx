import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TeacherSidebar from '@/components/TeacherSidebar';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { api } from '@/integrations/api/client';

interface ScheduleItem {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  classroom: string;
  semester: number;
  academic_year: number;
  subject: {
    id: number;
    name: string;
    code: string;
  };
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

const TeacherSchedulePage: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Get current day of week
  const today = new Date();
  const currentDayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentDayName = DAYS_OF_WEEK[(currentDayIndex + 6) % 7]; // Adjust to match our array (Monday = 0)

  // Fetch teacher's schedule
  const { data: scheduleData = [], isLoading } = useQuery({
    queryKey: ['teacher-schedule', selectedDay],
    queryFn: async () => {
      const response = await api.teacher.getSchedule(selectedDay !== 'all' ? selectedDay : undefined);
      return response as ScheduleItem[];
    }
  });

  // Group schedule by day
  const scheduleByDay = React.useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    DAYS_OF_WEEK.forEach(day => {
      grouped[day] = [];
    });

    scheduleData.forEach(item => {
      const day = item.day_of_week.toLowerCase();
      if (grouped[day]) {
        grouped[day].push(item);
      }
    });

    // Sort by start time within each day
    Object.keys(grouped).forEach(day => {
      grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });

    return grouped;
  }, [scheduleData]);

  // Calculate total classes
  const totalClasses = scheduleData.length;
  const todayClasses = scheduleByDay[currentDayName]?.length || 0;

  // Get time range for display
  const getTimeRange = () => {
    if (scheduleData.length === 0) return null;
    const times = scheduleData.map(s => s.start_time);
    const earliest = times.sort()[0];
    const latest = scheduleData.map(s => s.end_time).sort().reverse()[0];
    return { earliest, latest };
  };

  const timeRange = getTimeRange();

  // Filter for current week view
  const getWeekDays = () => {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7)); // Monday
    
    return DAYS_OF_WEEK.map((day, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      return {
        name: day,
        label: DAY_LABELS[day],
        date: date,
        isToday: day === currentDayName && currentWeekOffset === 0
      };
    });
  };

  const weekDays = getWeekDays();

  const ScheduleCard: React.FC<{ item: ScheduleItem; compact?: boolean }> = ({ item, compact = false }) => (
    <div 
      className={`p-3 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 transition-colors ${
        compact ? 'mb-2' : 'mb-3'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <h4 className="font-medium text-white text-sm">
            {item.subject.name}
          </h4>
        </div>
        <Badge variant="outline" className="text-xs border-blue-400/30 text-blue-300">
          {item.subject.code}
        </Badge>
      </div>
      
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{item.start_time} - {item.end_time}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="w-3.5 h-3.5" />
          <span>{item.classroom}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>Semester {item.semester} • {item.academic_year}</span>
        </div>
      </div>
    </div>
  );

  return (
    <TeacherSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">My Schedule</h1>
          <p className="text-slate-400">View your weekly class timetable</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Classes</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalClasses}</p>
                </div>
                <Calendar className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Classes Today</p>
                  <p className="text-3xl font-bold text-white mt-1">{todayClasses}</p>
                </div>
                <Clock className="w-10 h-10 text-teal-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Teaching Hours</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {timeRange ? `${timeRange.earliest} - ${timeRange.latest}` : '-'}
                  </p>
                </div>
                <BookOpen className="w-10 h-10 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/70 border-slate-700/80 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-slate-400" />
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Filter by day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Days</SelectItem>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day} value={day}>
                        {DAY_LABELS[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                  className="border-slate-700 hover:bg-slate-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-400 px-3">
                  {currentWeekOffset === 0 ? 'This Week' : 
                   currentWeekOffset > 0 ? `${currentWeekOffset} Week(s) Ahead` : 
                   `${Math.abs(currentWeekOffset)} Week(s) Ago`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                  className="border-slate-700 hover:bg-slate-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly View */}
        {!isLoading && selectedDay === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {weekDays.map(({ name, label, date, isToday }) => (
              <Card 
                key={name}
                className={`bg-slate-900/70 border-slate-700/80 ${
                  isToday ? 'ring-2 ring-blue-400/50' : ''
                }`}
              >
                <CardHeader className="border-b border-slate-800/50 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      {label}
                      {isToday && (
                        <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                          Today
                        </Badge>
                      )}
                    </CardTitle>
                    <span className="text-xs text-slate-400">
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <CardDescription className="text-slate-400">
                    {scheduleByDay[name]?.length || 0} class(es)
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {scheduleByDay[name]?.length > 0 ? (
                    <div className="space-y-2">
                      {scheduleByDay[name].map(item => (
                        <ScheduleCard key={item.id} item={item} compact />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No classes scheduled</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Single Day View */}
        {!isLoading && selectedDay !== 'all' && (
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardHeader className="border-b border-slate-800/50">
              <CardTitle className="text-white">
                {DAY_LABELS[selectedDay]} Schedule
              </CardTitle>
              <CardDescription className="text-slate-400">
                {scheduleByDay[selectedDay]?.length || 0} class(es) scheduled
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {scheduleByDay[selectedDay]?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scheduleByDay[selectedDay].map(item => (
                    <ScheduleCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg mb-1">No classes on {DAY_LABELS[selectedDay]}</p>
                  <p className="text-sm">You have a free day!</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && totalClasses === 0 && (
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6">
              <div className="text-center py-12 text-slate-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-xl mb-2">No Schedule Found</p>
                <p className="text-sm">You haven't been assigned to any classes yet.</p>
                <p className="text-xs mt-2">Contact your administrator for class assignments.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TeacherSidebar>
  );
};

export default TeacherSchedulePage;
