import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Add20Regular,
  Edit20Regular,
  Delete20Regular,
  CalendarLtr20Regular,
  CalendarLtr24Regular,
  CalendarDay20Regular,
  CalendarWorkWeek20Regular,
  TextBulletListLtr20Regular,
  Clock16Regular,
  Location16Regular,
  Person16Regular,
  Note16Regular,
  Timer16Regular,
  BuildingMultiple20Regular,
  Filter20Regular,
  FilterDismiss20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Warning24Regular,
  ErrorCircle20Regular,
} from '@fluentui/react-icons';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Switch } from './ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '../integrations/api/client';
import { Schedule, Subject, Faculty, DayOfWeek } from '../integrations/api/types';

interface ScheduleFormData {
  subject_id: number | null;
  faculty_id: number | null;
  day_of_week: DayOfWeek | null;
  start_time: string;
  end_time: string;
  semester: number;
  academic_year: number;
  classroom?: string;
  instructor_name?: string;
  notes?: string;
}

const initialFormData: ScheduleFormData = {
  subject_id: null,
  faculty_id: null,
  day_of_week: null,
  start_time: '',
  end_time: '',
  semester: 1,
  academic_year: new Date().getFullYear(),
  classroom: '',
  instructor_name: '',
  notes: ''
};

const dayOptions = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' }
];

const semesterOptions = Array.from({ length: 8 }, (_, i) => ({
  value: i + 1,
  label: `Semester ${i + 1}`
}));


// ---------------------------------------------------------------------------
// Calendar presentation helpers (Outlook / Teams calendar look)
// ---------------------------------------------------------------------------

type CalendarView = 'day' | 'week' | 'list';

const VIEW_OPTIONS: { value: CalendarView; label: string; Icon: typeof CalendarDay20Regular }[] = [
  { value: 'day', label: 'Day', Icon: CalendarDay20Regular },
  { value: 'week', label: 'Week', Icon: CalendarWorkWeek20Regular },
  { value: 'list', label: 'List', Icon: TextBulletListLtr20Regular },
];

/** Height of one hour row in the time grid, in px. */
const HOUR_HEIGHT = 56;

/** Per-subject event tones, cycling through the categorical chart palette. */
const EVENT_TONES = [
  { block: 'bg-chart-1/15 hover:bg-chart-1/25 border-l-chart-1', bar: 'bg-chart-1' },
  { block: 'bg-chart-2/15 hover:bg-chart-2/25 border-l-chart-2', bar: 'bg-chart-2' },
  { block: 'bg-chart-3/15 hover:bg-chart-3/25 border-l-chart-3', bar: 'bg-chart-3' },
  { block: 'bg-chart-4/15 hover:bg-chart-4/25 border-l-chart-4', bar: 'bg-chart-4' },
  { block: 'bg-chart-5/15 hover:bg-chart-5/25 border-l-chart-5', bar: 'bg-chart-5' },
  { block: 'bg-chart-6/15 hover:bg-chart-6/25 border-l-chart-6', bar: 'bg-chart-6' },
  { block: 'bg-chart-7/15 hover:bg-chart-7/25 border-l-chart-7', bar: 'bg-chart-7' },
  { block: 'bg-chart-8/15 hover:bg-chart-8/25 border-l-chart-8', bar: 'bg-chart-8' },
];

const toneFor = (subjectId: number) =>
  EVENT_TONES[Math.abs(Number(subjectId) || 0) % EVENT_TONES.length];

const toMinutes = (time: string) => {
  const [h, m] = (time || '0:0').split(':').map((part) => parseInt(part, 10) || 0);
  return h * 60 + m;
};

