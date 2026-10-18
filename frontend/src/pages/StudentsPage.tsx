import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentFormEnhanced, { StudentFormData } from '@/components/StudentFormEnhanced';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FaceStatusButton } from '@/components/face-admin/FaceBadges';
import StudentFaceDialog from '@/components/face-admin/StudentFaceDialog';
import { resolveFaceStatus, type FaceStatusKey } from '@/components/face-admin/faceLabels';
import {
  Search20Regular,
  Dismiss12Regular,
  Dismiss16Regular,
  People20Regular,
  PersonAdd20Regular,
  Filter20Regular,
  ArrowLeft20Regular,
  LockClosed20Regular,
  Edit20Regular,
  Delete20Regular,
  CalendarLtr20Regular,
  ArrowUp16Regular,
  ArrowDown16Regular,
  ArrowSort16Regular,
  MoreHorizontal20Regular,
  ScanPerson20Regular,
} from '@fluentui/react-icons';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { StudentCreateData } from '@/integrations/api/types';
import { useAuth } from '@/contexts/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clearAuthToken, getAuthToken } from '@/lib/authToken';

// Fluent-style native dropdown (neutral stroke with accessible bottom border)
const selectClass =
  'h-8 rounded-md border border-border-default border-b-border-strong bg-surface-default pl-2.5 pr-7 text-body text-text-primary transition-colors duration-150 ease-fluent-standard hover:border-border-strong focus:border-b-brand focus:outline-none disabled:opacity-50';

const FilterTag = ({ label, onRemove, ariaLabel }: { label: React.ReactNode; onRemove: () => void; ariaLabel: string }) => (
  <span className="inline-flex h-6 items-center gap-1 rounded-md border border-border-subtle bg-surface-default pl-2 pr-1 text-caption text-text-primary">
    <span className="max-w-[200px] truncate">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      className="grid h-4 w-4 place-items-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
      aria-label={ariaLabel}
    >
      <Dismiss12Regular aria-hidden />
    </button>
  </span>
);

const ChipToggle = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`h-7 min-w-[2rem] rounded-md border px-2 text-caption-strong tabular-nums transition-colors duration-150 ease-fluent-standard ${
      active
        ? 'border-brand-stroke bg-brand-subtle text-brand-foreground'
        : 'border-border-default bg-surface-default text-text-secondary hover:bg-surface-hover'
    }`}
  >
    {children}
  </button>
);

/** A student row as shown on this page, including the face enrolment fields (docs/system/face-verification.md §8). */
type StudentRow = StudentFormData & {
  studentId?: string;
  faculty?: string;
  face_registered: boolean;
  face_enrollment_status: FaceStatusKey;
  face_registered_at: string | null;
};

type SortField = 'name' | 'batch' | 'semester' | 'year';
type FaceFilter = 'any' | 'registered' | 'not_registered' | 'reset' | 'deleted';

const FACE_FILTER_LABEL: Record<Exclude<FaceFilter, 'any'>, string> = {
  registered: 'Face registered',
  not_registered: 'No registered face',
  reset: 'Face reset',
  deleted: 'Face deleted by student',
};

const faceStatusOf = (s: StudentRow) => resolveFaceStatus(s.face_enrollment_status, s.face_registered);

// Deterministic avatar tint (Teams-style colored initials)
const avatarTints = [
  'bg-brand-subtle text-brand-foreground',
  'bg-status-info-subtle text-status-info',
  'bg-status-success-subtle text-status-success',
  'bg-status-warning-subtle text-status-warning',
];

const getInitials = (name?: string) =>
  (name || 'S')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || 'S';

const tintFor = (name?: string) => {
  const s = name || '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return avatarTints[h % avatarTints.length];
};

const headClass = 'h-9 px-4 text-caption-strong normal-case tracking-normal text-text-secondary';

const SortableHeader = ({
  field,
  label,
  sortBy,
  sortDir,
  onSortChange,
}: {
  field: SortField;
  label: string;
  sortBy?: SortField;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (field: SortField) => void;
}) => {
  const isActive = sortBy === field;
  return (
    <button
      type="button"
      onClick={() => onSortChange?.(field)}
      className={`-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isActive ? 'text-text-primary' : ''
      }`}
      title={`Sort by ${label}`}
    >
      <span>{label}</span>
      {isActive ? (
        sortDir === 'asc' ? (
          <ArrowUp16Regular className="text-brand-foreground" aria-hidden />
        ) : (
          <ArrowDown16Regular className="text-brand-foreground" aria-hidden />
        )
      ) : (
        <ArrowSort16Regular className="text-text-muted" aria-hidden />
      )}
    </button>
  );
};

