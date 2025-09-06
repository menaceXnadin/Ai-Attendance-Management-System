/**
 * Interactive Attendance Calendar Component
 * Shows monthly attendance with visual indicators
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Eye } from 'lucide-react';

interface AttendanceDay {
  date: string;
  status: 'present' | 'absent' | 'late' | 'no-class';
  subjects: Array<{
    name: string;
    status: 'present' | 'absent' | 'late';
    confidence?: number;
  }>;
}

interface AttendanceCalendarProps {
  studentId?: number;
  onDateSelect?: (date: string, dayData: AttendanceDay) => void;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ 
  studentId, 
  onDateSelect 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Fetch attendance data for the current month
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance-calendar', currentYear, currentMonth, studentId],
    queryFn: async () => {
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
      
      return await api.studentAttendance.getRecords({
        startDate,
        endDate,
        limit: 100
      });
    },
    enabled: true,
  });

  // Process attendance data into calendar format
  const calendarData = useMemo(() => {
    if (!attendanceData?.records) return {};

    const processedData: Record<string, AttendanceDay> = {};

    // Group records by date
    attendanceData.records.forEach((record: any) => {
      const date = record.date;
      
      if (!processedData[date]) {
        processedData[date] = {
          date,
          status: 'no-class',
          subjects: []
        };
      }

      processedData[date].subjects.push({
        name: record.subject_name,
        status: record.status,
        confidence: record.confidence_score
      });
    });

    // Determine overall status for each day
    Object.keys(processedData).forEach(date => {
      const day = processedData[date];
      const statuses = day.subjects.map(s => s.status);
      
      if (statuses.every(s => s === 'present')) {
        day.status = 'present';
      } else if (statuses.some(s => s === 'absent')) {
        day.status = 'absent';
      } else if (statuses.some(s => s === 'late')) {
        day.status = 'late';
      } else {
        day.status = 'no-class';
      }
    });

    return processedData;
  }, [attendanceData]);

  // Generate calendar grid
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const days = [];
    const current = new Date(startDate);

    // Generate 6 weeks (42 days) to fill the calendar grid
    for (let i = 0; i < 42; i++) {
      const dateStr = current.toISOString().split('T')[0];
      const isCurrentMonth = current.getMonth() === currentMonth;
      const isToday = current.toDateString() === new Date().toDateString();
      const attendanceDay = calendarData[dateStr];

      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth,
        isToday,
        attendanceDay
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentYear, currentMonth, calendarData]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'absent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'late': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return '✓';
      case 'absent': return '✗';
      case 'late': return '⚠';
      default: return '';
    }
  };

  const handleDateClick = (dateStr: string, attendanceDay?: AttendanceDay) => {
    setSelectedDate(dateStr);
    if (onDateSelect && attendanceDay) {
      onDateSelect(dateStr, attendanceDay);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return (
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-700 rounded w-48"></div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            Attendance Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-white font-medium min-w-[140px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Calendar Grid */}
        <div className="space-y-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-slate-400 text-sm font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarGrid.map(({ date, dateStr, isCurrentMonth, isToday, attendanceDay }) => (
              <button
                key={dateStr}
                onClick={() => handleDateClick(dateStr, attendanceDay)}
                className={`
                  relative h-12 rounded-lg border transition-all duration-200
                  ${isCurrentMonth ? 'text-white' : 'text-slate-600'}
                  ${isToday ? 'ring-2 ring-blue-400' : ''}
                  ${selectedDate === dateStr ? 'ring-2 ring-white' : ''}
                  ${attendanceDay ? getStatusColor(attendanceDay.status) : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'}
                  ${!attendanceDay && isCurrentMonth ? 'hover:bg-slate-700/50' : ''}
                `}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className="text-sm font-medium">
                    {date.getDate()}
                  </span>
                  {attendanceDay && (
                    <span className="text-xs">
                      {getStatusIcon(attendanceDay.status)}
                    </span>
                  )}
                </div>
                
                {/* Indicator for multiple subjects */}
                {attendanceDay && attendanceDay.subjects.length > 1 && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30"></div>
            <span className="text-slate-400 text-sm">Present</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30"></div>
            <span className="text-slate-400 text-sm">Absent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30"></div>
            <span className="text-slate-400 text-sm">Late</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-500/20 border border-slate-500/30"></div>
            <span className="text-slate-400 text-sm">No Class</span>
          </div>
        </div>

        {/* Selected Date Details */}
        {selectedDate && calendarData[selectedDate] && (
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-blue-400" />
              <span className="text-white font-medium">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            
            <div className="space-y-2">
              {calendarData[selectedDate].subjects.map((subject, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-slate-300">{subject.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(subject.status)}>
                      {subject.status}
                    </Badge>
                    {subject.confidence && (
                      <span className="text-xs text-slate-500">
                        {Math.round(subject.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendar;