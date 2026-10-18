import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TeacherSidebar from '@/components/TeacherSidebar';
import { cn } from '@/lib/utils';
import {
  ArrowSync20Regular,
  Book20Regular,
  CalendarLtr20Regular,
  CalendarLtr24Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Clock16Regular,
  Clock20Regular,
  Filter20Regular,
  Location16Regular,
  People16Regular,
} from '@fluentui/react-icons';
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

/** Outlook-style event colours (categorical chart palette, tinted fill + solid left bar). */
const EVENT_COLORS = [
  { block: 'bg-chart-1/15 border-chart-1', bar: 'bg-chart-1' },
  { block: 'bg-chart-2/15 border-chart-2', bar: 'bg-chart-2' },
  { block: 'bg-chart-3/15 border-chart-3', bar: 'bg-chart-3' },
  { block: 'bg-chart-4/15 border-chart-4', bar: 'bg-chart-4' },
  { block: 'bg-chart-5/15 border-chart-5', bar: 'bg-chart-5' },
  { block: 'bg-chart-6/15 border-chart-6', bar: 'bg-chart-6' },
  { block: 'bg-chart-7/15 border-chart-7', bar: 'bg-chart-7' },
  { block: 'bg-chart-8/15 border-chart-8', bar: 'bg-chart-8' },
];

const colorFor = (subjectId: number) => EVENT_COLORS[Math.abs(subjectId) % EVENT_COLORS.length];

/** "HH:MM[:SS]" → minutes since midnight */
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const HOUR_HEIGHT = 56; // px per hour row in the week grid