const formatTimeLabel = (time: string) => {
  const date = new Date(`2000-01-01T${(time || '00:00').slice(0, 5)}:00`);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatHourLabel = (hour: number) =>
  new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

interface PositionedSchedule {
  schedule: Schedule;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** Packs overlapping events of one day into side-by-side lanes. */
const layoutDay = (items: Schedule[]): PositionedSchedule[] => {
  const sorted = items
    .map((schedule) => {
      const start = toMinutes(schedule.start_time);
      return { schedule, start, end: Math.max(toMinutes(schedule.end_time), start + 15) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: PositionedSchedule[] = [];
  let cluster: PositionedSchedule[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach((item) => {
      item.lanes = lanes;
    });
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  sorted.forEach((item) => {
    if (cluster.length && item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  });
  if (cluster.length) flush();

  return result;
};
const ScheduleManagement: React.FC = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(initialFormData);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    faculty_id: 'all',
    semester: 'all',
    day_of_week: 'all',
    status: 'active', // Default to active to maintain original behavior
    academic_year: new Date().getFullYear().toString()
  });

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedFaculty, setSelectedFaculty] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number>(initialFormData.semester);


  // Presentation-only calendar state
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [focusDayIndex, setFocusDayIndex] = useState<number>(new Date().getDay());
  const todayValue = dayOptions[new Date().getDay()].value;

  const queryClient = useQueryClient();

  // Fetch schedules with filters
  const { data: schedules = [], isLoading: isLoadingSchedules, error: schedulesError } = useQuery({
    queryKey: ['schedules', filters, page, pageSize],
    queryFn: async () => {
      const payload: {
        faculty_id?: string | number;
        semester?: string | number;
        day_of_week?: string;
        academic_year?: string | number;
        is_active?: boolean;
        skip: number;
        limit: number;
      } = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
      };
      if (filters.faculty_id && filters.faculty_id !== 'all') payload.faculty_id = filters.faculty_id;
      if (filters.semester && filters.semester !== 'all') payload.semester = filters.semester;
      if (filters.day_of_week && filters.day_of_week !== 'all') payload.day_of_week = filters.day_of_week;
      if (filters.academic_year) payload.academic_year = filters.academic_year;
      if (filters.status === 'active') payload.is_active = true;
      else if (filters.status === 'inactive') payload.is_active = false;
      return api.schedules.getAll(payload);
    }
  });

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.faculty_id, filters.semester, filters.day_of_week, filters.status, filters.academic_year]);

  // Fetch subjects for dropdown, dependent on selected faculty and semester in the form
  const { data: subjects = [], isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['subjects', selectedFaculty, selectedSemester],
    queryFn: () => {
      if (!selectedFaculty) {
        return Promise.resolve([]);
      }
      return api.subjects.getByFacultySemester(selectedFaculty, selectedSemester);
    },
    enabled: !!selectedFaculty,
  });

  // Fetch faculties for dropdown
  const { data: faculties = [] } = useQuery({
    queryKey: ['faculties'],
    queryFn: async () => {
      try {
        return await api.faculties.getAll();
      } catch (error) {
        console.error('Error fetching faculties:', error);
        return [];
      }
    }
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: (data: ScheduleFormData) => {
      const payload = {
        ...data,
        subject_id: data.subject_id!,
        faculty_id: data.faculty_id!,
        day_of_week: data.day_of_week!
      };
      return api.schedules.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      toast.success('Schedule created successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create schedule';
      toast.error(errorMessage);
    }
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ScheduleFormData> }) => {
      return api.schedules.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsEditDialogOpen(false);
      setEditingSchedule(null);
      setFormData(initialFormData);
      toast.success('Schedule updated successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule';
      toast.error(errorMessage);
    }
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: number) => api.schedules.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule deleted successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
      toast.error(errorMessage);
    }
  });

  // Toggle schedule status mutation
  const toggleScheduleMutation = useMutation({
    mutationFn: (id: number) => api.schedules.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule status updated');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule status';
      toast.error(errorMessage);
    }
  });

  const handleCreateSchedule = useCallback(() => {
    if (!formData.subject_id || !formData.faculty_id || !formData.day_of_week || 
        !formData.start_time || !formData.end_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    createScheduleMutation.mutate(formData);
  }, [formData, createScheduleMutation]);

  const handleEditSchedule = useCallback((schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      subject_id: schedule.subject_id,
      faculty_id: schedule.faculty_id,
      day_of_week: schedule.day_of_week as DayOfWeek,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      semester: schedule.semester,
      academic_year: schedule.academic_year,
      classroom: schedule.classroom || '',
      instructor_name: schedule.instructor_name || '',
      notes: schedule.notes || ''
    });
    setSelectedFaculty(schedule.faculty_id);
    setSelectedSemester(schedule.semester);
    setIsEditDialogOpen(true);
  }, []);

  const handleUpdateSchedule = useCallback(() => {
    if (!editingSchedule) return;

    const updateData = Object.fromEntries(
      Object.entries(formData).filter(([_, value]) => value !== null && value !== '')
    );

    updateScheduleMutation.mutate({ 
      id: editingSchedule.id, 
      data: updateData 
    });
  }, [editingSchedule, formData, updateScheduleMutation]);

  const handleDeleteSchedule = useCallback((id: number) => {
    setScheduleToDelete(id);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (scheduleToDelete !== null) {
      deleteScheduleMutation.mutate(scheduleToDelete);
      setIsDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  }, [scheduleToDelete, deleteScheduleMutation]);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingSchedule(null);
    setSelectedFaculty(null);
    setSelectedSemester(initialFormData.semester);
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };


  if (schedulesError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2 text-body text-text-primary"
      >
        <ErrorCircle20Regular className="mt-0.5 shrink-0 text-status-error" aria-hidden />
        <span>Failed to load schedules. Please check your connection and try again.</span>
      </div>
    );
  }

  const visibleDays = calendarView === 'day' ? [dayOptions[focusDayIndex]] : dayOptions;

  return (
    <div className="w-full space-y-4">
      {/* Header / command bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
            <CalendarLtr24Regular aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-section-title text-text-primary">Schedule Management</h1>
            <p className="text-caption text-text-muted">
              Organize and manage class schedules and timetables
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Calendar view"
            className="inline-flex items-center rounded-md border border-border-default bg-surface-default p-0.5"
          >
            {VIEW_OPTIONS.map(({ value, label, Icon }) => {
              const selected = calendarView === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCalendarView(value)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-body transition-colors duration-150 ease-fluent-standard',
                    selected
                      ? 'bg-brand-subtle font-semibold text-brand-foreground'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <Filter20Regular aria-hidden />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Add20Regular aria-hidden />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-section-title text-text-primary">Create New Schedule</DialogTitle>
                <DialogDescription className="text-body text-text-muted">
                  Add a recurring weekly class session to the timetable.
                </DialogDescription>
              </DialogHeader>
              <ScheduleForm
                formData={formData}
                setFormData={setFormData}
                subjects={subjects}
                faculties={faculties}
                isLoading={createScheduleMutation.isPending}
                onFacultyChange={setSelectedFaculty}
                onSemesterChange={setSelectedSemester}
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSchedule} disabled={createScheduleMutation.isPending}>
                  {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <section aria-label="Filter schedules" className="rounded-lg bg-surface-default p-4 shadow">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-body-strong text-text-primary">
              <Filter20Regular className="text-text-muted" aria-hidden />
              Filter Schedules
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({
                faculty_id: 'all',
                semester: 'all',
                day_of_week: 'all',
                status: 'active',
                academic_year: new Date().getFullYear().toString()
              })}
              className="text-text-secondary"
            >
              <FilterDismiss20Regular aria-hidden />
              Clear Filters
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="filter-faculty" className="text-caption-strong text-text-secondary">Faculty</Label>
              <Select
                value={filters.faculty_id}
                onValueChange={(value) => setFilters(prev => ({ ...prev, faculty_id: value }))}
              >
                <SelectTrigger id="filter-faculty">
                  <SelectValue placeholder="All Faculties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Faculties</SelectItem>
                  {faculties.map((faculty) => (
                    <SelectItem key={faculty.id} value={faculty.id.toString()}>
                      {faculty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-semester" className="text-caption-strong text-text-secondary">Semester</Label>
              <Select
                value={filters.semester}
                onValueChange={(value) => setFilters(prev => ({ ...prev, semester: value }))}
              >
                <SelectTrigger id="filter-semester">
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {semesterOptions.map((sem) => (
                    <SelectItem key={sem.value} value={sem.value.toString()}>
                      {sem.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-day" className="text-caption-strong text-text-secondary">Day of Week</Label>
              <Select
                value={filters.day_of_week}
                onValueChange={(value) => setFilters(prev => ({ ...prev, day_of_week: value }))}
              >
                <SelectTrigger id="filter-day">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {dayOptions.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-status" className="text-caption-strong text-text-secondary">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-year" className="text-caption-strong text-text-secondary">Academic Year</Label>
              <Input
                id="filter-year"
                type="number"
                value={filters.academic_year}
                onChange={(e) => setFilters(prev => ({ ...prev, academic_year: e.target.value }))}
                min="2020"
                max="2030"
                className="tabular-nums"
              />
            </div>
          </div>
        </section>
      )}

      {/* Calendar surface */}
      <section aria-label="Schedules" className="overflow-hidden rounded-lg bg-surface-default shadow">
        {/* Calendar toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
          <div className="flex min-w-0 items-center gap-1">
            {calendarView === 'day' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFocusDayIndex(new Date().getDay())}
                  className="mr-1"
                >
                  <CalendarLtr20Regular aria-hidden />
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Previous day"
                  onClick={() => setFocusDayIndex((i) => (i + 6) % 7)}
                >
                  <ChevronLeft20Regular aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Next day"
                  onClick={() => setFocusDayIndex((i) => (i + 1) % 7)}
                >
                  <ChevronRight20Regular aria-hidden />
                </Button>
              </>
            )}
            <span className="ml-1 truncate text-subheading text-text-primary">
              {calendarView === 'day'
                ? dayOptions[focusDayIndex].label
                : calendarView === 'week'
                ? 'Weekly timetable'
                : 'All schedules'}
            </span>
          </div>
          <span className="text-caption text-text-muted tabular-nums">
            Academic year {filters.academic_year || '—'}
          </span>
        </div>

        {isLoadingSchedules ? (
          // Skeleton loading animation
          <div className="divide-y divide-border-subtle">
            {Array.from({ length: 3 }, (_, index) => (
              <ScheduleCardSkeleton key={index} />
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
              <CalendarLtr24Regular aria-hidden />
            </div>
            <h3 className="text-subheading text-text-primary">No schedules found</h3>
            <p className="mt-1 mb-4 max-w-md text-body text-text-muted">
              Create your first schedule or adjust the filters to see existing schedules.
            </p>
            <Button
              onClick={() => {
                resetForm();
                setIsCreateDialogOpen(true);
              }}
            >
              <Add20Regular aria-hidden />
              Create Schedule
            </Button>
          </div>
        ) : calendarView === 'list' ? (
          <div className="divide-y divide-border-subtle">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onEdit={handleEditSchedule}
                onDelete={handleDeleteSchedule}
                onToggleStatus={(id) => toggleScheduleMutation.mutate(id)}
                isToggling={toggleScheduleMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <ScheduleCalendar
            schedules={schedules}
            days={visibleDays}
            todayValue={todayValue}
            onEdit={handleEditSchedule}
            onDelete={handleDeleteSchedule}
            onToggleStatus={(id) => toggleScheduleMutation.mutate(id)}
            isToggling={toggleScheduleMutation.isPending}
          />
        )}

        {/* Pagination Controls */}
        {schedules.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border-subtle bg-surface-subtle px-4 py-2.5 sm:flex-row">
            <div className="text-caption text-text-muted">
              Showing <span className="font-semibold text-text-primary tabular-nums">{schedules.length}</span> schedule(s) on page <span className="font-semibold text-text-primary tabular-nums">{page}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || isLoadingSchedules}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft20Regular aria-hidden />
                Previous
              </Button>
              <div className="grid h-8 min-w-8 place-items-center rounded-md border border-border-default bg-surface-default px-2.5 text-body-strong text-text-primary tabular-nums">
                {page}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoadingSchedules || schedules.length < pageSize}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight20Regular aria-hidden />
              </Button>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(parseInt(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[120px]" aria-label="Schedules per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-section-title text-text-primary">Edit Schedule</DialogTitle>
            <DialogDescription className="text-body text-text-muted">
              Update the session details for this recurring class.
            </DialogDescription>
          </DialogHeader>
          <ScheduleForm
            formData={formData}
            setFormData={setFormData}
            subjects={subjects}
            faculties={faculties}
            isLoading={updateScheduleMutation.isPending}
            onFacultyChange={setSelectedFaculty}
            onSemesterChange={setSelectedSemester}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateSchedule} disabled={updateScheduleMutation.isPending}>
              {updateScheduleMutation.isPending ? 'Updating...' : 'Update Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-status-error-subtle text-status-error">
                <Warning24Regular aria-hidden />
              </div>
              <div>
                <DialogTitle className="text-section-title text-text-primary">Delete Schedule</DialogTitle>
                <DialogDescription className="mt-1 text-body text-text-muted">
                  This action cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="py-2 text-body text-text-secondary">
            Are you sure you want to delete this schedule? This will permanently remove the schedule from the system and cannot be recovered.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setScheduleToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteScheduleMutation.isPending}
            >
              {deleteScheduleMutation.isPending ? 'Deleting...' : 'Delete Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Schedule Form Component
interface ScheduleFormProps {
  formData: ScheduleFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScheduleFormData>>;
  subjects: Subject[];
  faculties: Faculty[];
  isLoading: boolean;
  onFacultyChange: (facultyId: number | null) => void;
  onSemesterChange: (semester: number) => void;
}

const formLabelClass = 'flex items-center gap-1 text-body-strong text-text-primary';
const RequiredMark = () => <span className="text-status-error" aria-hidden>*</span>;

const FormSection: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children
}) => (
  <fieldset className="space-y-4 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
    <legend className="sr-only">{title}</legend>
    <div>
      <h3 className="text-subheading text-text-primary">{title}</h3>
      {description && <p className="text-caption text-text-muted">{description}</p>}
    </div>
    {children}
  </fieldset>
);

