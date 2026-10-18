import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search20Regular,
  Dismiss16Regular,
  People20Regular,
  PersonAdd20Regular,
  Add20Regular,
  Edit20Regular,
  Delete20Regular,
  HatGraduation20Regular,
  PeopleSearch20Regular,
  BookOpen20Regular,
  CalendarLtr24Regular,
  Copy20Regular,
  MoreHorizontal20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  CheckmarkCircle20Regular,
  Filter20Regular,
} from '@fluentui/react-icons';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

/** Two-letter initials for Teams-style avatars. */
const getInitials = (name?: string) => {
  const parts = (name || '').replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const TeacherAvatar: React.FC<{ name?: string; size?: 'sm' | 'lg' }> = ({ name, size = 'sm' }) => (
  <span
    aria-hidden
    className={cn(
      'grid shrink-0 place-items-center rounded-full bg-brand-subtle font-semibold text-brand-foreground',
      size === 'lg' ? 'h-10 w-10 text-body-strong' : 'h-8 w-8 text-caption-strong'
    )}
  >
    {getInitials(name)}
  </span>
);

/** Fluent dialog form section: subheading + optional helper text + fields. */
const FormSection: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="space-y-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
    <div>
      <h3 className="text-subheading text-text-primary">{title}</h3>
      {description && <p className="text-caption text-text-muted">{description}</p>}
    </div>
    {children}
  </section>
);

const RequiredMark = () => <span className="text-status-error" aria-hidden> *</span>;

