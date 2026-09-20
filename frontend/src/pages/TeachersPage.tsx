import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Close,
  UserMultiple,
  Add,
  Edit,
  TrashCan,
  Education,
  Settings,
  Calendar,
  Copy,
} from '@carbon/icons-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Teacher {
  id: number;
  teacher_id: string;
  name: string;
  user: {
    id: number;
    email: string;
    full_name: string;
    role: string;
  };
  faculty_id?: number;
  department?: string;
  phone_number?: string;
  office_location?: string;
  created_at: string;
}

interface Faculty {
  id: number;
  name: string;
  code: string;
  description?: string;
}

interface TeacherFormData {
  full_name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  teacher_id?: string;
  faculty_id?: number;
  department?: string;
  phone_number?: string;
  office_location?: string;
}

interface TeacherAssignment {
  id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  faculty_id: number;
  faculty_name: string;
  semester: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  classroom?: string;
  academic_year: number;
  student_count?: number;
  time_slot_display: string;
}

interface SubjectItem {
  id: number;
  name: string;
  code: string;
  credits?: number;
  description?: string;
  faculty_id?: number;
  semester?: number;
}

interface ScheduleItem {
  id: number;
  subject_id: number;
  teacher_id?: number | null;
  day_of_week?: string;
  time_slot_display?: string;
  classroom?: string;
  is_active?: boolean;
}

interface GroupedAssignment {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  faculty_name: string;
  semester: number;
  schedules: TeacherAssignment[];
}

interface GroupedUnassignedSubject {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  faculty_name: string;
  semester: number;
  scheduleCount: number;
  schedules: TeacherAssignment[];
}

const TeachersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [isAddAssignmentDialogOpen, setIsAddAssignmentDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState<string>('');
  const [filterFacultyId, setFilterFacultyId] = useState<string>('all');
  const [filterSemester, setFilterSemester] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');

  // Add/Edit form subject assignment filters
  const [formFilterFacultyId, setFormFilterFacultyId] = useState<string>('all');
  const [formFilterSemester, setFormFilterSemester] = useState<string>('all');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [formData, setFormData] = useState<TeacherFormData>({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    teacher_id: undefined,
    faculty_id: undefined,
    department: '',
    phone_number: '',
    office_location: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch teachers
  const { data: teachers = [], isLoading } = useQuery<Teacher[]>({
    queryKey: ['teachers', selectedFaculty],
    queryFn: async () => {
      const facultyId = selectedFaculty !== 'all' ? parseInt(selectedFaculty, 10) : undefined;
      const res = await api.teachers.getAll(facultyId);
      return (res as unknown as Teacher[]) || [];
    },
  });

  // Fetch faculties for dropdown
  const { data: faculties = [] } = useQuery<Faculty[]>({
    queryKey: ['faculties'],
    queryFn: async () => {
      const res = await api.faculties.getAll();
      return (res as unknown as Faculty[]) || [];
    },
  });

  // Subjects list for filters in Add Assignment (depends on faculty and optional semester)
  const { data: filterSubjects = [] } = useQuery<SubjectItem[]>({
    queryKey: ['subjects-by-faculty-semester', filterFacultyId, filterSemester],
    queryFn: async () => {
      if (filterFacultyId === 'all') return [];
      const fid = parseInt(filterFacultyId, 10);
      const sem = filterSemester !== 'all' ? parseInt(filterSemester, 10) : undefined;
      const res = await api.subjects.getByFacultySemester(fid, sem);
      return (res as unknown as SubjectItem[]) || [];
    },
    enabled: isAddAssignmentDialogOpen && filterFacultyId !== 'all',
  });

  // Subjects for form assignment (Add/Edit dialogs) - grouped by unique subject
  const { data: formSubjects = [] } = useQuery<SubjectItem[]>({
    queryKey: ['form-subjects', formFilterFacultyId, formFilterSemester],
    queryFn: async () => {
      if (formFilterFacultyId === 'all') return [];
      const fid = parseInt(formFilterFacultyId, 10);
      const sem = formFilterSemester !== 'all' ? parseInt(formFilterSemester, 10) : undefined;
      const res = await api.subjects.getByFacultySemester(fid, sem);
      return (res as unknown as SubjectItem[]) || [];
    },
    enabled: (isAddDialogOpen || isEditDialogOpen) && formFilterFacultyId !== 'all',
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch assignments for selected teacher
  const { data: assignments = [], refetch: refetchAssignments } = useQuery<TeacherAssignment[]>({
    queryKey: ['teacher-assignments', selectedTeacher?.id],
    queryFn: async () => {
      if (!selectedTeacher) return [];
      const res = await api.teachers.getAssignments(selectedTeacher.id);
      return (res as unknown as TeacherAssignment[]) || [];
    },
    enabled: !!selectedTeacher && isManageDialogOpen,
  });

  // Fetch unassigned schedules
  const { data: unassignedSchedules = [] } = useQuery<TeacherAssignment[]>({
    queryKey: ['unassigned-schedules', filterFacultyId, filterSemester],
    queryFn: async () => {
      const res = await api.teachers.getUnassignedSchedules(
        filterFacultyId !== 'all' ? parseInt(filterFacultyId, 10) : undefined,
        filterSemester !== 'all' ? parseInt(filterSemester, 10) : undefined
      );
      return (res as unknown as TeacherAssignment[]) || [];
    },
    enabled: isAddAssignmentDialogOpen,
  });

  // Create teacher mutation
  const createTeacherMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      if (!data.password) {
        throw new Error('Password is required');
      }
      if (data.password !== data.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      const created = await api.teachers.create({
        user: {
          email: data.email,
          full_name: data.full_name,
          password: data.password,
        },
        name: data.full_name,
        faculty_id: data.faculty_id,
        phone_number: data.phone_number,
        office_location: data.office_location,
      });
      return created as unknown as Teacher;
    },
    onSuccess: async (newTeacher) => {
      if (selectedSubjectIds.length > 0) {
        try {
          const allSchedules = (await api.schedules.getAll({ is_active: true })) as unknown as ScheduleItem[];
          const schedulesToAssign = allSchedules.filter((s) =>
            selectedSubjectIds.includes(s.subject_id) && !s.teacher_id
          );

          await Promise.all(
            schedulesToAssign.map((schedule) =>
              api.teachers.addAssignment(newTeacher.id, schedule.id)
            )
          );
        } catch (err) {
          console.error('Failed to assign some subjects:', err);
        }
      }

      toast({
        title: 'Success',
        description: 'Teacher created successfully',
      });
      setIsAddDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast({
        title: 'Error',
        description: err.message || 'Failed to create teacher',
        variant: 'destructive',
      });
    },
  });

  // Update teacher mutation
  const updateTeacherMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TeacherFormData }) => {
      return await api.teachers.update(id, {
        name: data.full_name,
        faculty_id: data.faculty_id,
        phone_number: data.phone_number,
        office_location: data.office_location,
      });
    },
    onSuccess: async () => {
      if (selectedTeacher) {
        try {
          const currentAssignments = (await api.teachers.getAssignments(selectedTeacher.id)) as unknown as TeacherAssignment[];
          const currentSubjectIds = [...new Set(currentAssignments.map((a) => a.subject_id))];

          const subjectsToRemove = currentSubjectIds.filter((sid) => !selectedSubjectIds.includes(sid));
          const schedulesToRemove = currentAssignments.filter((a) => subjectsToRemove.includes(a.subject_id));
          await Promise.all(
            schedulesToRemove.map((a) =>
              api.teachers.removeAssignment(selectedTeacher.id, a.id)
            )
          );

          const subjectsToAdd = selectedSubjectIds.filter((sid) => !currentSubjectIds.includes(sid));
          if (subjectsToAdd.length > 0) {
            const allSchedules = (await api.schedules.getAll({ is_active: true })) as unknown as ScheduleItem[];
            const schedulesToAdd = allSchedules.filter((s) =>
              subjectsToAdd.includes(s.subject_id) && !s.teacher_id
            );
            await Promise.all(
              schedulesToAdd.map((schedule) =>
                api.teachers.addAssignment(selectedTeacher.id, schedule.id)
              )
            );
          }
        } catch (err) {
          console.error('Failed to sync assignments:', err);
        }
      }

      toast({
        title: 'Success',
        description: 'Teacher updated successfully',
      });
      setIsEditDialogOpen(false);
      setSelectedTeacher(null);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast({
        title: 'Error',
        description: err.message || 'Failed to update teacher',
        variant: 'destructive',
      });
    },
  });

  // Delete teacher mutation
  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: number) => {
      return await api.teachers.delete(id);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Teacher deleted successfully',
      });
      setIsDeleteDialogOpen(false);
      setSelectedTeacher(null);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete teacher',
        variant: 'destructive',
      });
    },
  });

  // Add assignment mutation
  const addAssignmentMutation = useMutation({
    mutationFn: async ({ teacherId, scheduleId }: { teacherId: number; scheduleId: number }) => {
      return await api.teachers.addAssignment(teacherId, scheduleId);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Subject assigned to teacher successfully',
      });
      setIsAddAssignmentDialogOpen(false);
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['unassigned-schedules'] });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast({
        title: 'Error',
        description: err.message || 'Failed to assign subject',
        variant: 'destructive',
      });
    },
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ teacherId, scheduleId }: { teacherId: number; scheduleId: number }) => {
      return await api.teachers.removeAssignment(teacherId, scheduleId);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Subject assignment removed successfully',
      });
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['unassigned-schedules'] });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast({
        title: 'Error',
        description: err.message || 'Failed to remove assignment',
        variant: 'destructive',
      });
    },
  });

  // Filter teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher: Teacher) => {
      const query = searchQuery.toLowerCase();
      return (
        teacher.name?.toLowerCase().includes(query) ||
        teacher.teacher_id?.toLowerCase().includes(query) ||
        teacher.user?.email?.toLowerCase().includes(query) ||
        teacher.department?.toLowerCase().includes(query)
      );
    });
  }, [teachers, searchQuery]);

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      teacher_id: undefined,
      faculty_id: undefined,
      department: '',
      phone_number: '',
      office_location: '',
    });
    setFormFilterFacultyId('all');
    setFormFilterSemester('all');
    setSelectedSubjectIds([]);
  };

  const handleAddTeacher = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleEditTeacher = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      full_name: teacher.name,
      email: teacher.user.email,
      teacher_id: teacher.teacher_id,
      faculty_id: teacher.faculty_id,
      department: teacher.department || '',
      phone_number: teacher.phone_number || '',
      office_location: teacher.office_location || '',
    });
    setFormFilterFacultyId('all');
    setFormFilterSemester('all');

    try {
      const currentAssignments = (await api.teachers.getAssignments(teacher.id)) as unknown as TeacherAssignment[];
      const uniqueSubjectIds = [...new Set(currentAssignments.map((a) => a.subject_id))];
      setSelectedSubjectIds(uniqueSubjectIds);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
      setSelectedSubjectIds([]);
    }

    setIsEditDialogOpen(true);
  };

  const handleManageAssignments = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setAssignmentSearchQuery('');
    setIsManageDialogOpen(true);
  };

  const handleAddAssignment = () => {
    setIsAddAssignmentDialogOpen(true);
  };

  const handleAssignToSchedule = (scheduleId: number) => {
    if (selectedTeacher) {
      addAssignmentMutation.mutate({
        teacherId: selectedTeacher.id,
        scheduleId,
      });
    }
  };

  const handleRemoveAssignment = (scheduleId: number) => {
    if (selectedTeacher) {
      removeAssignmentMutation.mutate({
        teacherId: selectedTeacher.id,
        scheduleId,
      });
    }
  };

  const handleDeleteTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmitCreate = () => {
    createTeacherMutation.mutate(formData);
  };

  const handleSubmitEdit = () => {
    if (selectedTeacher) {
      updateTeacherMutation.mutate({
        id: selectedTeacher.id,
        data: formData,
      });
    }
  };

  const handleSubmitDelete = () => {
    if (selectedTeacher) {
      deleteTeacherMutation.mutate(selectedTeacher.id);
    }
  };

  // Group unassigned schedules by subject and filter
  const groupedUnassignedSubjects = useMemo(() => {
    if (!Array.isArray(unassignedSchedules)) return [] as GroupedUnassignedSubject[];

    const filtered = unassignedSchedules.filter((schedule: TeacherAssignment) => {
      if (filterSubjectId !== 'all' && schedule.subject_id !== parseInt(filterSubjectId, 10)) {
        return false;
      }
      const query = assignmentSearchQuery.toLowerCase();
      return (
        schedule.subject_name?.toLowerCase().includes(query) ||
        schedule.subject_code?.toLowerCase().includes(query) ||
        schedule.faculty_name?.toLowerCase().includes(query)
      );
    });

    const map = new Map<number, GroupedUnassignedSubject>();
    filtered.forEach((schedule) => {
      const existing = map.get(schedule.subject_id);
      if (!existing) {
        map.set(schedule.subject_id, {
          subject_id: schedule.subject_id,
          subject_name: schedule.subject_name,
          subject_code: schedule.subject_code,
          faculty_name: schedule.faculty_name,
          semester: schedule.semester,
          scheduleCount: 1,
          schedules: [schedule],
        });
      } else {
        existing.scheduleCount++;
        existing.schedules.push(schedule);
      }
    });

    return Array.from(map.values());
  }, [unassignedSchedules, assignmentSearchQuery, filterSubjectId]);

  const getFacultyName = (facultyId?: number) => {
    const faculty = faculties.find((f) => f.id === facultyId);
    return faculty?.name || 'N/A';
  };

  // Group current assignments by subject for a cleaner Manage view
  const groupedAssignments = useMemo(() => {
    if (!Array.isArray(assignments)) return [] as GroupedAssignment[];

    const map = new Map<number, GroupedAssignment>();
    assignments.forEach((a) => {
      const existing = map.get(a.subject_id);
      if (!existing) {
        map.set(a.subject_id, {
          subject_id: a.subject_id,
          subject_name: a.subject_name,
          subject_code: a.subject_code,
          faculty_name: a.faculty_name,
          semester: a.semester,
          schedules: [a],
        });
      } else {
        existing.schedules.push(a);
      }
    });

    return Array.from(map.values());
  }, [assignments]);

  // Track which subjects are expanded to show their sessions
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<number[]>([]);
  const toggleSubjectExpand = (subjectId: number) => {
    setExpandedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  // Remove all sessions for a subject
  const handleRemoveAllForSubject = async (subjectId: number) => {
    if (!selectedTeacher) return;
    const toRemove = assignments.filter((a) => a.subject_id === subjectId);
    if (toRemove.length === 0) return;

    let success = 0;
    let failed = 0;
    for (const a of toRemove) {
      try {
        await api.teachers.removeAssignment(selectedTeacher.id, a.id);
        success++;
      } catch (err) {
        console.error('Failed to remove assignment', a.id, err);
        failed++;
      }
    }

    await refetchAssignments();
    queryClient.invalidateQueries({ queryKey: ['unassigned-schedules'] });

    toast({
      title: failed > 0 ? 'Partial removal' : 'Removed',
      description: failed > 0
        ? `Removed ${success} session(s). ${failed} failed.`
        : `Removed ${success} session(s).`,
      variant: failed > 0 ? 'destructive' : undefined,
    });
  };

  // Assign any missing sessions for a subject
  const [assignAllLoadingSubjectId, setAssignAllLoadingSubjectId] = useState<number | null>(null);
  const handleAssignAllForSubject = async (subjectId: number) => {
    if (!selectedTeacher) return;
    try {
      setAssignAllLoadingSubjectId(subjectId);
      const allSchedules = (await api.schedules.getAll({ is_active: true })) as unknown as ScheduleItem[];
      const allSubjectSchedules = allSchedules.filter((s) => s.subject_id === subjectId);
      const toAssign = allSubjectSchedules.filter((s) => !s.teacher_id);
      const conflicts = allSubjectSchedules.filter((s) => s.teacher_id && s.teacher_id !== selectedTeacher.id).length;
      const alreadyMine = allSubjectSchedules.filter((s) => s.teacher_id === selectedTeacher.id).length;

      if (toAssign.length === 0) {
        const msg = conflicts > 0
          ? `No new sessions assigned. ${conflicts} session(s) belong to another teacher, ${alreadyMine} already assigned to this teacher.`
          : 'All sessions for this subject are already assigned to this teacher.';
        toast({ title: 'No action needed', description: msg });
        return;
      }

      for (const s of toAssign) {
        await api.teachers.addAssignment(selectedTeacher.id, s.id);
      }

      const desc = conflicts > 0
        ? `Assigned ${toAssign.length} session(s) to ${selectedTeacher.name}. ${conflicts} conflicted session(s) were skipped.`
        : `Assigned ${toAssign.length} session(s) to ${selectedTeacher.name}.`;
      toast({ title: 'Assigned', description: desc });
      await refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['unassigned-schedules'] });
    } catch (err) {
      console.error('Assign all failed', err);
      toast({ title: 'Error', description: 'Failed to assign all sessions', variant: 'destructive' });
    } finally {
      setAssignAllLoadingSubjectId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Teachers Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage faculty teacher accounts, course assignments, and classroom schedule links
          </p>
        </div>
        <Button onClick={handleAddTeacher} className="flex items-center gap-2">
          <Add size={16} />
          <span>Add Teacher</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Total Teachers</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{teachers.length}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                <UserMultiple size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Faculties</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{faculties.length}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-status-success">
                <Education size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Filter Results</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{filteredTeachers.length}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-status-warning">
                <Search size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-default border border-border-default rounded-md p-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <Input
              placeholder="Search by name, teacher ID, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded"
                aria-label="Clear search"
              >
                <Close size={14} />
              </button>
            )}
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
              <SelectTrigger className="h-9 text-sm">
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
        </div>
      </div>

      {/* Teachers Table View */}
      <div className="bg-surface-default border border-border-default rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Faculty Roster</h2>
            <p className="text-xs text-text-muted">
              Showing {filteredTeachers.length} of {teachers.length} teacher{teachers.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <LoadingState rows={6} columns={7} />
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={searchQuery || selectedFaculty !== 'all' ? 'No teachers found' : 'No teachers registered yet'}
              description={
                searchQuery || selectedFaculty !== 'all'
                  ? 'Try clearing or changing your filters to see more results.'
                  : 'Get started by creating your first teacher profile.'
              }
              isFiltered={Boolean(searchQuery || selectedFaculty !== 'all')}
              actionLabel={searchQuery || selectedFaculty !== 'all' ? 'Reset Filters' : 'Add Teacher'}
              onAction={
                searchQuery || selectedFaculty !== 'all'
                  ? () => {
                      setSearchQuery('');
                      setSelectedFaculty('all');
                    }
                  : handleAddTeacher
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border-default bg-surface-subtle">
                  <TableHead className="w-[140px] text-xs font-semibold text-text-muted uppercase">Teacher ID</TableHead>
                  <TableHead className="text-xs font-semibold text-text-muted uppercase">Full Name</TableHead>
                  <TableHead className="text-xs font-semibold text-text-muted uppercase">Email Address</TableHead>
                  <TableHead className="text-xs font-semibold text-text-muted uppercase">Faculty</TableHead>
                  <TableHead className="text-xs font-semibold text-text-muted uppercase">Department</TableHead>
                  <TableHead className="text-xs font-semibold text-text-muted uppercase">Phone</TableHead>
                  <TableHead className="w-[140px] text-right text-xs font-semibold text-text-muted uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher: Teacher) => (
                  <TableRow key={teacher.id} className="h-11 border-b border-border-subtle hover:bg-surface-subtle/50">
                    <TableCell className="font-mono text-xs font-medium text-text-secondary">
                      <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                        {teacher.teacher_id}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-text-primary text-sm">
                      {teacher.name}
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {teacher.user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {getFacultyName(teacher.faculty_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-text-muted">
                      {teacher.department || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-text-muted font-mono">
                      {teacher.phone_number || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleManageAssignments(teacher)}
                          className="h-8 w-8 p-0 text-text-muted hover:text-action-primary"
                          title="Manage Subject Assignments"
                        >
                          <Settings size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditTeacher(teacher)}
                          className="h-8 w-8 p-0 text-text-muted hover:text-text-primary"
                          title="Edit Personal Information"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTeacher(teacher)}
                          className="h-8 w-8 p-0 text-text-muted hover:text-status-danger"
                          title="Delete Teacher"
                        >
                          <TrashCan size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Teacher Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open && !createTeacherMutation.isPending) {
            setIsAddDialogOpen(false);
          } else if (open) {
            setIsAddDialogOpen(true);
          }
        }}
      >
        <DialogContent
          className="max-w-2xl"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add New Teacher</DialogTitle>
            <DialogDescription>
              Create an authenticated teacher profile with credentials and optional subject assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Dr. Sarah Jenkins"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teacher ID</Label>
              <div className="h-9 px-3 flex items-center rounded-md border border-dashed border-border-default bg-surface-subtle text-xs text-text-muted">
                Generated automatically by server
              </div>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sarah.jenkins@university.edu"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Initial Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Faculty Department</Label>
              <Select
                value={formData.faculty_id ? formData.faculty_id.toString() : ''}
                onValueChange={(v) => setFormData({ ...formData, faculty_id: v ? parseInt(v, 10) : undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone_number">Phone Number (Optional)</Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+1-555-0100"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="office_location">Office Location (Optional)</Label>
              <Input
                id="office_location"
                value={formData.office_location}
                onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                placeholder="Building B, Room 304"
              />
            </div>

            {/* Subject Assignment Section */}
            <div className="col-span-2 pt-3 border-t border-border-default space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Assign Subjects (Optional)</h3>
                <p className="text-xs text-text-muted">Link teaching responsibilities immediately on account creation.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Filter by Faculty</Label>
                  <Select value={formFilterFacultyId} onValueChange={(v) => { setFormFilterFacultyId(v); setFormFilterSemester('all'); }}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Select faculty</SelectItem>
                      {faculties.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Filter by Semester</Label>
                  <Select value={formFilterSemester} onValueChange={setFormFilterSemester} disabled={formFilterFacultyId === 'all'}>
                    <SelectTrigger className="mt-1 h-8 text-xs disabled:opacity-50">
                      <SelectValue placeholder="All semesters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Semesters</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <SelectItem key={s} value={s.toString()}>Semester {s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formFilterFacultyId !== 'all' && (
                <div className="max-h-[160px] overflow-y-auto rounded-md border border-border-default bg-surface-subtle/30 p-2 space-y-1">
                  {formSubjects.length === 0 ? (
                    <p className="text-text-muted text-xs text-center py-4">No subjects found for selection</p>
                  ) : (
                    formSubjects.map((subject) => (
                      <label key={subject.id} className="flex items-start gap-2.5 p-2 hover:bg-surface-subtle rounded cursor-pointer border border-transparent hover:border-border-subtle">
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.includes(subject.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjectIds([...selectedSubjectIds, subject.id]);
                            } else {
                              setSelectedSubjectIds(selectedSubjectIds.filter((id) => id !== subject.id));
                            }
                          }}
                          className="mt-0.5 rounded border-border-default text-action-primary focus:ring-action-primary"
                        />
                        <div className="flex-1 text-xs">
                          <div className="text-text-primary font-medium">{subject.name} <span className="text-text-muted font-mono">({subject.code})</span></div>
                          <div className="text-text-muted mt-0.5">
                            {subject.credits} credits • {subject.description || 'General course'}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
              {selectedSubjectIds.length > 0 && (
                <p className="text-xs text-action-primary font-medium">{selectedSubjectIds.length} subject(s) selected</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={createTeacherMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCreate}
              disabled={createTeacherMutation.isPending}
            >
              {createTeacherMutation.isPending ? 'Creating...' : 'Create Teacher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open && !updateTeacherMutation.isPending) {
            setIsEditDialogOpen(false);
          } else if (open) {
            setIsEditDialogOpen(true);
          }
        }}
      >
        <DialogContent
          className="max-w-2xl"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit Teacher Profile</DialogTitle>
            <DialogDescription>
              Update personal details and sync course assignments for this teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label>Teacher ID (Read-only)</Label>
              <div className="flex gap-2">
                <Input value={formData.teacher_id} disabled readOnly className="font-mono bg-surface-subtle" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (formData.teacher_id) {
                      navigator.clipboard.writeText(formData.teacher_id);
                      toast({ title: 'Copied', description: 'Teacher ID copied to clipboard' });
                    }
                  }}
                  title="Copy Teacher ID"
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email Address (Read-only)</Label>
              <Input value={formData.email} disabled className="bg-surface-subtle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_name">Full Name *</Label>
              <Input
                id="edit_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Faculty Department</Label>
              <Select
                value={formData.faculty_id ? formData.faculty_id.toString() : ''}
                onValueChange={(v) => setFormData({ ...formData, faculty_id: v ? parseInt(v, 10) : undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_phone_number">Phone Number (Optional)</Label>
              <Input
                id="edit_phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+1-555-0100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_office_location">Office Location (Optional)</Label>
              <Input
                id="edit_office_location"
                value={formData.office_location}
                onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                placeholder="Building B, Room 304"
              />
            </div>

            {/* Subject Assignment Section in Edit */}
            <div className="col-span-2 pt-3 border-t border-border-default space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Manage Subject Assignments</h3>
                <p className="text-xs text-text-muted">Check or uncheck subjects to sync scheduled teaching sessions.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Filter by Faculty</Label>
                  <Select value={formFilterFacultyId} onValueChange={(v) => { setFormFilterFacultyId(v); setFormFilterSemester('all'); }}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Select faculty</SelectItem>
                      {faculties.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Filter by Semester</Label>
                  <Select value={formFilterSemester} onValueChange={setFormFilterSemester} disabled={formFilterFacultyId === 'all'}>
                    <SelectTrigger className="mt-1 h-8 text-xs disabled:opacity-50">
                      <SelectValue placeholder="All semesters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Semesters</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <SelectItem key={s} value={s.toString()}>Semester {s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formFilterFacultyId !== 'all' && (
                <div className="max-h-[160px] overflow-y-auto rounded-md border border-border-default bg-surface-subtle/30 p-2 space-y-1">
                  {formSubjects.length === 0 ? (
                    <p className="text-text-muted text-xs text-center py-4">No subjects found</p>
                  ) : (
                    formSubjects.map((subject) => (
                      <label key={subject.id} className="flex items-start gap-2.5 p-2 hover:bg-surface-subtle rounded cursor-pointer border border-transparent hover:border-border-subtle">
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.includes(subject.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjectIds([...selectedSubjectIds, subject.id]);
                            } else {
                              setSelectedSubjectIds(selectedSubjectIds.filter((id) => id !== subject.id));
                            }
                          }}
                          className="mt-0.5 rounded border-border-default text-action-primary focus:ring-action-primary"
                        />
                        <div className="flex-1 text-xs">
                          <div className="text-text-primary font-medium">{subject.name} <span className="text-text-muted font-mono">({subject.code})</span></div>
                          <div className="text-text-muted mt-0.5">
                            {subject.credits} credits • {subject.description || 'General course'}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
              {selectedSubjectIds.length > 0 && (
                <p className="text-xs text-action-primary font-medium">{selectedSubjectIds.length} subject(s) selected</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateTeacherMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEdit}
              disabled={updateTeacherMutation.isPending}
            >
              {updateTeacherMutation.isPending ? 'Saving...' : 'Update Teacher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Subject Assignments Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subject Assignments: {selectedTeacher?.name}</DialogTitle>
            <DialogDescription>
              Review active classroom assignments, view session schedules, or add new course sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Assigned Courses ({groupedAssignments.length})
                </h3>
                <p className="text-xs text-text-muted">Courses currently linked to this teacher.</p>
              </div>
              <Button onClick={handleAddAssignment} size="sm" className="flex items-center gap-1.5">
                <Add size={14} />
                <span>Add Assignment</span>
              </Button>
            </div>

            {groupedAssignments.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border-default bg-surface-subtle/30">
                <Calendar size={28} className="mx-auto text-text-muted mb-2 opacity-60" />
                <h4 className="text-sm font-semibold text-text-primary">No subject assignments yet</h4>
                <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                  Click "Add Assignment" to assign unassigned course sessions to this instructor.
                </p>
              </div>
            ) : (
              <div className="border border-border-default rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-subtle border-border-default">
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Subject</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Faculty</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Semester</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Sessions</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-text-muted uppercase">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedAssignments.map((group) => (
                      <React.Fragment key={group.subject_id}>
                        <TableRow className="border-b border-border-subtle hover:bg-surface-subtle/40">
                          <TableCell className="font-medium text-text-primary text-sm">
                            <div>{group.subject_name}</div>
                            <div className="text-xs text-text-muted font-mono">{group.subject_code}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {group.faculty_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-text-secondary">
                            Semester {group.semester}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs tabular-nums">
                              {group.schedules.length} session{group.schedules.length === 1 ? '' : 's'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleSubjectExpand(group.subject_id)}
                                className="h-7 text-xs px-2"
                              >
                                {expandedSubjectIds.includes(group.subject_id) ? 'Hide details' : 'View sessions'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAssignAllForSubject(group.subject_id)}
                                disabled={assignAllLoadingSubjectId === group.subject_id}
                                className="h-7 text-xs px-2"
                              >
                                {assignAllLoadingSubjectId === group.subject_id ? 'Assigning...' : 'Assign All'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveAllForSubject(group.subject_id)}
                                disabled={removeAssignmentMutation.isPending}
                                className="h-7 text-xs px-2 text-status-danger hover:bg-status-danger/10 hover:border-status-danger"
                              >
                                Remove All
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedSubjectIds.includes(group.subject_id) && (
                          <TableRow className="bg-surface-subtle/30">
                            <TableCell colSpan={5} className="p-3">
                              <div className="rounded border border-border-subtle bg-surface-default overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-surface-subtle/60 border-border-subtle">
                                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Day / Slot</TableHead>
                                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Room</TableHead>
                                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Students</TableHead>
                                      <TableHead className="text-right text-xs font-semibold text-text-muted uppercase">Remove</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.schedules.map((assignment: TeacherAssignment) => (
                                      <TableRow key={assignment.id} className="border-b border-border-subtle h-9">
                                        <TableCell className="text-xs font-medium text-text-primary">
                                          <span>{assignment.day_of_week}</span>
                                          <span className="text-text-muted ml-2 font-normal font-mono">{assignment.time_slot_display}</span>
                                        </TableCell>
                                        <TableCell className="text-xs text-text-secondary">
                                          {assignment.classroom || '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-text-secondary tabular-nums">
                                          {assignment.student_count || 0} enrolled
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleRemoveAssignment(assignment.id)}
                                            disabled={removeAssignmentMutation.isPending}
                                            className="h-7 w-7 p-0 text-text-muted hover:text-status-danger"
                                            title="Unassign session"
                                          >
                                            <Close size={14} />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsManageDialogOpen(false);
                setSelectedTeacher(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Assignment Dialog */}
      <Dialog open={isAddAssignmentDialogOpen} onOpenChange={setIsAddAssignmentDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Course to {selectedTeacher?.name}</DialogTitle>
            <DialogDescription>
              Browse available course schedules without an assigned teacher.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Faculty</Label>
                <Select value={filterFacultyId} onValueChange={(v) => { setFilterFacultyId(v); setFilterSemester('all'); setFilterSubjectId('all'); }}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Select faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Faculties</SelectItem>
                    {faculties.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Semester</Label>
                <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v); setFilterSubjectId('all'); }} disabled={filterFacultyId === 'all'}>
                  <SelectTrigger className="mt-1 h-8 text-xs disabled:opacity-50">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <SelectItem key={s} value={s.toString()}>Semester {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Select value={filterSubjectId} onValueChange={setFilterSubjectId} disabled={filterFacultyId === 'all'}>
                  <SelectTrigger className="mt-1 h-8 text-xs disabled:opacity-50">
                    <SelectValue placeholder="Filter by subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {filterSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}{s.code ? ` (${s.code})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <Input
                placeholder="Search by course name, code, or faculty..."
                value={assignmentSearchQuery}
                onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {assignmentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAssignmentSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <Close size={12} />
                </button>
              )}
            </div>

            {groupedUnassignedSubjects.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border-default bg-surface-subtle/30">
                <Calendar size={24} className="mx-auto text-text-muted mb-2 opacity-60" />
                <h4 className="text-sm font-semibold text-text-primary">No unassigned courses available</h4>
                <p className="text-xs text-text-muted mt-1">
                  All course schedules match existing assigned instructors.
                </p>
              </div>
            ) : (
              <div className="max-h-[340px] overflow-y-auto border border-border-default rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-surface-subtle z-10">
                    <TableRow className="border-border-default">
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Subject</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Faculty</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Semester</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Sessions</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-text-muted uppercase">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedUnassignedSubjects.map((subject) => (
                      <TableRow key={subject.subject_id} className="border-b border-border-subtle h-10 hover:bg-surface-subtle/40">
                        <TableCell className="font-medium text-text-primary text-xs">
                          <div>{subject.subject_name}</div>
                          <div className="text-text-muted font-mono">{subject.subject_code}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {subject.faculty_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-text-secondary">
                          Semester {subject.semester}
                        </TableCell>
                        <TableCell className="text-xs text-text-secondary tabular-nums">
                          {subject.scheduleCount} session{subject.scheduleCount === 1 ? '' : 's'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              subject.schedules.forEach((schedule) => {
                                handleAssignToSchedule(schedule.id);
                              });
                            }}
                            disabled={addAssignmentMutation.isPending}
                            className="h-7 text-xs px-2.5"
                          >
                            Assign All
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddAssignmentDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Teacher Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete teacher{' '}
              <strong className="text-text-primary">{selectedTeacher?.name}</strong>? This action removes
              their user credentials, profile records, and course assignments. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTeacherMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitDelete}
              disabled={deleteTeacherMutation.isPending}
              className="bg-status-danger text-white hover:bg-status-danger/90"
            >
              {deleteTeacherMutation.isPending ? 'Deleting...' : 'Delete Teacher'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeachersPage;