const ScheduleForm: React.FC<ScheduleFormProps> = ({
  formData,
  setFormData,
  subjects,
  faculties,
  isLoading,
  onFacultyChange,
  onSemesterChange
}) => {
  return (
    <div className="space-y-5 py-2">
      <FormSection title="Course" description="Choose the faculty, semester and subject for this session.">
        {/* Faculty and Semester */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="faculty" className={formLabelClass}>
              Faculty <RequiredMark />
            </Label>
            <Select
              value={formData.faculty_id?.toString() || ''}
              onValueChange={(value) => {
                const facultyId = value ? parseInt(value) : null;
                setFormData(prev => ({ ...prev, faculty_id: facultyId, subject_id: null }));
                onFacultyChange(facultyId);
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="faculty">
                <SelectValue placeholder="Select a faculty" />
              </SelectTrigger>
              <SelectContent>
                {faculties.map((faculty) => (
                  <SelectItem key={faculty.id} value={faculty.id.toString()}>
                    {faculty.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="semester" className={formLabelClass}>
              Semester <RequiredMark />
            </Label>
            <Select
              value={formData.semester.toString()}
              onValueChange={(value) => {
                const semester = parseInt(value);
                setFormData(prev => ({ ...prev, semester, subject_id: null }));
                onSemesterChange(semester);
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="semester">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {semesterOptions.map((sem) => (
                  <SelectItem key={sem.value} value={sem.value.toString()}>
                    {sem.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="subject" className={formLabelClass}>
            Subject <RequiredMark />
          </Label>
          <Select
            value={formData.subject_id?.toString() || ''}
            onValueChange={(value) => setFormData(prev => ({
              ...prev,
              subject_id: value ? parseInt(value) : null
            }))}
            disabled={isLoading || subjects.length === 0}
          >
            <SelectTrigger id="subject">
              <SelectValue placeholder={
                !formData.faculty_id || !formData.semester
                  ? "Select faculty and semester first"
                  : subjects.length === 0
                  ? "No subjects found for this selection"
                  : "Select a subject"
              } />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id.toString()}>
                  {subject.code} - {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormSection>

      <FormSection title="When" description="Sessions repeat every week on the selected day.">
        {/* Day and Time */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="day" className={formLabelClass}>
              Day <RequiredMark />
            </Label>
            <Select
              value={formData.day_of_week || ''}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                day_of_week: value as DayOfWeek
              }))}
              disabled={isLoading}
            >
              <SelectTrigger id="day">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start-time" className={formLabelClass}>
              Start Time <RequiredMark />
            </Label>
            <Input
              id="start-time"
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              disabled={isLoading}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="end-time" className={formLabelClass}>
              End Time <RequiredMark />
            </Label>
            <Input
              id="end-time"
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              disabled={isLoading}
              className="tabular-nums"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Details">
        {/* Academic Year and Classroom */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="academic-year" className={formLabelClass}>
              Academic Year <RequiredMark />
            </Label>
            <Input
              id="academic-year"
              type="number"
              value={formData.academic_year}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                academic_year: parseInt(e.target.value) || new Date().getFullYear()
              }))}
              min="2020"
              max="2030"
              disabled={isLoading}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="classroom" className={formLabelClass}>Classroom</Label>
            <Input
              id="classroom"
              value={formData.classroom}
              onChange={(e) => setFormData(prev => ({ ...prev, classroom: e.target.value }))}
              placeholder="e.g., Room 101, Lab A"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Instructor */}
        <div className="space-y-1.5">
          <Label htmlFor="instructor" className={formLabelClass}>Instructor Name</Label>
          <Input
            id="instructor"
            value={formData.instructor_name}
            onChange={(e) => setFormData(prev => ({ ...prev, instructor_name: e.target.value }))}
            placeholder="e.g., Dr. John Smith"
            disabled={isLoading}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className={formLabelClass}>Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes about this schedule..."
            rows={3}
            disabled={isLoading}
            className="resize-none"
          />
        </div>
      </FormSection>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Week / day calendar grid
// ---------------------------------------------------------------------------

interface ScheduleActionsProps {
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (id: number) => void;
  isToggling: boolean;
}

interface ScheduleCalendarProps extends ScheduleActionsProps {
  schedules: Schedule[];
  days: { value: string; label: string }[];
  todayValue: string;
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  schedules,
  days,
  todayValue,
  ...actions
}) => {
  const { startHour, endHour } = useMemo(() => {
    let min = 8 * 60;
    let max = 17 * 60;
    schedules.forEach((s) => {
      min = Math.min(min, toMinutes(s.start_time));
      max = Math.max(max, toMinutes(s.end_time));
    });
    return {
      startHour: Math.max(0, Math.floor(min / 60)),
      endHour: Math.min(24, Math.ceil(max / 60)),
    };
  }, [schedules]);

  const hours = Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const gridTemplateColumns = `56px repeat(${days.length}, minmax(0, 1fr))`;

  const eventsByDay = useMemo(() => {
    const map: Record<string, PositionedSchedule[]> = {};
    days.forEach((day) => {
      map[day.value] = layoutDay(
        schedules.filter((s) => (s.day_of_week || '').toLowerCase() === day.value)
      );
    });
    return map;
  }, [schedules, days]);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: days.length > 1 ? 56 + days.length * 128 : undefined }}>
        {/* Day header row */}
        <div className="grid border-b border-border-subtle" style={{ gridTemplateColumns }}>
          <div aria-hidden />
          {days.map((day) => {
            const isToday = day.value === todayValue;
            const count = eventsByDay[day.value]?.length ?? 0;
            return (
              <div key={day.value} className="relative border-l border-border-subtle px-3 py-2">
                <div className={cn('text-body-strong', isToday ? 'text-brand-foreground' : 'text-text-primary')}>
                  {day.label}
                </div>
                <div className="text-caption text-text-muted tabular-nums">
                  {isToday ? 'Today · ' : ''}
                  {count} {count === 1 ? 'class' : 'classes'}
                </div>
                {isToday && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" aria-hidden />}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns, height: gridHeight }}>
          {/* Time gutter */}
          <div className="relative" aria-hidden>
            {hours.map((hour, i) => (
              <span
                key={hour}
                className="absolute right-2 pt-1 text-caption text-text-muted tabular-nums"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {formatHourLabel(hour)}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.value}
              className={cn(
                'relative border-l border-border-subtle',
                day.value === todayValue && 'bg-brand-subtle/40'
              )}
            >
              {hours.map((hour, i) => (
                <React.Fragment key={hour}>
                  <div
                    className="absolute inset-x-0 border-t border-border-subtle"
                    style={{ top: i * HOUR_HEIGHT }}
                    aria-hidden
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-border-subtle/60"
                    style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    aria-hidden
                  />
                </React.Fragment>
              ))}

              {(eventsByDay[day.value] || []).map((item) => {
                const top = ((item.start - startHour * 60) / 60) * HOUR_HEIGHT;
                const height = Math.max(((item.end - item.start) / 60) * HOUR_HEIGHT, 24);
                return (
                  <CalendarEvent
                    key={item.schedule.id}
                    item={item}
                    style={{
                      top: top + 1,
                      height: height - 2,
                      left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / item.lanes}% - 4px)`,
                    }}
                    {...actions}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface CalendarEventProps extends ScheduleActionsProps {
  item: PositionedSchedule;
  style: React.CSSProperties;
}

const CalendarEvent: React.FC<CalendarEventProps> = ({ item, style, ...actions }) => {
  const schedule = item.schedule;
  const tone = toneFor(schedule.subject_id);
  const compact = item.end - item.start < 45;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={style}
          title={`${schedule.subject_name} · ${formatTimeLabel(schedule.start_time)} – ${formatTimeLabel(schedule.end_time)}`}
          className={cn(
            'absolute z-[1] overflow-hidden rounded border-l-4 px-2 py-1 text-left transition-colors duration-150 ease-fluent-standard focus-visible:z-[2]',
            tone.block,
            !schedule.is_active && 'opacity-60'
          )}
        >
          <p className="truncate text-caption-strong text-text-primary">
            {schedule.subject_name}
          </p>
          {!compact && (
            <p className="truncate text-caption text-text-secondary tabular-nums">
              {formatTimeLabel(schedule.start_time)} – {formatTimeLabel(schedule.end_time)}
            </p>
          )}
          {!compact && (schedule.classroom || !schedule.is_active) && (
            <p className="truncate text-caption text-text-muted">
              {!schedule.is_active ? 'Inactive' : schedule.classroom}
            </p>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 overflow-hidden p-0">
        <SchedulePeek schedule={schedule} {...actions} />
      </PopoverContent>
    </Popover>
  );
};

/** Outlook-style peek card shown when an event is clicked. */
const SchedulePeek: React.FC<ScheduleActionsProps & { schedule: Schedule }> = ({
  schedule,
  onEdit,
  onDelete,
  onToggleStatus,
  isToggling
}) => {
  const tone = toneFor(schedule.subject_id);
  return (
    <div>
      <div className="flex">
        <div className={cn('w-1 shrink-0', tone.bar)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-subheading text-text-primary">{schedule.subject_name}</p>
              <p className="font-mono text-caption text-text-muted">{schedule.subject_code}</p>
            </div>
            <Badge variant={schedule.is_active ? 'success' : 'secondary'} shape="pill" className="shrink-0">
              {schedule.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <ul className="space-y-2 text-body text-text-secondary">
            <li className="flex items-start gap-2">
              <Clock16Regular className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
              <span>
                <span className="capitalize">{schedule.day_of_week}</span>
                {', '}
                <span className="tabular-nums">
                  {formatTimeLabel(schedule.start_time)} – {formatTimeLabel(schedule.end_time)}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <BuildingMultiple20Regular className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <span>
                {schedule.faculty_name} · Semester {schedule.semester} · {schedule.academic_year}
              </span>
            </li>
            {schedule.classroom && (
              <li className="flex items-start gap-2">
                <Location16Regular className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
                <span>{schedule.classroom}</span>
              </li>
            )}
            {schedule.instructor_name && (
              <li className="flex items-start gap-2">
                <Person16Regular className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
                <span>{schedule.instructor_name}</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <Timer16Regular className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
              <span className="tabular-nums">Duration: {schedule.duration_minutes} minutes</span>
            </li>
            {schedule.notes && (
              <li className="flex items-start gap-2">
                <Note16Regular className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
                <span className="text-text-muted">{schedule.notes}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle bg-surface-subtle px-4 py-2">
        <label className="flex items-center gap-2 text-caption text-text-secondary">
          <Switch
            checked={schedule.is_active}
            onCheckedChange={() => onToggleStatus(schedule.id)}
            disabled={isToggling}
            aria-label={schedule.is_active ? 'Deactivate schedule' : 'Activate schedule'}
          />
          {schedule.is_active ? 'Active' : 'Inactive'}
        </label>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(schedule)}
            className="h-8 w-8 p-0 text-text-secondary"
            title="Edit schedule"
            aria-label="Edit schedule"
          >
            <Edit20Regular aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(schedule.id)}
            className="h-8 w-8 p-0 text-status-error hover:bg-status-error-subtle hover:text-status-error"
            title="Delete schedule"
            aria-label="Delete schedule"
          >
            <Delete20Regular aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Schedule Card Component (agenda list row)
interface ScheduleCardProps {
  schedule: Schedule;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (id: number) => void;
  isToggling: boolean;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onEdit,
  onDelete,
  onToggleStatus,
  isToggling
}) => {
  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  const tone = toneFor(schedule.subject_id);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover sm:flex-row sm:items-center',
        !schedule.is_active && 'bg-surface-subtle'
      )}
    >
      <div className="flex min-w-0 flex-1 items-stretch gap-3">
        <span className={cn('w-1 shrink-0 rounded-full', tone.bar, !schedule.is_active && 'opacity-50')} aria-hidden />

        {/* Day & time */}
        <div className="w-32 shrink-0">
          <p className={cn('text-body-strong capitalize', schedule.is_active ? 'text-text-primary' : 'text-text-muted')}>
            {schedule.day_of_week}
          </p>
          <p className="text-caption text-text-muted tabular-nums">
            {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
          </p>
        </div>

        {/* Subject & meta */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('truncate text-body-strong', schedule.is_active ? 'text-text-primary' : 'text-text-muted')}>
              {schedule.subject_name}
            </span>
            <Badge variant="outline" className="font-mono">
              {schedule.subject_code}
            </Badge>
            <Badge variant={schedule.is_active ? 'success' : 'secondary'} shape="pill">
              {schedule.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-caption text-text-muted">
            {schedule.faculty_name} · Semester {schedule.semester} · {schedule.academic_year}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
            {schedule.classroom && (
              <span className="inline-flex items-center gap-1">
                <Location16Regular className="text-text-muted" aria-hidden />
                {schedule.classroom}
              </span>
            )}
            {schedule.instructor_name && (
              <span className="inline-flex items-center gap-1">
                <Person16Regular className="text-text-muted" aria-hidden />
                {schedule.instructor_name}
              </span>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Timer16Regular className="text-text-muted" aria-hidden />
              Duration: {schedule.duration_minutes} minutes
            </span>
          </div>
          {schedule.notes && (
            <p className="flex items-start gap-1 text-caption text-text-muted">
              <Note16Regular className="mt-px shrink-0" aria-hidden />
              <span>{schedule.notes}</span>
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 pl-4 sm:pl-2">
        <label
          className="mr-1 flex items-center gap-2 text-caption text-text-secondary"
          title={schedule.is_active ? 'Deactivate schedule' : 'Activate schedule'}
        >
          <Switch
            checked={schedule.is_active}
            onCheckedChange={() => onToggleStatus(schedule.id)}
            disabled={isToggling}
            aria-label={schedule.is_active ? 'Deactivate schedule' : 'Activate schedule'}
          />
          <span className="w-6">{schedule.is_active ? 'On' : 'Off'}</span>
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(schedule)}
          className="h-8 w-8 p-0 text-text-secondary"
          title="Edit schedule"
          aria-label="Edit schedule"
        >
          <Edit20Regular aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(schedule.id)}
          className="h-8 w-8 p-0 text-text-secondary hover:bg-status-error-subtle hover:text-status-error"
          title="Delete schedule"
          aria-label="Delete schedule"
        >
          <Delete20Regular aria-hidden />
        </Button>
      </div>
    </div>
  );
};

export default ScheduleManagement;

// Skeleton Loading Component
const ScheduleCardSkeleton: React.FC = () => {
  return (
    <div className="flex animate-pulse items-center gap-3 px-4 py-3" aria-hidden>
      <div className="h-12 w-1 rounded-full bg-surface-pressed" />
      <div className="w-32 space-y-2">
        <div className="h-3.5 w-20 rounded bg-surface-pressed" />
        <div className="h-3 w-24 rounded bg-surface-subtle" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-48 rounded bg-surface-pressed" />
        <div className="h-3 w-64 rounded bg-surface-subtle" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-11 rounded-full bg-surface-subtle" />
        <div className="h-8 w-8 rounded bg-surface-subtle" />
        <div className="h-8 w-8 rounded bg-surface-subtle" />
      </div>
    </div>
  );
};