const fieldLabelClass = 'text-body-strong text-text-primary';
const filterLabelClass = 'text-caption-strong text-text-secondary';
const tableHeadClass = 'h-9 text-caption-strong text-text-secondary';

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

  const isFiltered = Boolean(searchQuery || selectedFaculty !== 'all');

  const statTiles = [
    { label: 'Total Teachers', value: teachers.length, Icon: People20Regular },
    { label: 'Faculties', value: faculties.length, Icon: HatGraduation20Regular },
    { label: 'Active Filter Results', value: filteredTeachers.length, Icon: PeopleSearch20Regular },
  ];

  // Shared subject-assignment picker used by the Add and Edit dialogs
  const renderSubjectAssignment = (title: string, description: string, emptyText: string) => (
    <FormSection title={title} description={description}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className={filterLabelClass}>Filter by Faculty</Label>
          <Select value={formFilterFacultyId} onValueChange={(v) => { setFormFilterFacultyId(v); setFormFilterSemester('all'); }}>
            <SelectTrigger className="h-8">
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
        <div className="space-y-1.5">
          <Label className={filterLabelClass}>Filter by Semester</Label>
          <Select value={formFilterSemester} onValueChange={setFormFilterSemester} disabled={formFilterFacultyId === 'all'}>
            <SelectTrigger className="h-8">
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
        <div className="max-h-[200px] divide-y divide-border-subtle overflow-y-auto rounded-md border border-border-subtle bg-surface-default">
          {formSubjects.length === 0 ? (
            <p className="py-6 text-center text-caption text-text-muted">{emptyText}</p>
          ) : (
            formSubjects.map((subject) => {
              const checked = selectedSubjectIds.includes(subject.id);
              return (
                <label
                  key={subject.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors duration-150 ease-fluent-standard',
                    checked ? 'bg-brand-subtle' : 'hover:bg-surface-hover'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSubjectIds([...selectedSubjectIds, subject.id]);
                      } else {
                        setSelectedSubjectIds(selectedSubjectIds.filter((id) => id !== subject.id));
                      }
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-body text-text-primary">
                      {subject.name}{' '}
                      <span className="font-mono text-caption text-text-muted">({subject.code})</span>
                    </div>
                    <div className="text-caption text-text-muted">
                      {subject.credits} credits • {subject.description || 'General course'}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      )}
      {selectedSubjectIds.length > 0 && (
        <p className="flex items-center gap-1.5 text-caption-strong text-brand-foreground">
          <CheckmarkCircle20Regular className="h-4 w-4" aria-hidden />
          {selectedSubjectIds.length} subject(s) selected
        </p>
      )}
    </FormSection>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title text-text-primary">
          Teachers Management
        </h1>
        <p className="text-body text-text-muted">
          Manage faculty teacher accounts, course assignments, and classroom schedule links
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statTiles.map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-lg bg-surface-default p-4 shadow">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <Icon aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-caption text-text-muted">{label}</p>
              <p className="text-[28px] font-semibold leading-9 text-text-primary tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Directory */}
      <section aria-label="Faculty Roster" className="overflow-hidden rounded-lg bg-surface-default shadow">
        {/* Command bar */}
        <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={handleAddTeacher}>
              <PersonAdd20Regular aria-hidden />
              <span>Add Teacher</span>
            </Button>
            <div className="hidden h-6 w-px bg-border-subtle sm:block" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-body-strong text-text-primary">Faculty Roster</h2>
              <p className="text-caption text-text-muted tabular-nums">
                Showing {filteredTeachers.length} of {teachers.length} teacher{teachers.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search20Regular className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <Input
                placeholder="Search by name, teacher ID, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8"
                aria-label="Search teachers"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <Dismiss16Regular aria-hidden />
                </button>
              )}
            </div>
            <div className="w-full sm:w-56">
              <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                <SelectTrigger className="h-8" aria-label="Filter by faculty">
                  <span className="flex min-w-0 items-center gap-2">
                    <Filter20Regular className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                    <SelectValue placeholder="All Faculties" />
                  </span>
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

        {isLoading ? (
          <div className="p-4">
            <LoadingState rows={6} columns={7} />
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={isFiltered ? 'No teachers found' : 'No teachers registered yet'}
              description={
                isFiltered
                  ? 'Try clearing or changing your filters to see more results.'
                  : 'Get started by creating your first teacher profile.'
              }
              isFiltered={isFiltered}
              actionLabel={isFiltered ? 'Reset Filters' : 'Add Teacher'}
              onAction={
                isFiltered
                  ? () => {
                      setSearchQuery('');
                      setSelectedFaculty('all');
                    }
                  : handleAddTeacher
              }
              className="border-0"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                  <TableHead className={cn(tableHeadClass, 'min-w-[220px] pl-4')}>Full Name</TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[140px]')}>Teacher ID</TableHead>
                  <TableHead className={tableHeadClass}>Email Address</TableHead>
                  <TableHead className={tableHeadClass}>Faculty</TableHead>
                  <TableHead className={tableHeadClass}>Department</TableHead>
                  <TableHead className={tableHeadClass}>Phone</TableHead>
                  <TableHead className={cn(tableHeadClass, 'w-[96px] pr-4 text-right')}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher: Teacher) => (
                  <TableRow
                    key={teacher.id}
                    className="group border-b border-border-subtle transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <TableCell className="py-2 pl-4">
                      <div className="flex items-center gap-3">
                        <TeacherAvatar name={teacher.name} />
                        <span className="truncate text-body-strong text-text-primary">{teacher.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-caption text-text-secondary">
                        {teacher.teacher_id}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-body text-text-secondary">
                      {teacher.user.email}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="secondary" className="font-normal">
                        {getFacultyName(teacher.faculty_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-body text-text-muted">
                      {teacher.department || '—'}
                    </TableCell>
                    <TableCell className="py-2 text-body text-text-muted tabular-nums">
                      {teacher.phone_number || '—'}
                    </TableCell>
                    <TableCell className="py-2 pr-4 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleManageAssignments(teacher)}
                          className="h-8 w-8 p-0 text-text-secondary hover:text-brand-foreground"
                          title="Manage Subject Assignments"
                          aria-label={`Manage subject assignments for ${teacher.name}`}
                        >
                          <BookOpen20Regular aria-hidden />
                        </Button>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-text-secondary"
                              title="More actions"
                              aria-label={`More actions for ${teacher.name}`}
                            >
                              <MoreHorizontal20Regular aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuItem onSelect={() => handleManageAssignments(teacher)} className="gap-2">
                              <BookOpen20Regular className="h-4 w-4 text-text-muted" aria-hidden />
                              Manage Subject Assignments
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleEditTeacher(teacher)} className="gap-2">
                              <Edit20Regular className="h-4 w-4 text-text-muted" aria-hidden />
                              Edit Personal Information
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => handleDeleteTeacher(teacher)}
                              className="gap-2 text-status-error focus:bg-status-error-subtle focus:text-status-error"
                            >
                              <Delete20Regular className="h-4 w-4" aria-hidden />
                              Delete Teacher
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

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
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-section-title text-text-primary">Add New Teacher</DialogTitle>
            <DialogDescription className="text-body text-text-muted">
              Create an authenticated teacher profile with credentials and optional subject assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <FormSection title="Account" description="Sign-in credentials for the teacher portal.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className={fieldLabelClass}>Full Name<RequiredMark /></Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Dr. Sarah Jenkins"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={fieldLabelClass}>Teacher ID</Label>
                  <div className="flex h-9 items-center rounded-md border border-dashed border-border-default bg-surface-subtle px-3 text-caption text-text-muted">
                    Generated automatically by server
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email" className={fieldLabelClass}>Email Address<RequiredMark /></Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sarah.jenkins@university.edu"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className={fieldLabelClass}>Initial Password<RequiredMark /></Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className={fieldLabelClass}>Confirm Password<RequiredMark /></Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Profile" description="Department and contact details shown in the directory.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className={fieldLabelClass}>Faculty Department</Label>
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
                  <Label htmlFor="phone_number" className={fieldLabelClass}>Phone Number (Optional)</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="+1-555-0100"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="office_location" className={fieldLabelClass}>Office Location (Optional)</Label>
                  <Input
                    id="office_location"
                    value={formData.office_location}
                    onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                    placeholder="Building B, Room 304"
                  />
                </div>
              </div>
            </FormSection>

            {/* Subject Assignment Section */}
            {renderSubjectAssignment(
              'Assign Subjects (Optional)',
              'Link teaching responsibilities immediately on account creation.',
              'No subjects found for selection'
            )}
          </div>
          <DialogFooter className="gap-2">
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
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <TeacherAvatar name={formData.full_name} size="lg" />
              <div className="min-w-0">
                <DialogTitle className="text-section-title text-text-primary">Edit Teacher Profile</DialogTitle>
                <DialogDescription className="text-body text-text-muted">
                  Update personal details and sync course assignments for this teacher.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <FormSection title="Identity" description="These values are managed by the system.">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label className={fieldLabelClass}>Teacher ID (Read-only)</Label>
                  <div className="flex gap-2">
                    <Input value={formData.teacher_id} disabled readOnly className="bg-surface-subtle font-mono" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (formData.teacher_id) {
                          navigator.clipboard.writeText(formData.teacher_id);
                          toast({ title: 'Copied', description: 'Teacher ID copied to clipboard' });
                        }
                      }}
                      title="Copy Teacher ID"
                      aria-label="Copy Teacher ID"
                    >
                      <Copy20Regular aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className={fieldLabelClass}>Email Address (Read-only)</Label>
                  <Input value={formData.email} disabled className="bg-surface-subtle" />
                </div>
              </div>
            </FormSection>

            <FormSection title="Profile">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit_name" className={fieldLabelClass}>Full Name<RequiredMark /></Label>
                  <Input
                    id="edit_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={fieldLabelClass}>Faculty Department</Label>
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
                  <Label htmlFor="edit_phone_number" className={fieldLabelClass}>Phone Number (Optional)</Label>
                  <Input
                    id="edit_phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="+1-555-0100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_office_location" className={fieldLabelClass}>Office Location (Optional)</Label>
                  <Input
                    id="edit_office_location"
                    value={formData.office_location}
                    onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                    placeholder="Building B, Room 304"
                  />
                </div>
              </div>
            </FormSection>

            {/* Subject Assignment Section in Edit */}
            {renderSubjectAssignment(
              'Manage Subject Assignments',
              'Check or uncheck subjects to sync scheduled teaching sessions.',
              'No subjects found'
            )}
          </div>
          <DialogFooter className="gap-2">
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
            <div className="flex items-center gap-3">
              <TeacherAvatar name={selectedTeacher?.name} size="lg" />
              <div className="min-w-0">
                <DialogTitle className="text-section-title text-text-primary">
                  Subject Assignments: {selectedTeacher?.name}
                </DialogTitle>
                <DialogDescription className="text-body text-text-muted">
                  Review active classroom assignments, view session schedules, or add new course sessions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-subheading text-text-primary">
                  Assigned Courses
                  <Badge variant="secondary" shape="pill" className="border-transparent bg-brand-subtle text-brand-foreground">
                    {groupedAssignments.length}
                  </Badge>
                </h3>
                <p className="text-caption text-text-muted">Courses currently linked to this teacher.</p>
              </div>
              <Button onClick={handleAddAssignment} size="sm">
                <Add20Regular aria-hidden />
                <span>Add Assignment</span>
              </Button>
            </div>

            {groupedAssignments.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-border-default bg-surface-subtle px-6 py-10 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-default text-text-muted">
                  <CalendarLtr24Regular aria-hidden />
                </div>
                <h4 className="text-subheading text-text-primary">No subject assignments yet</h4>
                <p className="mx-auto mt-1 max-w-sm text-body text-text-muted">
                  Click "Add Assignment" to assign unassigned course sessions to this instructor.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border-subtle">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                      <TableHead className={tableHeadClass}>Subject</TableHead>
                      <TableHead className={tableHeadClass}>Faculty</TableHead>
                      <TableHead className={tableHeadClass}>Semester</TableHead>
                      <TableHead className={tableHeadClass}>Sessions</TableHead>
                      <TableHead className={cn(tableHeadClass, 'text-right')}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedAssignments.map((group) => {
                      const expanded = expandedSubjectIds.includes(group.subject_id);
                      return (
                        <React.Fragment key={group.subject_id}>
                          <TableRow className={cn('border-b border-border-subtle hover:bg-surface-hover', expanded && 'bg-surface-selected hover:bg-surface-selected')}>
                            <TableCell className="py-2">
                              <div className="text-body-strong text-text-primary">{group.subject_name}</div>
                              <div className="font-mono text-caption text-text-muted">{group.subject_code}</div>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant="secondary" className="font-normal">
                                {group.faculty_name}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-body text-text-secondary">
                              Semester {group.semester}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant="secondary" className="border-transparent bg-brand-subtle text-brand-foreground">
                                {group.schedules.length} session{group.schedules.length === 1 ? '' : 's'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleSubjectExpand(group.subject_id)}
                                  aria-expanded={expanded}
                                  className="h-7 px-2 text-caption"
                                >
                                  {expanded ? <ChevronDown16Regular aria-hidden /> : <ChevronRight16Regular aria-hidden />}
                                  {expanded ? 'Hide details' : 'View sessions'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAssignAllForSubject(group.subject_id)}
                                  disabled={assignAllLoadingSubjectId === group.subject_id}
                                  className="h-7 px-2 text-caption"
                                >
                                  {assignAllLoadingSubjectId === group.subject_id ? 'Assigning...' : 'Assign All'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemoveAllForSubject(group.subject_id)}
                                  disabled={removeAssignmentMutation.isPending}
                                  className="h-7 px-2 text-caption text-status-error hover:border-status-error-border hover:bg-status-error-subtle hover:text-status-error"
                                >
                                  Remove All
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
                              <TableCell colSpan={5} className="py-3 pl-8 pr-3">
                                <div className="overflow-hidden rounded-md border border-border-subtle bg-surface-default">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                                        <TableHead className={cn(tableHeadClass, 'h-8')}>Day / Slot</TableHead>
                                        <TableHead className={cn(tableHeadClass, 'h-8')}>Room</TableHead>
                                        <TableHead className={cn(tableHeadClass, 'h-8')}>Students</TableHead>
                                        <TableHead className={cn(tableHeadClass, 'h-8 text-right')}>Remove</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {group.schedules.map((assignment: TeacherAssignment) => (
                                        <TableRow key={assignment.id} className="border-b border-border-subtle hover:bg-surface-hover">
                                          <TableCell className="py-1.5 text-body text-text-primary">
                                            <span className="capitalize">{assignment.day_of_week}</span>
                                            <span className="ml-2 text-caption text-text-muted tabular-nums">{assignment.time_slot_display}</span>
                                          </TableCell>
                                          <TableCell className="py-1.5 text-body text-text-secondary">
                                            {assignment.classroom || '—'}
                                          </TableCell>
                                          <TableCell className="py-1.5 text-body text-text-secondary tabular-nums">
                                            {assignment.student_count || 0} enrolled
                                          </TableCell>
                                          <TableCell className="py-1.5 text-right">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleRemoveAssignment(assignment.id)}
                                              disabled={removeAssignmentMutation.isPending}
                                              className="h-7 w-7 p-0 text-text-muted hover:bg-status-error-subtle hover:text-status-error"
                                              title="Unassign session"
                                              aria-label="Unassign session"
                                            >
                                              <Dismiss16Regular aria-hidden />
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
                      );
                    })}
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
            <DialogTitle className="text-section-title text-text-primary">Assign Course to {selectedTeacher?.name}</DialogTitle>
            <DialogDescription className="text-body text-text-muted">
              Browse available course schedules without an assigned teacher.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className={filterLabelClass}>Faculty</Label>
                <Select value={filterFacultyId} onValueChange={(v) => { setFilterFacultyId(v); setFilterSemester('all'); setFilterSubjectId('all'); }}>
                  <SelectTrigger className="h-8">
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
              <div className="space-y-1.5">
                <Label className={filterLabelClass}>Semester</Label>
                <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v); setFilterSubjectId('all'); }} disabled={filterFacultyId === 'all'}>
                  <SelectTrigger className="h-8">
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
              <div className="space-y-1.5">
                <Label className={filterLabelClass}>Subject</Label>
                <Select value={filterSubjectId} onValueChange={setFilterSubjectId} disabled={filterFacultyId === 'all'}>
                  <SelectTrigger className="h-8">
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
              <Search20Regular className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <Input
                placeholder="Search by course name, code, or faculty..."
                value={assignmentSearchQuery}
                onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8"
                aria-label="Search unassigned courses"
              />
              {assignmentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAssignmentSearchQuery('')}
                  className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <Dismiss16Regular aria-hidden />
                </button>
              )}
            </div>

            {groupedUnassignedSubjects.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-border-default bg-surface-subtle px-6 py-10 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-default text-text-muted">
                  <CalendarLtr24Regular aria-hidden />
                </div>
                <h4 className="text-subheading text-text-primary">No unassigned courses available</h4>
                <p className="mt-1 text-body text-text-muted">
                  All course schedules match existing assigned instructors.
                </p>
              </div>
            ) : (
              <div className="max-h-[340px] overflow-y-auto rounded-md border border-border-subtle">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-surface-subtle">
                    <TableRow className="border-border-subtle hover:bg-surface-subtle">
                      <TableHead className={tableHeadClass}>Subject</TableHead>
                      <TableHead className={tableHeadClass}>Faculty</TableHead>
                      <TableHead className={tableHeadClass}>Semester</TableHead>
                      <TableHead className={tableHeadClass}>Sessions</TableHead>
                      <TableHead className={cn(tableHeadClass, 'text-right')}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedUnassignedSubjects.map((subject) => (
                      <TableRow key={subject.subject_id} className="border-b border-border-subtle hover:bg-surface-hover">
                        <TableCell className="py-2">
                          <div className="text-body-strong text-text-primary">{subject.subject_name}</div>
                          <div className="font-mono text-caption text-text-muted">{subject.subject_code}</div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="secondary" className="font-normal">
                            {subject.faculty_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-body text-text-secondary">
                          Semester {subject.semester}
                        </TableCell>
                        <TableCell className="py-2 text-body text-text-secondary tabular-nums">
                          {subject.scheduleCount} session{subject.scheduleCount === 1 ? '' : 's'}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              subject.schedules.forEach((schedule) => {
                                handleAssignToSchedule(schedule.id);
                              });
                            }}
                            disabled={addAssignmentMutation.isPending}
                            className="h-7 px-2.5 text-caption"
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
              <strong className="font-semibold text-text-primary">{selectedTeacher?.name}</strong>? This action removes
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
