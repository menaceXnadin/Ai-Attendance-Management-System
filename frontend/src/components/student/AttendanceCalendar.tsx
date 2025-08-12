import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttendanceRecord {
  date: string;
  subject: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  time: string;
}

interface AttendanceCalendarProps {
  attendanceData: AttendanceRecord[];
  currentMonth?: Date;
  onMonthChange?: (month: Date) => void;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  attendanceData,
  currentMonth = new Date(),
  onMonthChange
}) => {
  // Generate calendar data for the current month
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of month and how many days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Create array of days with attendance data
    const days = [];
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAttendance = attendanceData.filter(record => 
        record.date.startsWith(dateStr)
      );
      
      // Calculate day status based on attendance records
      let dayStatus: 'present' | 'absent' | 'partial' | 'excused' | 'none' = 'none';
      if (dayAttendance.length > 0) {
        const presentCount = dayAttendance.filter(r => r.status === 'present').length;
        const excusedCount = dayAttendance.filter(r => r.status === 'excused').length;
        const totalCount = dayAttendance.length;
        
        if (presentCount === totalCount) {
          dayStatus = 'present';
        } else if (excusedCount === totalCount) {
          dayStatus = 'excused';
        } else if (presentCount > 0 || excusedCount > 0) {
          dayStatus = 'partial';
        } else {
          dayStatus = 'absent';
        }
      }
      
      days.push({
        day,
        date: dateStr,
        status: dayStatus,
        records: dayAttendance,
        isToday: dateStr === new Date().toISOString().split('T')[0]
      });
    }
    
    return days;
  }, [currentMonth, attendanceData]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    onMonthChange?.(newMonth);
  };

  const getDayClassName = (dayStatus: string, isToday: boolean) => {
    const base = "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors relative";
    
    if (isToday) {
      return `${base} ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900`;
    }
    
    switch (dayStatus) {
      case 'present':
        return `${base} bg-green-500/20 text-green-400 border border-green-500/30`;
      case 'absent':
        return `${base} bg-red-500/20 text-red-400 border border-red-500/30`;
      case 'excused':
        return `${base} bg-blue-500/20 text-blue-400 border border-blue-500/30`;
      case 'partial':
        return `${base} bg-yellow-500/20 text-yellow-400 border border-yellow-500/30`;
      default:
        return `${base} text-slate-400 hover:bg-slate-800/50`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-3 h-3 absolute -top-1 -right-1 text-green-500" />;
      case 'absent':
        return <XCircle className="w-3 h-3 absolute -top-1 -right-1 text-red-500" />;
      case 'excused':
        return <CheckCircle className="w-3 h-3 absolute -top-1 -right-1 text-blue-500" />;
      case 'partial':
        return <Clock className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500" />;
      default:
        return null;
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Attendance Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="text-slate-300 hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-lg font-semibold text-white min-w-[140px] text-center">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="text-slate-300 hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="space-y-4">
          {/* Week Day Headers */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-sm font-medium text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarData.map((dayData, index) => (
              <div key={index} className="flex justify-center">
                {dayData ? (
                  <div 
                    className={getDayClassName(dayData.status, dayData.isToday)}
                    title={dayData.records.length > 0 ? 
                      `${dayData.records.length} classes - ${dayData.records.map(r => `${r.subject}: ${r.status}`).join(', ')}` 
                      : 'No classes'
                    }
                  >
                    {dayData.day}
                    {getStatusIcon(dayData.status)}
                  </div>
                ) : (
                  <div className="w-10 h-10" />
                )}
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30"></div>
              <span className="text-sm text-slate-300">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/30"></div>
              <span className="text-sm text-slate-300">Excused</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30"></div>
              <span className="text-sm text-slate-300">Partial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30"></div>
              <span className="text-sm text-slate-300">Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-blue-500"></div>
              <span className="text-sm text-slate-300">Today</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendar;
