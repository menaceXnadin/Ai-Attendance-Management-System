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
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarLtr20Regular,
  CheckmarkCircle12Filled,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  DismissCircle12Filled,
  Eye20Regular,
  Warning12Filled
} from '@fluentui/react-icons';

interface AttendanceDay {
  date: string;
  status: 'present' | 'absent' | 'late' | 'no-class';
  subjects: Array<{
    name: string;
    status: 'present' | 'absent' | 'late';
    confidence?: number;
  }>;
}

type AttendanceRecordStatus = 'present' | 'absent' | 'late' | 'excused';

interface AttendanceRecord {
  date: string;
  subject_name: string;
  status: AttendanceRecordStatus;
  confidence_score?: number;
}

interface AttendanceResponse {
  records?: AttendanceRecord[];
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
  const { data: attendanceData, isLoading } = useQuery<AttendanceResponse | undefined>({
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
    attendanceData.records.forEach((record) => {
      const date = record.date;
      const normalizedStatus = record.status === 'excused' ? 'absent' : record.status;
      
      if (!processedData[date]) {
        processedData[date] = {
          date,
          status: 'no-class',
          subjects: []
        };
      }

      processedData[date].subjects.push({
        name: record.subject_name,
        status: normalizedStatus,
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
      case 'present': return 'bg-status-success-subtle text-status-success border-status-success-border';
      case 'absent': return 'bg-status-error-subtle text-status-error border-status-error-border';
      case 'late': return 'bg-status-warning-subtle text-status-warning border-status-warning-border';
      default: return 'bg-surface-subtle text-text-muted border-border-subtle';
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'destructive' | 'warning' | 'secondary' => {
    switch (status) {
      case 'present': return 'success';
      case 'absent': return 'destructive';
      case 'late': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckmarkCircle12Filled aria-label="Present" />;
      case 'absent': return <DismissCircle12Filled aria-label="Absent" />;
      case 'late': return <Warning12Filled aria-label="Late" />;
      default: return null;
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

  const legendItems = [
    { label: 'Present', className: 'bg-status-success-subtle border-status-success-border' },
    { label: 'Absent', className: 'bg-status-error-subtle border-status-error-border' },
    { label: 'Late', className: 'bg-status-warning-subtle border-status-warning-border' },
    { label: 'No Class', className: 'bg-surface-subtle border-border-subtle' },
  ];

  if (isLoading) {
    return (
      <Card className="border-0 bg-surface-default shadow">
        <CardContent className="p-5">
          <div className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <div className="grid grid-cols-7 gap-1.5">
              {[...Array(35)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-0 bg-surface-default shadow">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border-subtle px-5 py-3">
        <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
          <CalendarLtr20Regular className="shrink-0 text-brand-foreground" aria-hidden />
          Attendance Calendar
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateMonth('prev')}
            className="h-8 w-8 text-text-secondary"
            aria-label="Previous month"
          >
            <ChevronLeft20Regular aria-hidden />
          </Button>
          <span className="min-w-[132px] text-center text-body-strong text-text-primary">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateMonth('next')}
            className="h-8 w-8 text-text-secondary"
            aria-label="Next month"
          >
            <ChevronRight20Regular aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {/* Calendar Grid */}
        <div className="space-y-1.5">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1.5">
            {dayNames.map(day => (
              <div key={day} className="py-1 text-center text-caption text-text-muted">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarGrid.map(({ date, dateStr, isCurrentMonth, isToday, attendanceDay }) => {
              const presentCount = attendanceDay?.subjects.filter(s => s.status === 'present').length || 0;
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDateClick(dateStr, attendanceDay)}
                  aria-pressed={isSelected}
                  className={`relative h-12 rounded-md border transition-colors duration-150 ease-fluent-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary ${
                    attendanceDay
                      ? getStatusColor(attendanceDay.status)
                      : `border-transparent ${isCurrentMonth ? 'text-text-primary hover:bg-surface-hover' : 'text-text-disabled'}`
                  } ${!isCurrentMonth && attendanceDay ? 'opacity-60' : ''} ${
                    isSelected ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface-default' : ''
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-0.5">
                    <span
                      className={`grid h-6 min-w-[24px] place-items-center px-1 text-caption-strong tabular-nums ${
                        isToday ? 'rounded-full bg-brand text-brand-on' : ''
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {attendanceDay && attendanceDay.subjects.length > 0 && (
                      <span className="leading-none">
                        {getStatusIcon(attendanceDay.status)}
                      </span>
                    )}
                  </div>

                  {/* Present count for days with attendance */}
                  {presentCount > 0 && (
                    <div className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-status-success px-1 text-[10px] font-semibold leading-none tabular-nums text-text-inverse">
                      {presentCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border-subtle pt-4">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-sm border ${item.className}`} aria-hidden />
              <span className="text-caption text-text-secondary">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-brand" aria-hidden />
            <span className="text-caption text-text-secondary">Today</span>
          </div>
        </div>

        {/* Selected Date Details */}
        {selectedDate && calendarData[selectedDate] && (
          <div className="mt-5 rounded-lg border border-border-subtle bg-surface-subtle p-4">
            <div className="mb-3 flex items-center gap-2">
              <Eye20Regular className="shrink-0 text-brand-foreground" aria-hidden />
              <span className="text-body-strong text-text-primary">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>

            <ul className="space-y-1.5">
              {calendarData[selectedDate].subjects.map((subject, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-md bg-surface-default px-3 py-2"
                >
                  <span className="truncate text-body text-text-primary">{subject.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(subject.status)} shape="pill" className="capitalize">
                      {subject.status}
                    </Badge>
                    {subject.confidence && (
                      <span className="text-caption tabular-nums text-text-muted">
                        {Math.round(subject.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendar;
