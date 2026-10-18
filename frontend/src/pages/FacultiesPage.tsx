import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Add20Regular,
  Delete20Regular,
  ChevronRight16Regular,
  ChevronRight20Regular,
  ChevronDown16Regular,
  ArrowLeft20Regular,
  Book16Regular,
  BookAdd20Regular,
  BuildingMultiple24Regular,
  NumberSymbol16Regular,
  NumberSymbol20Regular,
  Dismiss20Regular,
  MoreHorizontal20Regular,
  Warning24Regular,
  Warning20Regular,
  CheckmarkCircle20Regular,
} from '@fluentui/react-icons';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
 * Teams "teams & channels" presentation helpers
 * ------------------------------------------------------------------------- */

const TILE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

const STOP_WORDS = new Set(['of', 'and', '&', 'the', 'for', 'in']);

const tileInitials = (name?: string, code?: string) => {
  const words = (name || '').split(/\s+/).filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (code || '?').slice(0, 2).toUpperCase();
};

/** Square, colored team tile with initials (Teams team avatar). */
const FacultyTile: React.FC<{ id: number; name?: string; code?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  id,
  name,
  code,
  size = 'md',
}) => (
  <span
    aria-hidden
    className={cn(
      'grid shrink-0 place-items-center rounded-md font-semibold text-text-inverse',
      size === 'sm' && 'h-6 w-6 text-overline',
      size === 'md' && 'h-10 w-10 text-body-strong',
      size === 'lg' && 'h-14 w-14 text-section-title'
    )}
    style={{ background: TILE_COLORS[Math.abs(Number(id) || 0) % TILE_COLORS.length] }}
  >
    {tileInitials(name, code)}
  </span>
);

const fieldLabelClass = 'text-body-strong text-text-primary';
const tableHeadClass = 'h-9 text-caption-strong text-text-secondary';
const RequiredMark = () => <span className="text-status-error" aria-hidden> *</span>;

interface Faculty {
  id: number;
  name: string;
  code?: string;
  description?: string;
  created_at: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
  credits: number;
  faculty_id: number;
  class_schedule?: {
    semester?: number;
    days?: string[];
    time?: string;
    faculty?: string;
  };
}

interface CascadePreview {
  is_safe_to_delete: boolean;
  warning?: string;
  will_delete: {
    students: number;
    subjects: number;
    attendance_records: number;
  };
  will_orphan: {
    academic_events: number;
  };
}

type ViewMode = 'faculties' | 'semesters' | 'classes';

const FacultiesPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('faculties');
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [newFaculty, setNewFaculty] = useState({ name: '', code: '', description: '' });
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', code: '', description: '', credits: 3 });
  const [deletingFaculty, setDeletingFaculty] = useState<Faculty | null>(null);
  const [cascadePreview, setCascadePreview] = useState<CascadePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch faculties
  const { data: faculties = [], isLoading: facultiesLoading } = useQuery<Faculty[]>({
    queryKey: ['faculties'],
    queryFn: async () => {
      const response = await api.faculties.getAll();
      return (response as unknown as Faculty[]) || [];
    },
  });

  // Fetch subjects for selected faculty
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<Subject[]>({
    queryKey: ['subjects', selectedFaculty?.id],
    queryFn: async () => {
      if (!selectedFaculty) return [];
      const response = await api.subjects.getByFaculty(selectedFaculty.id);
      return (response as unknown as Subject[]) || [];
    },
    enabled: !!selectedFaculty,
  });

  // Add faculty mutation
  const addFacultyMutation = useMutation({
    mutationFn: async (facultyData: { name: string; code: string; description?: string }) => {
      return await api.faculties.create(facultyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      setIsAddingFaculty(false);
      setNewFaculty({ name: '', code: '', description: '' });
      toast({
        title: 'Faculty Added',
        description: 'The faculty has been successfully registered.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to add faculty: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete faculty mutation
  const deleteFacultyMutation = useMutation({
    mutationFn: async ({ facultyId, force }: { facultyId: number; force: boolean }) => {
      return await api.faculties.delete(facultyId, force);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      setDeletingFaculty(null);
      setCascadePreview(null);
      toast({
        title: 'Faculty Deleted',
        description: 'The faculty and its cascade references were removed.',
      });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete faculty',
        variant: 'destructive',
      });
    },
  });

  // Add subject mutation
  const addSubjectMutation = useMutation({
    mutationFn: async (subjectData: {
      name: string;
      code: string;
      description?: string;
      credits: number;
      faculty_id: number;
    }) => {
      return await api.subjects.create(subjectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', selectedFaculty?.id] });
      setIsAddingClass(false);
      setNewClass({ name: '', code: '', description: '', credits: 3 });
      toast({
        title: 'Class Added',
        description: 'The course has been successfully added to curriculum.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to add course: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (subjectId: number) => {
      return await api.subjects.delete(subjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', selectedFaculty?.id] });
      toast({
        title: 'Class Deleted',
        description: 'The course has been successfully removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete course: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleAddFaculty = () => {
    if (!newFaculty.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Faculty name is required.',
        variant: 'destructive',
      });
      return;
    }
    if (!newFaculty.code.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Faculty code is required.',
        variant: 'destructive',
      });
      return;
    }
    if (newFaculty.code.length !== 4 || !/^[A-Z]+$/.test(newFaculty.code)) {
      toast({
        title: 'Validation Error',
        description: 'Faculty code must be exactly 4 uppercase letters (e.g., CSCI, MATH).',
        variant: 'destructive',
      });
      return;
    }
    addFacultyMutation.mutate(newFaculty);
  };

  const handleDeleteFaculty = async (facultyId: number) => {
    const faculty = faculties.find((f: Faculty) => f.id === facultyId);
    if (!faculty) return;

    setDeletingFaculty(faculty);
    setIsLoadingPreview(true);

    try {
      const preview = (await api.faculties.getCascadePreview(facultyId)) as unknown as CascadePreview;
      setCascadePreview(preview);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load deletion cascade preview.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const confirmDeleteFaculty = () => {
    if (!deletingFaculty) return;
    deleteFacultyMutation.mutate({
      facultyId: deletingFaculty.id,
      force: true,
    });
  };

  const handleFacultySelect = (faculty: Faculty) => {
    setSelectedFaculty(faculty);
    setViewMode('semesters');
  };

  const handleSemesterSelect = (semester: number) => {
    setSelectedSemester(semester);
    setViewMode('classes');
  };

  const handleAddClass = () => {
    if (!newClass.name.trim() || !newClass.code.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Course name and code are required.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFaculty) {
      toast({
        title: 'Validation Error',
        description: 'No faculty selected.',
        variant: 'destructive',
      });
      return;
    }

    addSubjectMutation.mutate({
      ...newClass,
      faculty_id: selectedFaculty.id,
    });
  };

  const handleDeleteClass = (subjectId: number, className: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete course "${className}"?`);
    if (confirmed) {
      deleteSubjectMutation.mutate(subjectId);
    }
  };

  const resetToFaculties = () => {
    setViewMode('faculties');
    setSelectedFaculty(null);
    setSelectedSemester(null);
  };

  const backToSemesters = () => {
    setViewMode('semesters');
    setSelectedSemester(null);
  };

  const semesterSubjects = subjects.filter((subject) => {
    if (subject.class_schedule && typeof subject.class_schedule === 'object') {
      const schedule = subject.class_schedule as { semester?: number };
      return schedule.semester === selectedSemester;
    }
    return false;
  });

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  // Course count per semester (same rule as the semester filter above)
  const countForSemester = (semester: number) =>
    subjects.filter((subject) => {
      if (subject.class_schedule && typeof subject.class_schedule === 'object') {
        const schedule = subject.class_schedule as { semester?: number };
        return schedule.semester === semester;
      }
      return false;
    }).length;

  const cancelAddFaculty = () => {
    setIsAddingFaculty(false);
    setNewFaculty({ name: '', code: '', description: '' });
  };

  const cancelAddClass = () => {
    setIsAddingClass(false);
    setNewClass({ name: '', code: '', description: '', credits: 3 });
  };

  const breadcrumbItemClass =
    'rounded px-1.5 py-0.5 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover hover:text-text-primary';

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Curriculum Breadcrumb" className="flex flex-wrap items-center gap-1 text-body text-text-muted">
        <button
          type="button"
          onClick={resetToFaculties}
          aria-current={viewMode === 'faculties' ? 'page' : undefined}
          className={cn(breadcrumbItemClass, viewMode === 'faculties' && 'font-semibold text-text-primary')}
        >
          Faculties
        </button>
        {selectedFaculty && (
          <>
            <ChevronRight16Regular className="text-text-muted" aria-hidden />
            <button
              type="button"
              onClick={backToSemesters}
              aria-current={viewMode === 'semesters' ? 'page' : undefined}
              className={cn(breadcrumbItemClass, viewMode === 'semesters' && 'font-semibold text-text-primary')}
            >
              {selectedFaculty.name}
            </button>
          </>
        )}
        {selectedSemester && (
          <>
            <ChevronRight16Regular className="text-text-muted" aria-hidden />
            <span aria-current="page" className="px-1.5 py-0.5 font-semibold text-text-primary">
              Semester {selectedSemester}
            </span>
          </>
        )}
      </nav>

      {/* Faculty List View */}
      {viewMode === 'faculties' && (
        <div className="space-y-4">
          <div className="page-header !mb-0">
            <div>
              <h1 className="text-page-title text-text-primary">
                Faculties & Curriculum
              </h1>
              <p className="mt-1 text-body text-text-muted">
                Manage academic departments, degree programs, and curriculum structures
              </p>
            </div>
            <Button onClick={() => setIsAddingFaculty(true)} disabled={isAddingFaculty}>
              <Add20Regular aria-hidden />
              <span>Add Faculty</span>
            </Button>
          </div>

          {/* Add Faculty Form */}
          {isAddingFaculty && (
            <section aria-label="Register New Faculty" className="rounded-lg bg-surface-default shadow">
              <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                    <BuildingMultiple24Regular aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-subheading text-text-primary">Register New Faculty</h2>
                    <p className="text-caption text-text-muted">
                      Define a new academic division and its standardized 4-letter identifier
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelAddFaculty}
                  disabled={addFacultyMutation.isPending}
                  className="h-8 w-8 p-0 text-text-secondary"
                  aria-label="Close"
                >
                  <Dismiss20Regular aria-hidden />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="facultyName" className={fieldLabelClass}>Faculty Name<RequiredMark /></Label>
                  <Input
                    id="facultyName"
                    value={newFaculty.name}
                    onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                    placeholder="e.g. Computer Science & Engineering"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="facultyCode" className={fieldLabelClass}>4-Letter Code<RequiredMark /></Label>
                    <span className="text-caption text-text-muted tabular-nums">{newFaculty.code.length}/4</span>
                  </div>
                  <Input
                    id="facultyCode"
                    value={newFaculty.code}
                    onChange={(e) => setNewFaculty({ ...newFaculty, code: e.target.value.toUpperCase() })}
                    placeholder="CSCI"
                    maxLength={4}
                    className="font-mono uppercase tracking-wider"
                  />
                  <p className="text-caption text-text-muted">Exactly 4 uppercase letters, e.g. CSCI or MATH.</p>
                </div>
                <div className="col-span-1 space-y-1.5 sm:col-span-2">
                  <Label htmlFor="facultyDesc" className={fieldLabelClass}>Description (Optional)</Label>
                  <Textarea
                    id="facultyDesc"
                    value={newFaculty.description}
                    onChange={(e) => setNewFaculty({ ...newFaculty, description: e.target.value })}
                    placeholder="Brief overview of programs, degrees, or requirements..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
                <Button variant="outline" onClick={cancelAddFaculty} disabled={addFacultyMutation.isPending}>
                  Cancel
                </Button>
                <Button onClick={handleAddFaculty} disabled={addFacultyMutation.isPending}>
                  {addFacultyMutation.isPending ? 'Saving...' : 'Create Faculty'}
                </Button>
              </div>
            </section>
          )}

          {/* Faculties list (Teams "your teams") */}
          {facultiesLoading ? (
            <div className="rounded-lg bg-surface-default p-4 shadow">
              <LoadingState rows={4} columns={3} />
            </div>
          ) : faculties.length === 0 ? (
            <EmptyState
              title="No faculties configured yet"
              description="Get started by registering your first academic department."
              actionLabel="Add Faculty"
              onAction={() => setIsAddingFaculty(true)}
            />
          ) : (
            <section aria-label="Faculties" className="overflow-hidden rounded-lg bg-surface-default shadow">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-body-strong text-text-primary">
                  Your faculties
                  <Badge variant="secondary" shape="pill" className="tabular-nums">{faculties.length}</Badge>
                </h2>
                <span className="hidden text-caption text-text-muted sm:inline">
                  Select a faculty to browse semesters and courses
                </span>
              </div>
              <ul className="divide-y divide-border-subtle">
                {faculties.map((faculty: Faculty) => (
                  <li key={faculty.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleFacultySelect(faculty)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleFacultySelect(faculty);
                        }
                      }}
                      className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
                    >
                      <FacultyTile id={faculty.id} name={faculty.name} code={faculty.code} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="truncate text-body-strong text-text-primary">{faculty.name}</h3>
                          {faculty.code && (
                            <Badge variant="secondary" className="shrink-0 font-mono">
                              {faculty.code}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-caption text-text-muted">
                          {faculty.description || 'No description provided for this faculty.'}
                        </p>
                      </div>
                      <span className="hidden items-center gap-1.5 text-caption text-text-muted md:inline-flex">
                        <Book16Regular aria-hidden />
                        Curriculum
                      </span>
                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-text-secondary"
                              title="More options"
                              aria-label={`More options for ${faculty.name}`}
                            >
                              <MoreHorizontal20Regular aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onSelect={() => handleFacultySelect(faculty)}
                              className="gap-2"
                            >
                              <NumberSymbol16Regular className="text-text-muted" aria-hidden />
                              Open semesters
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleDeleteFaculty(faculty.id)}
                              disabled={deleteFacultyMutation.isPending}
                              className="gap-2 text-status-error focus:bg-status-error-subtle focus:text-status-error"
                            >
                              <Delete20Regular className="h-4 w-4" aria-hidden />
                              Delete Faculty
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <ChevronRight20Regular className="shrink-0 text-text-muted" aria-hidden />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Faculty workspace: teams & channels pane + content */}
      {(viewMode === 'semesters' || viewMode === 'classes') && selectedFaculty && (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Teams & channels pane */}
          <aside
            aria-label="Faculties and semesters"
            className="self-start overflow-hidden rounded-lg bg-surface-default shadow"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-2 py-2">
              <button
                type="button"
                onClick={resetToFaculties}
                className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-body-strong text-text-primary transition-colors duration-150 hover:bg-surface-hover"
              >
                <ArrowLeft20Regular className="h-4 w-4" aria-hidden />
                Faculties
              </button>
              <Badge variant="secondary" shape="pill" className="tabular-nums">{faculties.length}</Badge>
            </div>
            <nav className="max-h-[70vh] space-y-0.5 overflow-y-auto p-1.5">
              {faculties.map((faculty: Faculty) => {
                const isSelected = faculty.id === selectedFaculty.id;
                return (
                  <div key={faculty.id}>
                    <button
                      type="button"
                      aria-expanded={isSelected}
                      onClick={() => {
                        backToSemesters();
                        if (!isSelected) handleFacultySelect(faculty);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors duration-150 ease-fluent-standard',
                        isSelected && viewMode === 'semesters'
                          ? 'bg-surface-selected'
                          : 'hover:bg-surface-hover'
                      )}
                    >
                      {isSelected ? (
                        <ChevronDown16Regular className="shrink-0 text-text-muted" aria-hidden />
                      ) : (
                        <ChevronRight16Regular className="shrink-0 text-text-muted" aria-hidden />
                      )}
                      <FacultyTile id={faculty.id} name={faculty.name} code={faculty.code} size="sm" />
                      <span
                        className={cn(
                          'truncate text-body',
                          isSelected ? 'font-semibold text-text-primary' : 'text-text-secondary'
                        )}
                      >
                        {faculty.name}
                      </span>
                    </button>
                    {isSelected && (
                      <ul className="mb-1 mt-0.5 space-y-0.5">
                        {semesters.map((semester) => {
                          const count = countForSemester(semester);
                          const active = viewMode === 'classes' && selectedSemester === semester;
                          return (
                            <li key={semester}>
                              <button
                                type="button"
                                onClick={() => handleSemesterSelect(semester)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-md py-1.5 pl-[2.75rem] pr-2 text-left text-body transition-colors duration-150 ease-fluent-standard',
                                  active
                                    ? 'bg-brand-subtle font-semibold text-brand-foreground'
                                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                                )}
                              >
                                <NumberSymbol16Regular className="shrink-0" aria-hidden />
                                <span className="flex-1 truncate">Semester {semester}</span>
                                {count > 0 && (
                                  <span className="rounded-full bg-surface-subtle px-1.5 text-caption text-text-muted tabular-nums">
                                    {count}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-4">
            {/* Semesters View */}
            {viewMode === 'semesters' && (
              <>
                <div className="flex flex-col gap-4 rounded-lg bg-surface-default p-5 shadow sm:flex-row sm:items-center">
                  <FacultyTile id={selectedFaculty.id} name={selectedFaculty.name} code={selectedFaculty.code} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-page-title text-text-primary">
                        {selectedFaculty.name}
                      </h1>
                      {selectedFaculty.code && (
                        <Badge variant="secondary" className="font-mono">{selectedFaculty.code}</Badge>
                      )}
                    </div>
                    <p className="text-body text-text-muted">
                      Select a semester to inspect course offerings and credit distribution
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetToFaculties} className="self-start sm:self-center">
                    <ArrowLeft20Regular aria-hidden />
                    <span>Faculties</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {semesters.map((semester) => {
                    const semesterClassCount = countForSemester(semester);

                    return (
                      <button
                        key={semester}
                        type="button"
                        onClick={() => handleSemesterSelect(semester)}
                        className="group flex flex-col items-start gap-3 rounded-lg bg-surface-default p-4 text-left shadow transition-shadow duration-150 ease-fluent-standard hover:shadow-md"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                            <NumberSymbol20Regular aria-hidden />
                          </span>
                          <ChevronRight16Regular className="text-text-muted" aria-hidden />
                        </div>
                        <div>
                          <h2 className="text-body-strong text-text-primary">
                            Semester {semester}
                          </h2>
                          <p className="text-caption text-text-muted tabular-nums">
                            {semesterClassCount > 0
                              ? `${semesterClassCount} course${semesterClassCount === 1 ? '' : 's'}`
                              : 'No courses'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Classes View */}
            {viewMode === 'classes' && selectedSemester && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={backToSemesters}>
                      <ArrowLeft20Regular aria-hidden />
                      <span>Semesters</span>
                    </Button>
                    <div className="min-w-0">
                      <h1 className="text-section-title text-text-primary">
                        {selectedFaculty.name} — Semester {selectedSemester}
                      </h1>
                      <p className="text-caption text-text-muted">
                        Course catalog and credit hour distribution
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setIsAddingClass(true)} disabled={isAddingClass}>
                    <Add20Regular aria-hidden />
                    <span>Add Course</span>
                  </Button>
                </div>

                {/* Add Course Form */}
                {isAddingClass && (
                  <section aria-label="Add New Course" className="rounded-lg bg-surface-default shadow">
                    <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                          <BookAdd20Regular aria-hidden />
                        </div>
                        <div>
                          <h2 className="text-subheading text-text-primary">Add New Course</h2>
                          <p className="text-caption text-text-muted">
                            Register a course for {selectedFaculty.name}, Semester {selectedSemester}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelAddClass}
                        disabled={addSubjectMutation.isPending}
                        className="h-8 w-8 p-0 text-text-secondary"
                        aria-label="Close"
                      >
                        <Dismiss20Regular aria-hidden />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="courseName" className={fieldLabelClass}>Course Title<RequiredMark /></Label>
                        <Input
                          id="courseName"
                          value={newClass.name}
                          onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                          placeholder="e.g. Data Structures and Algorithms"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="courseCode" className={fieldLabelClass}>Course Code<RequiredMark /></Label>
                        <Input
                          id="courseCode"
                          value={newClass.code}
                          onChange={(e) => setNewClass({ ...newClass, code: e.target.value.toUpperCase() })}
                          placeholder="CS201"
                          className="font-mono uppercase"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="courseDesc" className={fieldLabelClass}>Description (Optional)</Label>
                        <Textarea
                          id="courseDesc"
                          value={newClass.description}
                          onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                          placeholder="Course overview, prerequisites, or topics covered..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="courseCredits" className={fieldLabelClass}>Credit Hours</Label>
                        <Input
                          id="courseCredits"
                          type="number"
                          min={1}
                          max={6}
                          value={newClass.credits}
                          onChange={(e) => setNewClass({ ...newClass, credits: parseInt(e.target.value, 10) || 3 })}
                          className="tabular-nums"
                        />
                        <p className="text-caption text-text-muted">Between 1 and 6 hours.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
                      <Button variant="outline" onClick={cancelAddClass} disabled={addSubjectMutation.isPending}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddClass} disabled={addSubjectMutation.isPending}>
                        {addSubjectMutation.isPending ? 'Adding...' : 'Add Course'}
                      </Button>
                    </div>
                  </section>
                )}

                {/* Classes Table */}
                <section aria-label="Course Catalog" className="overflow-hidden rounded-lg bg-surface-default shadow">
                  <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                    <div>
                      <h2 className="text-body-strong text-text-primary">Course Catalog</h2>
                      <p className="text-caption text-text-muted tabular-nums">
                        {semesterSubjects.length} course{semesterSubjects.length === 1 ? '' : 's'} registered
                      </p>
                    </div>
                  </div>

                  {subjectsLoading ? (
                    <div className="p-4">
                      <LoadingState rows={4} columns={5} />
                    </div>
                  ) : semesterSubjects.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        title="No courses registered for this semester"
                        description="Begin building the curriculum by adding your first course."
                        actionLabel="Add Course"
                        onAction={() => setIsAddingClass(true)}
                        className="border-0"
                      />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                            <TableHead className={cn(tableHeadClass, 'w-[120px] pl-4')}>Code</TableHead>
                            <TableHead className={tableHeadClass}>Course Title</TableHead>
                            <TableHead className={cn(tableHeadClass, 'w-[100px]')}>Credits</TableHead>
                            <TableHead className={tableHeadClass}>Description</TableHead>
                            <TableHead className={cn(tableHeadClass, 'w-[80px] pr-4 text-right')}>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {semesterSubjects.map((subject: Subject) => (
                            <TableRow
                              key={subject.id}
                              className="border-b border-border-subtle transition-colors duration-150 hover:bg-surface-hover"
                            >
                              <TableCell className="py-2.5 pl-4">
                                <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-caption-strong text-text-secondary">
                                  {subject.code}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-body-strong text-text-primary">
                                {subject.name}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant="secondary" className="tabular-nums">
                                  {subject.credits} hrs
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-md truncate py-2.5 text-body text-text-muted">
                                {subject.description || '—'}
                              </TableCell>
                              <TableCell className="py-2.5 pr-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClass(subject.id, subject.name)}
                                  disabled={deleteSubjectMutation.isPending}
                                  className="h-8 w-8 p-0 text-text-secondary hover:bg-status-error-subtle hover:text-status-error"
                                  title="Delete Course"
                                  aria-label={`Delete course ${subject.name}`}
                                >
                                  <Delete20Regular aria-hidden />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cascade Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingFaculty)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingFaculty(null);
            setCascadePreview(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-status-error-subtle text-status-error">
                <Warning24Regular aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-section-title text-text-primary">
                  Confirm Faculty Deletion
                </DialogTitle>
                <DialogDescription className="mt-1 text-body text-text-muted">
                  You are about to delete <strong className="font-semibold text-text-primary">{deletingFaculty?.name}</strong>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {isLoadingPreview ? (
            <div className="flex items-center justify-center gap-2 py-6 text-body text-text-muted" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-brand" aria-hidden />
              Analyzing cascade deletion impact...
            </div>
          ) : cascadePreview ? (
            <div className="space-y-4 py-1">
              {!cascadePreview.is_safe_to_delete && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2 text-body text-text-primary"
                >
                  <Warning20Regular className="mt-0.5 shrink-0 text-status-error" aria-hidden />
                  <div>
                    <p className="font-semibold">High Impact Warning</p>
                    <p className="text-text-secondary">{cascadePreview.warning || 'This faculty has active student enrollments.'}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-caption-strong text-text-secondary">
                  Records Permanently Deleted
                </h3>
                <dl className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface-subtle text-body">
                  <div className="flex items-center justify-between px-3 py-2">
                    <dt className="text-text-secondary">Students</dt>
                    <dd className="font-semibold text-status-error tabular-nums">
                      {cascadePreview.will_delete.students.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <dt className="text-text-secondary">Courses / Subjects</dt>
                    <dd className="font-semibold text-status-error tabular-nums">
                      {cascadePreview.will_delete.subjects.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <dt className="text-text-secondary">Attendance Records</dt>
                    <dd className="font-semibold text-status-error tabular-nums">
                      {cascadePreview.will_delete.attendance_records.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>

              {cascadePreview.is_safe_to_delete && (
                <div className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2 text-body text-text-primary">
                  <CheckmarkCircle20Regular className="shrink-0 text-status-success" aria-hidden />
                  <span>No students enrolled. Safe to proceed with deletion.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeletingFaculty(null);
                    setCascadePreview(null);
                  }}
                  disabled={deleteFacultyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteFaculty}
                  disabled={deleteFacultyMutation.isPending}
                >
                  {deleteFacultyMutation.isPending ? 'Deleting...' : 'Delete Faculty'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FacultiesPage;