const formatHour = (h: number) => {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
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

  // ---- Presentation helpers for the Outlook-style week grid ----
  const gridStartHour = timeRange ? Math.min(8, Math.floor(toMinutes(timeRange.earliest) / 60)) : 8;
  const gridEndHour = timeRange ? Math.max(17, Math.ceil(toMinutes(timeRange.latest) / 60)) : 17;
  const hours = Array.from({ length: Math.max(1, gridEndHour - gridStartHour) }, (_, i) => gridStartHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowOffset = ((nowMinutes - gridStartHour * 60) / 60) * HOUR_HEIGHT;
  const showNowLine = nowOffset >= 0 && nowOffset <= gridHeight;

  /** Assign side-by-side lanes to overlapping events within a day. */
  const layoutDay = (items: ScheduleItem[]) => {
    const laneEnds: number[] = [];
    const placed = items.map((item) => {
      const start = toMinutes(item.start_time);
      const end = Math.max(start + 15, toMinutes(item.end_time));
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      return { item, start, end, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);
    return placed.map((p) => ({ ...p, laneCount }));
  };

  const weekRangeLabel = `${weekDays[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const ScheduleCard: React.FC<{ item: ScheduleItem; compact?: boolean }> = ({ item, compact = false }) => {
    const color = colorFor(item.subject.id);
    return (
      <div
        className={cn(
          'flex overflow-hidden rounded-md border border-border-subtle bg-surface-default transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover',
          compact ? 'mb-2' : 'mb-0'
        )}
      >
        <span className={cn('w-1 shrink-0', color.bar)} aria-hidden />
        <div className="min-w-0 flex-1 p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h4 className="truncate text-body-strong text-text-primary">
              {item.subject.name}
            </h4>
            <Badge variant="secondary" className="shrink-0 font-mono">
              {item.subject.code}
            </Badge>
          </div>

          <div className="space-y-1 text-caption text-text-secondary">
            <div className="flex items-center gap-2 tabular-nums">
              <Clock16Regular className="text-text-muted" aria-hidden />
              <span>{item.start_time} - {item.end_time}</span>
            </div>
            <div className="flex items-center gap-2">
              <Location16Regular className="text-text-muted" aria-hidden />
              <span>{item.classroom}</span>
            </div>
            <div className="flex items-center gap-2 text-text-muted">
              <People16Regular aria-hidden />
              <span>Semester {item.semester} · {item.academic_year}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const kpis = [
    { label: 'Total Classes', value: String(totalClasses), icon: CalendarLtr20Regular },
    { label: 'Classes Today', value: String(todayClasses), icon: Clock20Regular },
    { label: 'Teaching Hours', value: timeRange ? `${timeRange.earliest} - ${timeRange.latest}` : '-', icon: Book20Regular },
  ];

  return (
    <TeacherSidebar>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="page-header !mb-2">
          <div>
            <h1 className="text-page-title text-text-primary">My Schedule</h1>
            <p className="mt-1 text-body text-text-muted">View your weekly class timetable</p>
          </div>
        </div>

        {/* Statistics tiles */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {kpis.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-surface-default p-4 shadow">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">{label}</p>
                <p className="mt-1 truncate text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{value}</p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                <Icon aria-hidden />
              </div>
            </div>
          ))}
        </div>

        {/* Calendar surface */}
        <section className="rounded-lg bg-surface-default shadow">
          {/* Command bar */}
          <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                aria-label="Previous week"
              >
                <ChevronLeft20Regular aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                aria-label="Next week"
              >
                <ChevronRight20Regular aria-hidden />
              </Button>
              <div className="ml-2">
                <p className="text-body-strong text-text-primary">
                  {currentWeekOffset === 0 ? 'This Week' :
                   currentWeekOffset > 0 ? `${currentWeekOffset} Week(s) Ahead` :
                   `${Math.abs(currentWeekOffset)} Week(s) Ago`}
                </p>
                <p className="text-caption text-text-muted tabular-nums">{weekRangeLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter20Regular className="text-text-muted" aria-hidden />
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="w-[180px]">
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
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-body text-text-muted">
              <ArrowSync20Regular className="animate-spin text-brand-foreground" aria-hidden />
              Loading schedule...
            </div>
          )}

          {/* Weekly View (Outlook work-week grid) */}
          {!isLoading && selectedDay === 'all' && totalClasses > 0 && (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                {/* Day header row */}
                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border-subtle">
                  <div />
                  {weekDays.map(({ name, label, date, isToday }) => (
                    <div
                      key={name}
                      className={cn(
                        'border-l border-border-subtle px-2 py-2',
                        isToday && 'bg-brand-subtle/40'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'grid h-7 min-w-7 place-items-center rounded-full px-1 text-subheading tabular-nums',
                            isToday ? 'bg-brand text-brand-on' : 'text-text-primary'
                          )}
                        >
                          {date.getDate()}
                        </span>
                        <div className="min-w-0">
                          <p className={cn('truncate text-caption-strong', isToday ? 'text-brand-foreground' : 'text-text-secondary')}>
                            {label}
                          </p>
                          <p className="text-overline font-normal text-text-muted">
                            {scheduleByDay[name]?.length || 0} class(es)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time grid */}
                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                  {/* Time gutter */}
                  <div className="relative" style={{ height: gridHeight }}>
                    {hours.map((h, i) => (
                      <span
                        key={h}
                        className="absolute right-2 -translate-y-1/2 text-overline font-normal text-text-muted tabular-nums"
                        style={{ top: i * HOUR_HEIGHT }}
                      >
                        {i === 0 ? '' : formatHour(h)}
                      </span>
                    ))}
                  </div>

                  {weekDays.map(({ name, isToday }) => (
                    <div
                      key={name}
                      className={cn('relative border-l border-border-subtle', isToday && 'bg-brand-subtle/20')}
                      style={{ height: gridHeight }}
                    >
                      {/* Hour lines */}
                      {hours.map((h, i) => (
                        <div
                          key={h}
                          className="absolute inset-x-0 border-t border-border-subtle"
                          style={{ top: i * HOUR_HEIGHT }}
                          aria-hidden
                        />
                      ))}

                      {/* Events */}
                      {layoutDay(scheduleByDay[name] || []).map(({ item, start, end, lane, laneCount }) => {
                        const top = ((start - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                        const height = Math.max(22, ((end - start) / 60) * HOUR_HEIGHT - 2);
                        const color = colorFor(item.subject.id);
                        const short = height < 48;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'absolute overflow-hidden rounded border-l-[3px] px-1.5 py-1 text-text-primary transition-shadow duration-150 ease-fluent-standard hover:z-10 hover:shadow-md',
                              color.block
                            )}
                            style={{
                              top: top + 1,
                              height,
                              left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                              width: `calc(${100 / laneCount}% - 4px)`,
                            }}
                            title={`${item.subject.name} (${item.subject.code})\n${item.start_time} - ${item.end_time}\n${item.classroom} · Semester ${item.semester}`}
                          >
                            <p className="truncate text-caption-strong">{item.subject.name}</p>
                            {short ? null : (
                              <>
                                <p className="truncate text-overline font-normal text-text-secondary tabular-nums">
                                  {item.start_time} - {item.end_time}
                                </p>
                                <p className="truncate text-overline font-normal text-text-secondary">{item.classroom}</p>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {/* Current time indicator */}
                      {isToday && showNowLine && (
                        <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowOffset }} aria-hidden>
                          <div className="relative border-t-2 border-status-error">
                            <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-status-error" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Single Day View (agenda) */}
          {!isLoading && selectedDay !== 'all' && (
            <div className="p-5">
              <div className="mb-4">
                <h2 className="text-subheading text-text-primary">
                  {DAY_LABELS[selectedDay]} Schedule
                </h2>
                <p className="text-caption text-text-muted">
                  {scheduleByDay[selectedDay]?.length || 0} class(es) scheduled
                </p>
              </div>
              {scheduleByDay[selectedDay]?.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {scheduleByDay[selectedDay].map(item => (
                    <ScheduleCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                    <CalendarLtr24Regular aria-hidden />
                  </div>
                  <p className="text-subheading text-text-primary">No classes on {DAY_LABELS[selectedDay]}</p>
                  <p className="mt-1 text-body text-text-muted">You have a free day!</p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && selectedDay === 'all' && totalClasses === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                <CalendarLtr24Regular aria-hidden />
              </div>
              <p className="text-subheading text-text-primary">No Schedule Found</p>
              <p className="mt-1 text-body text-text-muted">You haven't been assigned to any classes yet.</p>
              <p className="mt-0.5 text-caption text-text-muted">Contact your administrator for class assignments.</p>
            </div>
          )}
        </section>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherSchedulePage;