/** Students table with the face registration status column and row action. */
const StudentTable = ({
  students,
  onEdit,
  onDelete,
  onFace,
  isLoading = false,
  sortBy,
  sortDir,
  onSortChange,
}: {
  students: StudentRow[];
  onEdit: (student: StudentRow) => void;
  onDelete: (studentId: string) => void;
  onFace: (student: StudentRow) => void;
  isLoading?: boolean;
  sortBy?: SortField;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (field: SortField) => void;
}) => {
  const navigate = useNavigate();
  const sortProps = { sortBy, sortDir, onSortChange };

  return (
    <div className="w-full overflow-hidden rounded-lg bg-surface-default shadow">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-border-subtle bg-surface-subtle">
            <TableRow className="hover:bg-transparent">
              <TableHead className={headClass}>
                <SortableHeader field="name" label="Full Name" {...sortProps} />
              </TableHead>
              <TableHead className={headClass}>Student ID</TableHead>
              <TableHead className={headClass}>Faculty</TableHead>
              <TableHead className={headClass}>
                <SortableHeader field="semester" label="Semester" {...sortProps} />
              </TableHead>
              <TableHead className={headClass}>
                <SortableHeader field="year" label="Year" {...sortProps} />
              </TableHead>
              <TableHead className={headClass}>
                <SortableHeader field="batch" label="Batch" {...sortProps} />
              </TableHead>
              <TableHead className={headClass}>Face</TableHead>
              <TableHead className={`${headClass} w-12 text-right`}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`loading-${idx}`} className="hover:bg-transparent">
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="px-4 py-2.5"><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell className="px-4 py-2.5"><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="px-4 py-2.5"><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="px-4 py-2.5"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="px-4 py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell className="px-4 py-2.5 text-right"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : students.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="p-6 text-center">
                  <EmptyState
                    title="No students found"
                    description="No student records match the current filter criteria."
                    isFiltered
                    className="border-0"
                  />
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => {
                const faceStatus = faceStatusOf(student);
                return (
                  <TableRow key={student.id} className="group border-b border-border-subtle hover:bg-surface-hover">
                    <TableCell className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption-strong ${tintFor(student.full_name)}`}
                          aria-hidden
                        >
                          {getInitials(student.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[240px] truncate text-body-strong text-text-primary">{student.full_name}</p>
                          <p className="max-w-[240px] truncate text-caption text-text-muted">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span className="font-mono text-caption text-text-secondary">{student.student_id}</span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Badge variant="secondary" shape="pill" className="max-w-[200px] truncate font-normal">
                        {student.faculty}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-body tabular-nums text-text-secondary">
                      Sem {student.semester}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-body tabular-nums text-text-secondary">
                      Year {student.year}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-body tabular-nums text-text-secondary">{student.batch}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <FaceStatusButton
                        status={faceStatus}
                        studentName={student.full_name}
                        onClick={() => onFace(student)}
                        disabled={!student.id}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(student)}
                          title="Edit student"
                          aria-label="Edit student"
                          className="text-text-muted opacity-0 transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Edit20Regular aria-hidden />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="More actions"
                              aria-label={`More actions for ${student.full_name}`}
                              className="text-text-muted hover:text-text-primary"
                            >
                              <MoreHorizontal20Regular aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                              onSelect={() => navigate(`/app/students/${student.id}/calendar`)}
                              className="gap-2"
                            >
                              <CalendarLtr20Regular className="text-text-muted" aria-hidden />
                              View attendance calendar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onEdit(student)} className="gap-2">
                              <Edit20Regular className="text-text-muted" aria-hidden />
                              Edit student
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!student.id} onSelect={() => onFace(student)} className="gap-2">
                              <ScanPerson20Regular className="text-text-muted" aria-hidden />
                              Face registration…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!student.id}
                              onSelect={() => {
                                // The page asks for confirmation before deleting.
                                if (student.id) onDelete(student.id);
                              }}
                              className="gap-2 text-status-error focus:text-status-error"
                            >
                              <Delete20Regular aria-hidden />
                              Delete student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {students.length > 0 && !isLoading && (
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-subtle px-4 py-2 text-caption text-text-muted">
          <span>
            Total: <strong className="font-semibold text-text-primary tabular-nums">{students.length}</strong> student
            {students.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

const StudentsPage = () => {
  const [selectedStudent, setSelectedStudent] = useState<StudentFormData | undefined>(undefined);
  const [faceStudent, setFaceStudent] = useState<StudentRow | null>(null);
  const [faceFilter, setFaceFilter] = useState<FaceFilter>('any');
  const [activeTab, setActiveTab] = useState<string>('list');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  // Advanced filters
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [hasEmail, setHasEmail] = useState<'any' | 'yes' | 'no'>('any');
  const [sortBy, setSortBy] = useState<'name' | 'batch' | 'semester' | 'year'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch faculties for filtering
  const { data: allFaculties = [] } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => api.faculties.getAll(),
  });

  // Fetch students from our backend API
  const { data: students = [], isLoading, refetch, error } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const data = await api.students.getAll();
      console.log('[StudentsPage] Raw API data:', data);
      if (!data || data.length === 0) {
        return [];
      }
      // Use the exact faculty value from backend response
      return data.map(student => {
        console.log(`[StudentsPage] Processing student:`, student);
        console.log(`[StudentsPage] Faculty value:`, student.faculty);
        console.log(`[StudentsPage] Faculty type:`, typeof student.faculty);
        
        const mapped: StudentRow = {
          id: student.id || '',
          full_name: student.name || 'Unknown Name',
          student_id: student.studentId || 'Unknown ID',
          studentId: student.studentId || 'Unknown ID',
          email: student.email || 'unknown@example.com',
          faculty: student.faculty || 'Unknown Faculty',
          faculty_id: student.faculty_id || 0, // Use actual faculty_id from backend
          semester: student.semester || 1,
          year: student.year || 1,
          batch: student.batch || new Date().getFullYear(),
          phone_number: student.phone_number || '',
          emergency_contact: student.emergency_contact || '',
          face_registered: !!student.face_registered,
          face_enrollment_status: resolveFaceStatus(student.face_enrollment_status, student.face_registered),
          face_registered_at: student.face_registered_at ?? null,
        };
        
        console.log(`[StudentsPage] Mapped student:`, mapped);
        return mapped;
      });
    },
    staleTime: 30000,
    retry: (failureCount, error) => {
      if (error && error.message && (error.message.includes('authenticated') || error.message.includes('expired'))) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Refetch students when switching to the list tab
  React.useEffect(() => {
    if (activeTab === 'list') {
      refetch();
    }
  }, [activeTab, refetch]);

  // Use all faculties from backend for dropdown - keep the full objects
  const faculties = React.useMemo(() => {
    return allFaculties; // Return full faculty objects with id and name
  }, [allFaculties]);

  // Derive dynamic options from loaded students
  const batchOptions = React.useMemo(() => {
    const set = new Set<number>();
    students.forEach(s => {
      if (s.batch) set.add(Number(s.batch));
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [students]);

  // Enhanced filtering with multiple search criteria
  const filteredStudents = React.useMemo(() => {
    let filtered = students;
    
    // Filter by faculty if selected
    if (selectedFaculty) {
      filtered = filtered.filter(s => s.faculty_id === Number(selectedFaculty));
    }
    
    // Enhanced search across multiple fields
    if (searchStudentId.trim()) {
      const query = searchStudentId.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.full_name?.toLowerCase().includes(query) ||
        s.student_id?.toLowerCase().includes(query) ||
        s.studentId?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.faculty?.toLowerCase().includes(query) ||
        s.phone_number?.toLowerCase().includes(query) ||
        String(s.batch || '').includes(query)
      );
    }

    // Filter by semesters
    if (selectedSemesters.length > 0) {
      const set = new Set(selectedSemesters);
      filtered = filtered.filter(s => set.has(Number(s.semester)));
    }

    // Filter by years
    if (selectedYears.length > 0) {
      const set = new Set(selectedYears);
      filtered = filtered.filter(s => set.has(Number(s.year)));
    }

    // Filter by batch
    if (selectedBatch) {
      filtered = filtered.filter(s => Number(s.batch) === Number(selectedBatch));
    }

    // Filter by email availability
    if (hasEmail !== 'any') {
      filtered = filtered.filter(s => {
        const has = !!(s.email && s.email !== 'unknown@example.com');
        return hasEmail === 'yes' ? has : !has;
      });
    }

    // Filter by face registration status
    if (faceFilter !== 'any') {
      filtered = filtered.filter(s => {
        const status = faceStatusOf(s);
        if (faceFilter === 'registered') return status === 'enrolled';
        if (faceFilter === 'not_registered') return status !== 'enrolled';
        return status === faceFilter;
      });
    }

    // Sorting
    const compare = (a: StudentFormData, b: StudentFormData) => {
      let res = 0;
      if (sortBy === 'name') {
        res = (a.full_name || '').localeCompare(b.full_name || '');
      } else if (sortBy === 'batch') {
        res = Number(a.batch || 0) - Number(b.batch || 0);
      } else if (sortBy === 'semester') {
        res = Number(a.semester || 0) - Number(b.semester || 0);
      } else if (sortBy === 'year') {
        res = Number(a.year || 0) - Number(b.year || 0);
      }
      return sortDir === 'asc' ? res : -res;
    };

    return [...filtered].sort(compare);
  }, [students, selectedFaculty, searchStudentId, selectedSemesters, selectedYears, selectedBatch, hasEmail, faceFilter, sortBy, sortDir]);

  const notRegisteredCount = React.useMemo(
    () => students.filter(s => faceStatusOf(s) !== 'enrolled').length,
    [students]
  );

  React.useEffect(() => {
    console.log('[StudentsPage] Mapped students for StudentList:', students);
  }, [students]);

  // Add student mutation - now includes account creation with password
  const addStudentMutation = useMutation({
    mutationFn: async (student: StudentFormData) => {
      try {
        console.log('[Frontend] Starting student creation with data:', student);
        console.log('[Frontend] Current user:', user); // Debug current user
        console.log('[Frontend] Auth token present:', !!getAuthToken());
        
        // Debug: Check current auth status
        try {
          const currentUser = await api.auth.getUser();
          console.log('[Frontend] Verified current user from API:', currentUser);
        } catch (authError) {
          console.log('[Frontend] Failed to get current user:', authError);
        }
        
        // Check if user is admin
        if (user?.role !== 'admin') {
          throw new Error(`Admin access required. Current user role: ${user?.role || 'unknown'}`);
        }
        
        // Validate required fields for account creation
        if (!student.password) {
          throw new Error("Password is required to create a student account");
        }
        
        if (student.password !== student.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        
        // Create student with proper backend structure
        // Note: student_id is NOT included - backend will auto-generate it
        const createData: StudentCreateData = {
          name: student.full_name,
          email: student.email,
          // studentId: student.student_id,  // Removed - backend auto-generates
          password: student.password,
          faculty_id: student.faculty_id, // Pass faculty_id directly
          semester: student.semester,
          year: student.year,
          batch: student.batch,
          phone_number: student.phone_number,      // Add phone number
          emergency_contact: student.emergency_contact, // Add emergency contact
          // Legacy fields for backward compatibility
          rollNo: student.faculty_id?.toString() || "0", 
          role: 'student',
        };
        
        console.log('[Frontend] Mapped student data for API:', createData);
        
        const result = await api.students.create(createData);
        console.log('[Frontend] Student creation successful:', result);
        return result;
      } catch (error) {
        console.error('[Frontend] Error adding student:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('[Frontend] Student addition successful:', data);
      console.log('[Frontend] Auto-generated Student ID:', data.student_id);
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void refetch(); // Explicitly refetch students data
      setActiveTab('list');
      toast({
        title: "Student Added Successfully!",
        description: `Student ID ${data.student_id} has been auto-generated and assigned.`,
        duration: 5000,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add student: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async (student: StudentFormData) => {
      if (!student.id) {
        throw new Error("Student ID is required for updates");
      }
      
      try {
        console.log('[Frontend] Updating student with data:', student);
        
        // Map our form data to match backend expected format
        const updateData = {
          full_name: student.full_name,
          email: student.email,
          student_id: student.student_id,
          faculty_id: student.faculty_id, // For backend faculty relationship
          semester: student.semester,
          year: student.year,
          batch: student.batch,
          phone_number: student.phone_number,
          emergency_contact: student.emergency_contact,
        };
        
        console.log('[Frontend] Mapped update data for API:', updateData);
        
        const result = await api.students.update(student.id, updateData);
        console.log('[Frontend] Student update successful:', result);
        return result;
      } catch (error) {
        console.error('Error updating student:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[Frontend] Student update successful, refreshing student list');
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void refetch(); // Explicitly refetch students data
      setSelectedStudent(undefined);
      setActiveTab('list');
      toast({
        title: "Student Updated",
        description: "The student has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update student: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete student mutation - following the same pattern as add student
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      try {
        console.log('[Frontend] Starting delete mutation for student ID:', studentId);
        console.log('[Frontend] Student ID type:', typeof studentId);
        
        // Basic validation
        if (!studentId || studentId === 'undefined' || studentId === 'null') {
          throw new Error("Invalid student ID provided");
        }
        
        // Call the API delete method (same pattern as create)
        const result = await api.students.delete(studentId);
        console.log('[Frontend] Delete API call completed successfully');
        return studentId;
      } catch (error) {
        console.error('[Frontend] Error in delete mutation:', error);
        throw error;
      }
    },
    onSuccess: (deletedStudentId) => {
      console.log('[Frontend] Delete mutation onSuccess triggered for:', deletedStudentId);
      // Same pattern as add student - invalidate queries and show toast
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void refetch(); // Explicitly refetch students data
      toast({
        title: "Student Deleted",
        description: "The student has been successfully removed from the system.",
      });
    },
    onError: (error) => {
      console.error('[Frontend] Delete mutation onError triggered:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleAddNewClick = () => {
    setSelectedStudent(undefined);
    setActiveTab('form');
  };

  const handleEditStudent = (student: StudentFormData) => {
    setSelectedStudent(student);
    setActiveTab('form');
  };

  const handleDeleteStudent = (studentId: string) => {
    console.log("Attempting to delete student with ID:", studentId);
    console.log("Student ID type:", typeof studentId);

    // Enhanced validation
    if (!studentId || studentId === 'undefined' || studentId === 'null' || studentId.trim() === '') {
      console.error("Invalid student ID provided:", studentId);
      toast({
        title: "Error",
        description: "Cannot delete student: Invalid or missing student ID",
        variant: "destructive",
      });
      return;
    }

    // Convert to number to validate it's a valid ID
    const numericId = parseInt(studentId);
    if (isNaN(numericId) || numericId <= 0) {
      console.error("Student ID is not a valid number:", studentId);
      toast({
        title: "Error",
        description: "Cannot delete student: Student ID must be a valid number",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this student? This action cannot be undone and will remove all associated data including attendance records and marks.');
    console.log("Delete confirmation result:", confirmed);

    if (confirmed) {
      console.log("Proceeding with deletion for student ID:", studentId);
      deleteStudentMutation.mutate(studentId);
    } else {
      console.log("User cancelled deletion");
    }
  };

  const handleSort = (field: 'name' | 'batch' | 'semester' | 'year') => {
    if (sortBy === field) {
      // Toggle direction if same field
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const onSubmit = (data: StudentFormData) => {
    if (selectedStudent) {
      updateStudentMutation.mutate({ ...data, id: selectedStudent.id });
    } else {
      addStudentMutation.mutate(data);
    }
  };

  // Handle authentication errors (after all hooks)
  if (error && (error.message.includes('authenticated') || error.message.includes('expired'))) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-sm rounded-lg bg-surface-default p-8 text-center shadow">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-status-warning-subtle text-status-warning">
            <LockClosed20Regular aria-hidden />
          </div>
          <h2 className="mb-1 text-section-title text-text-primary">Authentication Required</h2>
          <p className="mb-5 text-body text-text-muted">{error.message}</p>
          <Button
            onClick={() => {
              clearAuthToken();
              window.location.href = '/login';
            }}
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const advancedFilterCount =
    (selectedSemesters.length ? 1 : 0) + (selectedYears.length ? 1 : 0);
  const hasActiveFilters = !!(
    selectedFaculty ||
    searchStudentId.trim() ||
    selectedSemesters.length ||
    selectedYears.length ||
    selectedBatch ||
    hasEmail !== 'any' ||
    faceFilter !== 'any'
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-page-title text-text-primary">
            Student Management
          </h1>
          <p className="mt-1 text-body text-text-muted">
            {activeTab === 'list'
              ? `Manage and monitor ${students.length} registered students`
              : selectedStudent ? 'Update student information' : 'Register a new student'}
          </p>
        </div>
        {activeTab !== 'list' && (
          <Button
            variant="outline"
            onClick={() => { setActiveTab('list'); }}
          >
            <ArrowLeft20Regular aria-hidden />
            Back to List
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="hidden">
          <TabsTrigger value="list">Students List</TabsTrigger>
          <TabsTrigger value="form">
            {selectedStudent ? 'Edit Student' : 'Add Student'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0 space-y-3">
          {/* Command bar / toolbar */}
          <div className="rounded-lg bg-surface-default shadow">
            <div className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative w-full lg:w-80">
                <Search20Regular className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
                <Input
                  type="text"
                  aria-label="Search students"
                  placeholder="Search by name, student ID, email, phone, faculty, or batch..."
                  className="h-8 pl-9 pr-8"
                  value={searchStudentId}
                  onChange={e => { setSearchStudentId(e.target.value); }}
                />
                {searchStudentId && (
                  <button
                    type="button"
                    onClick={() => { setSearchStudentId(''); }}
                    className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
                    aria-label="Clear search"
                  >
                    <Dismiss16Regular aria-hidden />
                  </button>
                )}
              </div>

              {/* Dropdown filters */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="filter-faculty">Faculty</label>
                <select
                  id="filter-faculty"
                  className={selectClass}
                  value={selectedFaculty}
                  onChange={e => { setSelectedFaculty(e.target.value); }}
                >
                  <option value="">All Faculties</option>
                  {faculties.map(faculty => (
                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                  ))}
                </select>

                <label className="sr-only" htmlFor="filter-batch">Batch</label>
                <select
                  id="filter-batch"
                  className={selectClass}
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                >
                  <option value="">All Batches</option>
                  {batchOptions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                <label className="sr-only" htmlFor="filter-email">Email Status</label>
                <select
                  id="filter-email"
                  className={selectClass}
                  value={hasEmail}
                  onChange={(e) => setHasEmail(e.target.value as 'any' | 'yes' | 'no')}
                >
                  <option value="any">Any email status</option>
                  <option value="yes">Has Email</option>
                  <option value="no">Missing Email</option>
                </select>

                <label className="sr-only" htmlFor="filter-face">Face registration</label>
                <select
                  id="filter-face"
                  className={selectClass}
                  value={faceFilter}
                  onChange={(e) => setFaceFilter(e.target.value as FaceFilter)}
                >
                  <option value="any">Any face status</option>
                  <option value="registered">Face registered</option>
                  <option value="not_registered">No registered face</option>
                  <option value="reset">Reset — awaiting re-enrolment</option>
                  <option value="deleted">Deleted by student</option>
                </select>

                <Button
                  type="button"
                  variant={showAdvanced ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowAdvanced(v => !v)}
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-filters"
                >
                  <Filter20Regular aria-hidden />
                  Advanced Filters
                  {advancedFilterCount > 0 && (
                    <span className="grid h-4 min-w-[1rem] place-items-center rounded-full bg-brand px-1 text-overline text-brand-on">
                      {advancedFilterCount}
                    </span>
                  )}
                </Button>
              </div>

              <div className="lg:ml-auto">
                <Button onClick={handleAddNewClick} className="w-full lg:w-auto">
                  <PersonAdd20Regular aria-hidden />
                  Add New Student
                </Button>
              </div>
            </div>

            {searchStudentId && (
              <p className="px-4 pb-2 text-caption text-text-muted">
                Searching across: Name • Student ID • Email • Phone • Faculty • Batch
              </p>
            )}

            {/* Advanced Filters panel */}
            {showAdvanced && (
              <div id="advanced-filters" className="border-t border-border-subtle bg-surface-subtle px-4 py-3">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                  <fieldset>
                    <legend className="mb-1.5 text-caption-strong text-text-secondary">Semester</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                        <ChipToggle
                          key={num}
                          active={selectedSemesters.includes(num)}
                          onClick={() => {
                            setSelectedSemesters(prev =>
                              prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                            );
                          }}
                        >
                          {num}
                        </ChipToggle>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-1.5 text-caption-strong text-text-secondary">Year</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 4 }, (_, i) => i + 1).map(num => (
                        <ChipToggle
                          key={num}
                          active={selectedYears.includes(num)}
                          onClick={() => {
                            setSelectedYears(prev =>
                              prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                            );
                          }}
                        >
                          {num}
                        </ChipToggle>
                      ))}
                    </div>
                  </fieldset>

                  {/* Clear filters action */}
                  <div className="md:ml-auto md:self-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFaculty('');
                        setSelectedSemesters([]);
                        setSelectedYears([]);
                        setSelectedBatch('');
                        setHasEmail('any');
                        setFaceFilter('any');
                      }}
                    >
                      <Dismiss16Regular aria-hidden />
                      Clear All Filters
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle px-4 py-2">
                <span className="mr-1 text-caption text-text-muted">Active filters:</span>
                {searchStudentId.trim() && (
                  <FilterTag label={`"${searchStudentId}"`} onRemove={() => setSearchStudentId('')} ariaLabel="Remove search filter" />
                )}
                {selectedFaculty && (
                  <FilterTag
                    label={faculties.find(f => f.id === Number(selectedFaculty))?.name}
                    onRemove={() => setSelectedFaculty('')}
                    ariaLabel="Remove faculty filter"
                  />
                )}
                {selectedSemesters.length > 0 && (
                  <FilterTag
                    label={`Sem: ${selectedSemesters.sort((a,b)=>a-b).join(', ')}`}
                    onRemove={() => setSelectedSemesters([])}
                    ariaLabel="Remove semester filter"
                  />
                )}
                {selectedYears.length > 0 && (
                  <FilterTag
                    label={`Year: ${selectedYears.sort((a,b)=>a-b).join(', ')}`}
                    onRemove={() => setSelectedYears([])}
                    ariaLabel="Remove year filter"
                  />
                )}
                {selectedBatch && (
                  <FilterTag label={`Batch: ${selectedBatch}`} onRemove={() => setSelectedBatch('')} ariaLabel="Remove batch filter" />
                )}
                {hasEmail !== 'any' && (
                  <FilterTag
                    label={hasEmail === 'yes' ? 'Has Email' : 'Missing Email'}
                    onRemove={() => setHasEmail('any')}
                    ariaLabel="Remove email filter"
                  />
                )}
                {faceFilter !== 'any' && (
                  <FilterTag
                    label={FACE_FILTER_LABEL[faceFilter]}
                    onRemove={() => setFaceFilter('any')}
                    ariaLabel="Remove face registration filter"
                  />
                )}
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSearchStudentId('');
                    setSelectedFaculty('');
                    setSelectedSemesters([]);
                    setSelectedYears([]);
                    setSelectedBatch('');
                    setHasEmail('any');
                    setFaceFilter('any');
                  }}
                  className="h-6 px-1.5"
                >
                  Reset All
                </Button>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-caption text-text-muted">
              <People20Regular className="text-text-muted" aria-hidden />
              <span>Showing <strong className="font-semibold text-text-primary tabular-nums">{filteredStudents.length}</strong> of <strong className="font-semibold text-text-primary tabular-nums">{students.length}</strong> students</span>
              {!isLoading && notRegisteredCount > 0 && faceFilter !== 'not_registered' && (
                <>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    onClick={() => setFaceFilter('not_registered')}
                    className="inline-flex items-center gap-1 rounded text-brand-foreground hover:text-brand-foreground-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-text-primary"
                  >
                    <ScanPerson20Regular className="size-4" aria-hidden />
                    <span className="tabular-nums">{notRegisteredCount}</span> without a registered face
                  </button>
                </>
              )}
            </div>

            <StudentTable
              students={filteredStudents}
              onEdit={handleEditStudent}
              onDelete={handleDeleteStudent}
              onFace={setFaceStudent}
              isLoading={isLoading}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSort}
            />
          </div>
        </TabsContent>

        <TabsContent value="form" className="mt-0">
          <StudentFormEnhanced
            onSubmit={onSubmit}
            initialData={selectedStudent}
            isLoading={addStudentMutation.isPending || updateStudentMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      <StudentFaceDialog
        student={
          faceStudent && faceStudent.id
            ? { id: faceStudent.id, name: faceStudent.full_name, studentId: faceStudent.student_id }
            : null
        }
        open={!!faceStudent}
        onOpenChange={(open) => {
          if (!open) setFaceStudent(null);
        }}
      />
    </div>
  );
};

export default StudentsPage;
