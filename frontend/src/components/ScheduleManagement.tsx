import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Calendar, Clock, Users, MapPin, User, FileText, ToggleLeft, ToggleRight, Filter, Search, X, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
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
      <Alert className="m-4">
        <AlertDescription>
          Failed to load schedules. Please check your connection and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="w-full">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-700/50">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Schedule Management
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Organize and manage class schedules and timetables
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-white transition-all duration-200"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={resetForm}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-semibold text-white">Create New Schedule</DialogTitle>
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
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateSchedule}
                    disabled={createScheduleMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                  >
                    {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-400" />
                  Filter Schedules
                </CardTitle>
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
                  className="text-slate-400 hover:text-white hover:bg-slate-700/50 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-faculty" className="text-slate-300 text-sm font-medium">Faculty</Label>
                  <Select
                    value={filters.faculty_id}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, faculty_id: value }))}
                  >
                    <SelectTrigger 
                      id="filter-faculty" 
                      className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-800/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
                    >
                      <SelectValue placeholder="All Faculties" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all" className="text-white hover:bg-slate-800 focus:bg-slate-800">All Faculties</SelectItem>
                      {faculties.map((faculty) => (
                        <SelectItem key={faculty.id} value={faculty.id.toString()} className="text-white hover:bg-slate-800 focus:bg-slate-800">
                          {faculty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-semester" className="text-slate-300 text-sm font-medium">Semester</Label>
                  <Select
                    value={filters.semester}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, semester: value }))}
                  >
                    <SelectTrigger 
                      id="filter-semester" 
                      className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-800/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
                    >
                      <SelectValue placeholder="All Semesters" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all" className="text-white hover:bg-slate-800 focus:bg-slate-800">All Semesters</SelectItem>
                      {semesterOptions.map((sem) => (
                        <SelectItem key={sem.value} value={sem.value.toString()} className="text-white hover:bg-slate-800 focus:bg-slate-800">
                          {sem.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-day" className="text-slate-300 text-sm font-medium">Day of Week</Label>
                  <Select
                    value={filters.day_of_week}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, day_of_week: value }))}
                  >
                    <SelectTrigger 
                      id="filter-day" 
                      className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-800/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
                    >
                      <SelectValue placeholder="All Days" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all" className="text-white hover:bg-slate-800 focus:bg-slate-800">All Days</SelectItem>
                      {dayOptions.map((day) => (
                        <SelectItem key={day.value} value={day.value} className="text-white hover:bg-slate-800 focus:bg-slate-800">
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-status" className="text-slate-300 text-sm font-medium">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger 
                      id="filter-status" 
                      className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-800/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
                    >
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all" className="text-white hover:bg-slate-800 focus:bg-slate-800">All Statuses</SelectItem>
                      <SelectItem value="active" className="text-white hover:bg-slate-800 focus:bg-slate-800">Active Only</SelectItem>
                      <SelectItem value="inactive" className="text-white hover:bg-slate-800 focus:bg-slate-800">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-year" className="text-slate-300 text-sm font-medium">Academic Year</Label>
                  <Input
                    id="filter-year"
                    type="number"
                    value={filters.academic_year}
                    onChange={(e) => setFilters(prev => ({ ...prev, academic_year: e.target.value }))}
                    min="2020"
                    max="2030"
                    className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-800/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200 placeholder:text-slate-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedules List */}
        <div className="space-y-4">
          {isLoadingSchedules ? (
            // Skeleton loading animation
            <div className="grid gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <ScheduleCardSkeleton key={index} />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-slate-700/30 flex items-center justify-center mb-4">
                  <Calendar className="h-10 w-10 text-slate-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No schedules found</h3>
                <p className="text-slate-400 text-center max-w-md mb-6">
                  Create your first schedule or adjust the filters to see existing schedules.
                </p>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsCreateDialogOpen(true);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
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
          )}
        </div>

        {/* Pagination Controls */}
        {schedules.length > 0 && (
          <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 shadow-xl">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-400">
                  Showing <span className="font-semibold text-white">{schedules.length}</span> schedule(s) on page <span className="font-semibold text-white">{page}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1 || isLoadingSchedules}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Previous
                  </Button>
                  <div className="px-3 py-1 bg-slate-900/50 border border-slate-700 rounded-md text-sm font-medium text-white">
                    {page}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoadingSchedules || schedules.length < pageSize}
                    onClick={() => setPage((p) => p + 1)}
                    className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
                    <SelectTrigger className="w-[130px] bg-slate-900/50 border-slate-700 text-white hover:bg-slate-800/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="10" className="text-white hover:bg-slate-800">10 / page</SelectItem>
                      <SelectItem value="20" className="text-white hover:bg-slate-800">20 / page</SelectItem>
                      <SelectItem value="50" className="text-white hover:bg-slate-800">50 / page</SelectItem>
                      <SelectItem value="100" className="text-white hover:bg-slate-800">100 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-white">Edit Schedule</DialogTitle>
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
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateSchedule}
                disabled={updateScheduleMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                {updateScheduleMutation.isPending ? 'Updating...' : 'Update Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-md bg-slate-900 border-slate-700">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold text-white">Delete Schedule</DialogTitle>
                  <DialogDescription className="text-slate-400 text-sm mt-1">
                    This action cannot be undone
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-300 leading-relaxed">
                Are you sure you want to delete this schedule? This will permanently remove the schedule from the system and cannot be recovered.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setScheduleToDelete(null);
                }}
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmDelete}
                disabled={deleteScheduleMutation.isPending}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/20"
              >
                {deleteScheduleMutation.isPending ? 'Deleting...' : 'Delete Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>
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
    <div className="space-y-6 py-2">
      {/* Faculty and Semester */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="faculty" className="text-slate-300 text-sm font-medium flex items-center gap-1">
            Faculty <span className="text-red-400">*</span>
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
            <SelectTrigger 
              id="faculty" 
              className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
            >
              <SelectValue placeholder="Select a faculty" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {faculties.map((faculty) => (
                <SelectItem key={faculty.id} value={faculty.id.toString()} className="text-white hover:bg-slate-800 focus:bg-slate-800">
                  {faculty.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="semester" className="text-slate-300 text-sm font-medium flex items-center gap-1">
            Semester <span className="text-red-400">*</span>
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
            <SelectTrigger 
              id="semester" 
              className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {semesterOptions.map((sem) => (
                <SelectItem key={sem.value} value={sem.value.toString()} className="text-white hover:bg-slate-800 focus:bg-slate-800">
                  {sem.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject" className="text-slate-300 text-sm font-medium flex items-center gap-1">
          Subject <span className="text-red-400">*</span>
        </Label>
        <Select
          value={formData.subject_id?.toString() || ''}
          onValueChange={(value) => setFormData(prev => ({ 
            ...prev, 
            subject_id: value ? parseInt(value) : null 
          }))}
          disabled={isLoading || subjects.length === 0}
        >
          <SelectTrigger 
            id="subject" 
            className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
          >
            <SelectValue placeholder={
              !formData.faculty_id || !formData.semester 
                ? "Select faculty and semester first" 
                : subjects.length === 0 
                ? "No subjects found for this selection" 
                : "Select a subject"
            } />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id.toString()} className="text-white hover:bg-slate-800 focus:bg-slate-800">
                {subject.code} - {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day and Time */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="day" className="text-slate-300 text-sm font-medium flex items-center gap-1">
            Day <span className="text-red-400">*</span>
          </Label>
          <Select
            value={formData.day_of_week || ''}
            onValueChange={(value) => setFormData(prev => ({ 
              ...prev, 
              day_of_week: value as DayOfWeek 
            }))}
            disabled={isLoading}
          >
            <SelectTrigger 
              id="day" 
              className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
            >
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {dayOptions.map((day) => (
                <SelectItem key={day.value} value={day.value} className="text-white hover:bg-slate-800 focus:bg-slate-800">
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="start-time" className="text-slate-300 text-sm font-medium flex items-center gap-1">
            Start Time <span className="text-red-400">*</span>
          </Label>
          <Input
            id="start-time"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
            disabled={isLoading}
            className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end-time" className="text-slate-300 text-sm font-medium flex items-center gap-1">
            End Time <span className="text-red-400">*</span>
          </Label>
          <Input
            id="end-time"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
            disabled={isLoading}
            className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
          />
        </div>
      </div>

      {/* Academic Year and Classroom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="academic-year" className="text-slate-300 text-sm font-medium flex items-center gap-1">
            Academic Year <span className="text-red-400">*</span>
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
            className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="classroom" className="text-slate-300 text-sm font-medium">Classroom</Label>
          <Input
            id="classroom"
            value={formData.classroom}
            onChange={(e) => setFormData(prev => ({ ...prev, classroom: e.target.value }))}
            placeholder="e.g., Room 101, Lab A"
            disabled={isLoading}
            className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Instructor */}
      <div className="space-y-2">
        <Label htmlFor="instructor" className="text-slate-300 text-sm font-medium">Instructor Name</Label>
        <Input
          id="instructor"
          value={formData.instructor_name}
          onChange={(e) => setFormData(prev => ({ ...prev, instructor_name: e.target.value }))}
          placeholder="e.g., Dr. John Smith"
          disabled={isLoading}
          className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200 placeholder:text-slate-500"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-slate-300 text-sm font-medium">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes about this schedule..."
          rows={3}
          disabled={isLoading}
          className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700/50 hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 transition-all duration-200 placeholder:text-slate-500 resize-none"
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
    <Card className={`group relative overflow-hidden transition-all duration-300 border ${
      !schedule.is_active 
        ? 'bg-slate-800/30 backdrop-blur-sm border-slate-700/30 opacity-75 hover:opacity-90' 
        : 'bg-slate-800/40 backdrop-blur-sm border-slate-700/50 hover:border-slate-600/60 hover:shadow-2xl hover:shadow-blue-500/10'
    }`}>
      {/* Gradient accent on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:via-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-500"></div>
      
      <CardHeader className="pb-4 relative">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 space-y-3">
            {/* Title and Code */}
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className={`text-xl font-bold transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-400' : 'text-white'
              }`}>
                {schedule.subject_name}
              </CardTitle>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors duration-200 font-mono text-xs px-2.5 py-0.5">
                {schedule.subject_code}
              </Badge>
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                schedule.is_active 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10 shadow-sm' 
                  : 'bg-slate-600/20 text-slate-400 border border-slate-600/30'
              }`}>
                {schedule.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
            
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`font-medium transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
              }`}>
                {schedule.faculty_name}
              </span>
              <span className="text-slate-600">•</span>
              <span className={`transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Semester {schedule.semester}
              </span>
              <span className="text-slate-600">•</span>
              <span className={`transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {schedule.academic_year}
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 shrink-0">
            {/* Toggle Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleStatus(schedule.id)}
              disabled={isToggling}
              className={`group/toggle relative overflow-hidden transition-all duration-300 hover:scale-105 px-3 py-2 h-auto ${
                schedule.is_active 
                  ? 'hover:bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50' 
                  : 'hover:bg-slate-600/10 border border-slate-600/30 hover:border-slate-600/50'
              }`}
              title={schedule.is_active ? 'Deactivate schedule' : 'Activate schedule'}
            >
              <div className={`flex items-center gap-2 transition-all duration-300 ${
                isToggling ? 'animate-pulse' : ''
              }`}>
                <div className={`w-11 h-6 rounded-full relative transition-all duration-300 ${
                  schedule.is_active 
                    ? 'bg-emerald-500 shadow-emerald-500/30 shadow-sm' 
                    : 'bg-slate-600'
                }`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${
                    schedule.is_active 
                      ? 'translate-x-6' 
                      : 'translate-x-1'
                  }`}></div>
                </div>
                <span className={`text-xs font-bold uppercase tracking-wide transition-colors duration-300 ${
                  schedule.is_active ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {schedule.is_active ? 'ON' : 'OFF'}
                </span>
              </div>
            </Button>
            
            {/* Edit Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(schedule)}
              className="hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 border border-blue-500/0 hover:border-blue-500/30 transition-all duration-200 h-auto p-2"
              title="Edit schedule"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            
            {/* Delete Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(schedule.id)}
              className="hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-red-500/0 hover:border-red-500/30 transition-all duration-200 h-auto p-2"
              title="Delete schedule"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 relative">
        {/* Schedule Details Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 transition-colors duration-300 ${
          !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
        }`}>
          {/* Day */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/20 border border-slate-700/30 hover:bg-slate-700/30 hover:border-slate-600/40 transition-all duration-200">
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${
              !schedule.is_active ? 'bg-slate-700/30' : 'bg-blue-500/10'
            }`}>
              <Calendar className={`h-5 w-5 transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-blue-400'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Day</p>
              <p className="font-semibold capitalize truncate">{schedule.day_of_week}</p>
            </div>
          </div>
          
          {/* Time */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/20 border border-slate-700/30 hover:bg-slate-700/30 hover:border-slate-600/40 transition-all duration-200">
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${
              !schedule.is_active ? 'bg-slate-700/30' : 'bg-indigo-500/10'
            }`}>
              <Clock className={`h-5 w-5 transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-indigo-400'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Time</p>
              <p className="font-semibold text-sm truncate">{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</p>
            </div>
          </div>
          
          {/* Classroom */}
          {schedule.classroom && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/20 border border-slate-700/30 hover:bg-slate-700/30 hover:border-slate-600/40 transition-all duration-200">
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                !schedule.is_active ? 'bg-slate-700/30' : 'bg-purple-500/10'
              }`}>
                <MapPin className={`h-5 w-5 transition-colors duration-300 ${
                  !schedule.is_active ? 'text-slate-500' : 'text-purple-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Location</p>
                <p className="font-semibold truncate">{schedule.classroom}</p>
              </div>
            </div>
          )}
          
          {/* Instructor */}
          {schedule.instructor_name && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/20 border border-slate-700/30 hover:bg-slate-700/30 hover:border-slate-600/40 transition-all duration-200">
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                !schedule.is_active ? 'bg-slate-700/30' : 'bg-emerald-500/10'
              }`}>
                <User className={`h-5 w-5 transition-colors duration-300 ${
                  !schedule.is_active ? 'text-slate-500' : 'text-emerald-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Instructor</p>
                <p className="font-semibold truncate">{schedule.instructor_name}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Notes Section */}
        {schedule.notes && (
          <>
            <Separator className="my-4 bg-slate-700/50" />
            <div className={`flex items-start gap-3 p-3 rounded-lg bg-slate-700/10 border border-slate-700/20 transition-colors duration-300 ${
              !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
            }`}>
              <FileText className={`h-4 w-4 mt-0.5 flex-shrink-0 transition-colors duration-300 ${
                !schedule.is_active ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Notes</p>
                <p className={`text-sm leading-relaxed transition-colors duration-300 ${
                  !schedule.is_active ? 'text-slate-500' : 'text-slate-300'
                }`}>
                  {schedule.notes}
                </p>
              </div>
            </div>
          </>
        )}
        
        {/* Duration Badge */}
        <div className="mt-4 flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/30 border border-slate-700/40 text-xs font-medium text-slate-400">
            <Clock className="h-3 w-3" />
            Duration: {schedule.duration_minutes} minutes
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleManagement;

// Skeleton Loading Component
const ScheduleCardSkeleton: React.FC = () => {
  return (
    <Card className="animate-pulse bg-slate-800/40 backdrop-blur-sm border-slate-700/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-7 bg-slate-700/50 rounded-lg w-48"></div>
              <div className="h-6 bg-slate-700/50 rounded-full w-16"></div>
              <div className="h-6 bg-slate-700/50 rounded-full w-20"></div>
            </div>
            <div className="h-4 bg-slate-700/50 rounded w-64"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-20 bg-slate-700/50 rounded-lg"></div>
            <div className="h-10 w-10 bg-slate-700/50 rounded-lg"></div>
            <div className="h-10 w-10 bg-slate-700/50 rounded-lg"></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/20 border border-slate-700/30">
              <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-700/50 rounded w-12"></div>
                <div className="h-4 bg-slate-700/50 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <div className="h-7 bg-slate-700/50 rounded-full w-40"></div>
        </div>
      </CardContent>
    </Card>
  );
};