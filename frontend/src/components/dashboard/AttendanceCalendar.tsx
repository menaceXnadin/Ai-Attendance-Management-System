import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
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

  const getStatusColor = (status?: 'present' | 'absent' | 'late') => {
    switch (status) {
      case 'present':
        return 'bg-green-500 text-white';
      case 'absent':
        return 'bg-red-500 text-white';
      case 'late':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-100 text-gray-400 hover:bg-gray-200';
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Attendance Calendar
            </CardTitle>
            <CardDescription>
              Visual overview of your monthly attendance
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayNames.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
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
                    relative p-2 text-center text-sm cursor-pointer rounded-md transition-colors
                    ${getStatusColor(dayData.status)}
                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                  `}
                  onMouseEnter={() => setHoveredDay(dayData)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {day}
                  {dayData.status && (
                    <div className="absolute top-0 right-0 h-2 w-2 rounded-full bg-current opacity-75" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-xs text-gray-600">Present</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span className="text-xs text-gray-600">Late</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-xs text-gray-600">Absent</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gray-300" />
              <span className="text-xs text-gray-600">No Class</span>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredDay && hoveredDay.subjects && hoveredDay.subjects.length > 0 && (
            <div className="bg-gray-900 text-white p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">
                {new Date(hoveredDay.date).toLocaleDateString()}
              </p>
              {hoveredDay.subjects.map((subject, index) => (
                <div key={index} className="flex justify-between">
                  <span>{subject.name}</span>
                  <span className="ml-2 opacity-75">{subject.time}</span>
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
