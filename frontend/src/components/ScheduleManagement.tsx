import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Calendar, Clock, Users, MapPin, User, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
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

const ScheduleManagement: React.FC = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(initialFormData);
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
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      deleteScheduleMutation.mutate(id);
    }
  }, [deleteScheduleMutation]);

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
      <Alert className="m-4">
        <AlertDescription>
          Failed to load schedules. Please check your connection and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Schedule Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage class schedules and timetables
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Schedule</DialogTitle>
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
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateSchedule}
                disabled={createScheduleMutation.isPending}
              >
                {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="filter-faculty" className="text-slate-200">Faculty</Label>
              <Select
                value={filters.faculty_id}
                onValueChange={(value) => setFilters(prev => ({ ...prev, faculty_id: value }))}
              >
                <SelectTrigger id="filter-faculty" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
                  <SelectValue placeholder="All Faculties" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700">All Faculties</SelectItem>
                  {faculties.map((faculty) => (
                    <SelectItem key={faculty.id} value={faculty.id.toString()} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                      {faculty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-semester" className="text-slate-200">Semester</Label>
              <Select
                value={filters.semester}
                onValueChange={(value) => setFilters(prev => ({ ...prev, semester: value }))}
              >
                <SelectTrigger id="filter-semester" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700">All Semesters</SelectItem>
                  {semesterOptions.map((sem) => (
                    <SelectItem key={sem.value} value={sem.value.toString()} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                      {sem.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-day" className="text-slate-200">Day of Week</Label>
              <Select
                value={filters.day_of_week}
                onValueChange={(value) => setFilters(prev => ({ ...prev, day_of_week: value }))}
              >
                <SelectTrigger id="filter-day" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700">All Days</SelectItem>
                  {dayOptions.map((day) => (
                    <SelectItem key={day.value} value={day.value} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-status" className="text-slate-200">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="filter-status" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700">All Statuses</SelectItem>
                  <SelectItem value="active" className="text-white hover:bg-slate-700 focus:bg-slate-700">Active Only</SelectItem>
                  <SelectItem value="inactive" className="text-white hover:bg-slate-700 focus:bg-slate-700">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-year" className="text-slate-200">Academic Year</Label>
              <Input
                id="filter-year"
                type="number"
                value={filters.academic_year}
                onChange={(e) => setFilters(prev => ({ ...prev, academic_year: e.target.value }))}
                min="2020"
                max="2030"
                className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500 placeholder:text-slate-400"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedules List */}
      <div className="grid gap-4">
        {isLoadingSchedules ? (
          // Skeleton loading animation
          Array.from({ length: pageSize }, (_, index) => (
            <ScheduleCardSkeleton key={index} />
          ))
        ) : schedules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No schedules found</h3>
              <p className="text-muted-foreground text-center">
                Create your first schedule or adjust the filters to see existing schedules.
              </p>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onEdit={handleEditSchedule}
              onDelete={handleDeleteSchedule}
              onToggleStatus={(id) => toggleScheduleMutation.mutate(id)}
              isToggling={toggleScheduleMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-slate-400">
          Showing {schedules.length} item(s) on page {page}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1 || isLoadingSchedules}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={isLoadingSchedules || schedules.length < pageSize}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(parseInt(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px] bg-slate-800 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="10" className="text-white">10 / page</SelectItem>
              <SelectItem value="20" className="text-white">20 / page</SelectItem>
              <SelectItem value="50" className="text-white">50 / page</SelectItem>
              <SelectItem value="100" className="text-white">100 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
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
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSchedule}
              disabled={updateScheduleMutation.isPending}
            >
              {updateScheduleMutation.isPending ? 'Updating...' : 'Update Schedule'}
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
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="faculty" className="text-slate-200">Faculty *</Label>
          <Select
            value={formData.faculty_id?.toString() || ''}
            onValueChange={(value) => {
              const facultyId = value ? parseInt(value) : null;
              setFormData(prev => ({ ...prev, faculty_id: facultyId, subject_id: null }));
              onFacultyChange(facultyId);
            }}
            disabled={isLoading}
          >
            <SelectTrigger id="faculty" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
              <SelectValue placeholder="Select a faculty" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {faculties.map((faculty) => (
                <SelectItem key={faculty.id} value={faculty.id.toString()} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                  {faculty.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="semester" className="text-slate-200">Semester *</Label>
          <Select
            value={formData.semester.toString()}
            onValueChange={(value) => {
              const semester = parseInt(value);
              setFormData(prev => ({ ...prev, semester, subject_id: null }));
              onSemesterChange(semester);
            }}
            disabled={isLoading}
          >
            <SelectTrigger id="semester" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {semesterOptions.map((sem) => (
                <SelectItem key={sem.value} value={sem.value.toString()} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                  {sem.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="subject" className="text-slate-200">Subject *</Label>
        <Select
          value={formData.subject_id?.toString() || ''}
          onValueChange={(value) => setFormData(prev => ({ 
            ...prev, 
            subject_id: value ? parseInt(value) : null 
          }))}
          disabled={isLoading || subjects.length === 0}
        >
          <SelectTrigger id="subject" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
            <SelectValue placeholder={
              !formData.faculty_id || !formData.semester 
                ? "Select faculty and semester first" 
                : subjects.length === 0 
                ? "No subjects found for this selection" 
                : "Select a subject"
            } />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id.toString()} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                {subject.code} - {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="day" className="text-slate-200">Day of Week *</Label>
          <Select
            value={formData.day_of_week || ''}
            onValueChange={(value) => setFormData(prev => ({ 
              ...prev, 
              day_of_week: value as DayOfWeek 
            }))}
            disabled={isLoading}
          >
            <SelectTrigger id="day" className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {dayOptions.map((day) => (
                <SelectItem key={day.value} value={day.value} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="start-time" className="text-slate-200">Start Time *</Label>
          <Input
            id="start-time"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
            disabled={isLoading}
            className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500"
          />
        </div>

        <div>
          <Label htmlFor="end-time" className="text-slate-200">End Time *</Label>
          <Input
            id="end-time"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
            disabled={isLoading}
            className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="academic-year" className="text-slate-200">Academic Year *</Label>
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
            className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500"
          />
        </div>
        <div>
          <Label htmlFor="classroom" className="text-slate-200">Classroom</Label>
          <Input
            id="classroom"
            value={formData.classroom}
            onChange={(e) => setFormData(prev => ({ ...prev, classroom: e.target.value }))}
            placeholder="e.g., Room 101, Lab A"
            disabled={isLoading}
            className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="instructor" className="text-slate-200">Instructor Name</Label>
        <Input
          id="instructor"
          value={formData.instructor_name}
          onChange={(e) => setFormData(prev => ({ ...prev, instructor_name: e.target.value }))}
          placeholder="e.g., Dr. John Smith"
          disabled={isLoading}
          className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500 placeholder:text-slate-400"
        />
      </div>

      <div>
        <Label htmlFor="notes" className="text-slate-200">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes about this schedule..."
          rows={3}
          disabled={isLoading}
          className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500 placeholder:text-slate-400"
        />
      </div>
    </div>
  );
};

// Schedule Card Component
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

  return (
    <Card className={`transition-all duration-300 hover:shadow-lg border ${
      !schedule.is_active 
        ? 'bg-slate-800/50 border-slate-700 shadow-sm' 
        : 'bg-slate-800 border-slate-600 shadow-md hover:border-slate-500'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className={`text-lg transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-400' : 'text-white'
              }`}>
                {schedule.subject_name}
              </CardTitle>
              <Badge variant="secondary" className="bg-slate-700 text-slate-300 border-slate-600">
                {schedule.subject_code}
              </Badge>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                schedule.is_active 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {schedule.is_active ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>
            <p className={`text-sm transition-colors duration-300 ${
              !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
            }`}>
              {schedule.faculty_name} • Semester {schedule.semester} • {schedule.academic_year}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleStatus(schedule.id)}
              disabled={isToggling}
              className={`relative overflow-hidden transition-all duration-300 hover:scale-105 px-3 py-2 ${
                schedule.is_active 
                  ? 'hover:bg-green-500/10 border border-green-500/30' 
                  : 'hover:bg-red-500/10 border border-red-500/30'
              }`}
            >
              <div className={`flex items-center gap-2 transition-all duration-300 ${
                isToggling ? 'animate-pulse' : ''
              }`}>
                <div className={`w-10 h-5 rounded-full relative transition-all duration-300 border ${
                  schedule.is_active 
                    ? 'bg-green-500 border-green-400' 
                    : 'bg-slate-600 border-slate-500'
                }`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300 ${
                    schedule.is_active 
                      ? 'translate-x-5' 
                      : 'translate-x-0.5'
                  }`}></div>
                </div>
                <span className={`text-xs font-bold transition-colors duration-300 ${
                  schedule.is_active ? 'text-green-400' : 'text-slate-400'
                }`}>
                  {schedule.is_active ? 'ON' : 'OFF'}
                </span>
              </div>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(schedule)}
              className="hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(schedule.id)}
              className="hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-red-500/30 hover:border-red-500/50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 text-sm transition-colors duration-300 ${
          !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
        }`}>
          <div className="flex items-center gap-2">
            <Calendar className={`h-4 w-4 transition-colors duration-300 ${
              !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
            }`} />
            <span className="capitalize">{schedule.day_of_week}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 transition-colors duration-300 ${
              !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
            }`} />
            <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
          </div>
          {schedule.classroom && (
            <div className="flex items-center gap-2">
              <MapPin className={`h-4 w-4 transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span>{schedule.classroom}</span>
            </div>
          )}
          {schedule.instructor_name && (
            <div className="flex items-center gap-2">
              <User className={`h-4 w-4 transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span>{schedule.instructor_name}</span>
            </div>
          )}
        </div>
        {schedule.notes && (
          <>
            <Separator className="my-3 bg-slate-700" />
            <div className={`flex items-start gap-2 text-sm transition-colors duration-300 ${
              !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
            }`}>
              <FileText className={`h-4 w-4 mt-0.5 transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <span className={`transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
              }`}>{schedule.notes}</span>
            </div>
          </>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          Duration: {schedule.duration_minutes} minutes
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleManagement;

// Skeleton Loading Component
const ScheduleCardSkeleton: React.FC = () => {
  return (
    <Card className="animate-pulse bg-slate-800 border-slate-600">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-6 bg-slate-700 rounded w-48"></div>
              <div className="h-5 bg-slate-700 rounded w-16"></div>
              <div className="h-5 bg-slate-700 rounded w-20"></div>
            </div>
            <div className="h-4 bg-slate-700 rounded w-64"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-slate-700 rounded"></div>
            <div className="h-8 w-8 bg-slate-700 rounded"></div>
            <div className="h-8 w-8 bg-slate-700 rounded"></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded w-16"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded w-24"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded w-20"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded w-28"></div>
          </div>
        </div>
        <div className="h-3 bg-slate-700 rounded w-32"></div>
      </CardContent>
    </Card>
  );
};