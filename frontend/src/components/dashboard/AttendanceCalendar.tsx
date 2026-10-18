import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft20Regular, ChevronRight20Regular, CalendarLtr20Regular } from '@fluentui/react-icons';
import { CalendarDay } from '@/types/dashboard';

interface AttendanceCalendarProps {
  calendarData: CalendarDay[];
  currentMonth: number;
  currentYear: number;
  onMonthChange: (month: number, year: number) => void;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  calendarData,
  currentMonth,
  currentYear,
  onMonthChange
}) => {
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Day statuses come from the server (present, absent, partial, excused, cancelled,
  // unrecorded, holiday, weekly_off, exam, between_terms, no_class, future; legacy late).
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present':
        return 'bg-status-success-subtle text-status-success border-status-success-border';
      case 'absent':
        return 'bg-status-error-subtle text-status-error border-status-error-border';
      case 'late':
      case 'partial':
        return 'bg-status-warning-subtle text-status-warning border-status-warning-border';
      case 'excused':
        return 'bg-status-info-subtle text-status-info border-status-info-border';
      case 'unrecorded':
        return 'bg-surface-default text-text-secondary border-dashed border-border-strong';
      case 'cancelled':
      case 'holiday':
      case 'weekly_off':
      case 'exam':
      case 'between_terms':
        return 'bg-surface-subtle text-text-muted border-border-subtle';
      default:
        return 'bg-surface-default text-text-muted border-border-subtle hover:bg-surface-hover';
    }
  };

  const getStatusDot = (status?: string) => {
    switch (status) {
      case 'present':
        return 'bg-status-success';
      case 'absent':
        return 'bg-status-error';
      case 'late':
      case 'partial':
        return 'bg-status-warning';
      case 'excused':
        return 'bg-status-info';
      default:
        return '';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    let newMonth = currentMonth;
    let newYear = currentYear;

    if (direction === 'prev') {
      newMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      newYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    } else {
      newMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      newYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    }

    onMonthChange(newMonth, newYear);
  };

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Create calendar grid
  const calendarGrid = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarGrid.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = calendarData.find(d => {
      const dayFromData = new Date(d.date).getDate();
      return dayFromData === day;
    });
    calendarGrid.push(dayData || { date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }

  return (
    <Card className="border-0 bg-surface-default shadow">
      <CardHeader className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <CalendarLtr20Regular aria-hidden />
            </div>
            <div>
              <CardTitle className="text-subheading text-text-primary">
                Attendance Calendar
              </CardTitle>
              <CardDescription className="text-caption text-text-muted">
                Visual overview of your monthly attendance
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigateMonth('prev')}
              aria-label="Previous month"
            >
              <ChevronLeft20Regular aria-hidden />
            </Button>
            <span className="min-w-[120px] text-center text-body-strong text-text-primary">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigateMonth('next')}
              aria-label="Next month"
            >
              <ChevronRight20Regular aria-hidden />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-4">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayNames.map(day => (
              <div key={day} className="py-1.5 text-center text-caption-strong text-text-secondary">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarGrid.map((dayData, index) => {
              if (!dayData) {
                return <div key={`empty-${index}`} className="p-2" />;
              }

              const day = new Date(dayData.date).getDate();
              const isToday = new Date(dayData.date).toDateString() === new Date().toDateString();

              return (
                <div
                  key={dayData.date}
                  className={`
                    relative flex h-10 cursor-pointer items-center justify-center rounded-md border text-body tabular-nums transition-colors duration-150
                    ${getStatusColor(dayData.status)}
                    ${isToday ? 'outline outline-2 outline-offset-1 outline-[color:var(--brand)]' : ''}
                  `}
                  onMouseEnter={() => setHoveredDay(dayData)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <span className={isToday ? 'font-semibold' : ''}>{day}</span>
                  {dayData.status && getStatusDot(dayData.status) && (
                    <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${getStatusDot(dayData.status)}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 border-t border-border-subtle pt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-status-success" />
              <span className="text-caption text-text-secondary">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-status-warning" />
              <span className="text-caption text-text-secondary">Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-status-error" />
              <span className="text-caption text-text-secondary">Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-status-info" />
              <span className="text-caption text-text-secondary">Excused</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full border border-dashed border-border-strong" />
              <span className="text-caption text-text-secondary">Not recorded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full border border-border-default bg-surface-subtle" />
              <span className="text-caption text-text-secondary">No Class</span>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredDay && hoveredDay.subjects && hoveredDay.subjects.length > 0 && (
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-body shadow-lg">
              <p className="mb-1 text-body-strong text-text-primary">
                {new Date(hoveredDay.date).toLocaleDateString()}
              </p>
              {hoveredDay.subjects.map((subject, index) => (
                <div key={index} className="flex justify-between text-text-secondary">
                  <span>{subject.name}</span>
                  <span className="ml-2 tabular-nums text-text-muted">{subject.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendar;
