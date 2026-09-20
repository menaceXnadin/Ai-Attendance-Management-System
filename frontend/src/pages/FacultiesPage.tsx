import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  TrashCan,
  Add,
  ChevronRight,
  ArrowLeft,
  Book,
  UserMultiple,
  Close,
  WarningAlt,
  Checkmark,
} from '@carbon/icons-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';

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

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Curriculum Breadcrumb" className="flex items-center gap-1.5 text-xs text-text-muted">
        <button
          type="button"
          onClick={resetToFaculties}
          className={`font-medium transition-colors hover:text-text-primary px-1.5 py-0.5 rounded ${
            viewMode === 'faculties' ? 'text-text-primary font-semibold bg-surface-subtle' : ''
          }`}
        >
          Faculties
        </button>
        {selectedFaculty && (
          <>
            <ChevronRight size={14} className="text-text-muted" />
            <button
              type="button"
              onClick={backToSemesters}
              className={`font-medium transition-colors hover:text-text-primary px-1.5 py-0.5 rounded ${
                viewMode === 'semesters' ? 'text-text-primary font-semibold bg-surface-subtle' : ''
              }`}
            >
              {selectedFaculty.name}
            </button>
          </>
        )}
        {selectedSemester && (
          <>
            <ChevronRight size={14} className="text-text-muted" />
            <span className="font-semibold text-text-primary bg-surface-subtle px-1.5 py-0.5 rounded">
              Semester {selectedSemester}
            </span>
          </>
        )}
      </nav>

      {/* Faculty List View */}
      {viewMode === 'faculties' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Faculties & Curriculum
              </h1>
              <p className="text-sm text-text-muted mt-1">
                Manage academic departments, degree programs, and curriculum structures
              </p>
            </div>
            <Button
              onClick={() => setIsAddingFaculty(true)}
              disabled={isAddingFaculty}
              className="flex items-center gap-2"
            >
              <Add size={16} />
              <span>Add Faculty</span>
            </Button>
          </div>

          {/* Add Faculty Form */}
          {isAddingFaculty && (
            <Card className="border border-border-default bg-surface-default shadow-none">
              <CardHeader className="border-b border-border-subtle py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-text-primary">
                      Register New Faculty
                    </CardTitle>
                    <p className="text-xs text-text-muted mt-0.5">
                      Define a new academic division and its standardized 4-letter identifier
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingFaculty(false);
                      setNewFaculty({ name: '', code: '', description: '' });
                    }}
                    disabled={addFacultyMutation.isPending}
                    className="h-8 w-8 p-0 text-text-muted hover:text-text-primary"
                  >
                    <Close size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="facultyName">Faculty Name *</Label>
                    <Input
                      id="facultyName"
                      value={newFaculty.name}
                      onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                      placeholder="e.g. Computer Science & Engineering"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="facultyCode">4-Letter Code *</Label>
                      <span className="text-xs text-text-muted tabular-nums">{newFaculty.code.length}/4</span>
                    </div>
                    <Input
                      id="facultyCode"
                      value={newFaculty.code}
                      onChange={(e) => setNewFaculty({ ...newFaculty, code: e.target.value.toUpperCase() })}
                      placeholder="CSCI"
                      maxLength={4}
                      className="font-mono uppercase tracking-widest"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1.5">
                    <Label htmlFor="facultyDesc">Description (Optional)</Label>
                    <Textarea
                      id="facultyDesc"
                      value={newFaculty.description}
                      onChange={(e) => setNewFaculty({ ...newFaculty, description: e.target.value })}
                      placeholder="Brief overview of programs, degrees, or requirements..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingFaculty(false);
                      setNewFaculty({ name: '', code: '', description: '' });
                    }}
                    disabled={addFacultyMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddFaculty}
                    disabled={addFacultyMutation.isPending}
                  >
                    {addFacultyMutation.isPending ? 'Saving...' : 'Create Faculty'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Faculties Grid */}
          {facultiesLoading ? (
            <div className="p-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {faculties.map((faculty: Faculty) => (
                <Card
                  key={faculty.id}
                  className="border border-border-default bg-surface-default hover:border-action-primary/80 transition-colors cursor-pointer shadow-none flex flex-col justify-between"
                  onClick={() => handleFacultySelect(faculty)}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
                        <UserMultiple size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-text-primary truncate">
                          {faculty.name}
                        </h2>
                        {faculty.code && (
                          <span className="font-mono text-xs text-text-muted mt-0.5 block">
                            {faculty.code}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-text-muted mt-1" />
                    </div>

                    <p className="text-xs text-text-muted line-clamp-2 min-h-[2rem]">
                      {faculty.description || 'No description provided for this faculty.'}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs">
                      <span className="text-text-muted flex items-center gap-1.5 font-medium">
                        <Book size={14} />
                        Curriculum
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFaculty(faculty.id);
                        }}
                        disabled={deleteFacultyMutation.isPending}
                        className="h-7 w-7 p-0 text-text-muted hover:text-status-danger"
                        title="Delete Faculty"
                      >
                        <TrashCan size={14} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Semesters View */}
      {viewMode === 'semesters' && selectedFaculty && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToFaculties}
                className="h-8 px-2.5 flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Faculties</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  {selectedFaculty.name}
                </h1>
                <p className="text-xs text-text-muted">
                  Select a semester to inspect course offerings and credit distribution
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {semesters.map((semester) => {
              const semesterClassCount = subjects.filter((subject) => {
                if (subject.class_schedule && typeof subject.class_schedule === 'object') {
                  const schedule = subject.class_schedule as { semester?: number };
                  return schedule.semester === semester;
                }
                return false;
              }).length;

              return (
                <Card
                  key={semester}
                  className="border border-border-default bg-surface-default hover:border-action-primary/80 transition-colors cursor-pointer shadow-none text-center"
                  onClick={() => handleSemesterSelect(semester)}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="h-10 w-10 mx-auto rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                      <Book size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-text-primary">
                        Semester {semester}
                      </h2>
                      <p className="text-xs text-text-muted mt-1 tabular-nums">
                        {semesterClassCount > 0
                          ? `${semesterClassCount} course${semesterClassCount === 1 ? '' : 's'}`
                          : 'No courses'}
                      </p>
                    </div>
                    <div className="pt-2 flex justify-center text-text-muted">
                      <ChevronRight size={16} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Classes View */}
      {viewMode === 'classes' && selectedFaculty && selectedSemester && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={backToSemesters}
                className="h-8 px-2.5 flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Semesters</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  {selectedFaculty.name} — Semester {selectedSemester}
                </h1>
                <p className="text-xs text-text-muted">
                  Course catalog and credit hour distribution
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsAddingClass(true)}
              disabled={isAddingClass}
              className="flex items-center gap-2"
            >
              <Add size={16} />
              <span>Add Course</span>
            </Button>
          </div>

          {/* Add Course Form */}
          {isAddingClass && (
            <Card className="border border-border-default bg-surface-default shadow-none">
              <CardHeader className="border-b border-border-subtle py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-text-primary">
                      Add New Course
                    </CardTitle>
                    <p className="text-xs text-text-muted mt-0.5">
                      Register a course for {selectedFaculty.name}, Semester {selectedSemester}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingClass(false);
                      setNewClass({ name: '', code: '', description: '', credits: 3 });
                    }}
                    disabled={addSubjectMutation.isPending}
                    className="h-8 w-8 p-0 text-text-muted hover:text-text-primary"
                  >
                    <Close size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="courseName">Course Title *</Label>
                    <Input
                      id="courseName"
                      value={newClass.name}
                      onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                      placeholder="e.g. Data Structures and Algorithms"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="courseCode">Course Code *</Label>
                    <Input
                      id="courseCode"
                      value={newClass.code}
                      onChange={(e) => setNewClass({ ...newClass, code: e.target.value.toUpperCase() })}
                      placeholder="CS201"
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="courseDesc">Description (Optional)</Label>
                    <Textarea
                      id="courseDesc"
                      value={newClass.description}
                      onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                      placeholder="Course overview, prerequisites, or topics covered..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="courseCredits">Credit Hours</Label>
                    <Input
                      id="courseCredits"
                      type="number"
                      min={1}
                      max={6}
                      value={newClass.credits}
                      onChange={(e) => setNewClass({ ...newClass, credits: parseInt(e.target.value, 10) || 3 })}
                      className="tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingClass(false);
                      setNewClass({ name: '', code: '', description: '', credits: 3 });
                    }}
                    disabled={addSubjectMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddClass}
                    disabled={addSubjectMutation.isPending}
                  >
                    {addSubjectMutation.isPending ? 'Adding...' : 'Add Course'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Classes Table */}
          <div className="bg-surface-default border border-border-default rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Course Catalog</h2>
                <p className="text-xs text-text-muted">
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
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border-default bg-surface-subtle">
                      <TableHead className="w-[120px] text-xs font-semibold text-text-muted uppercase">Code</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Course Title</TableHead>
                      <TableHead className="w-[100px] text-xs font-semibold text-text-muted uppercase">Credits</TableHead>
                      <TableHead className="text-xs font-semibold text-text-muted uppercase">Description</TableHead>
                      <TableHead className="w-[80px] text-right text-xs font-semibold text-text-muted uppercase">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semesterSubjects.map((subject: Subject) => (
                      <TableRow key={subject.id} className="h-11 border-b border-border-subtle hover:bg-surface-subtle/50">
                        <TableCell className="font-mono text-xs font-semibold text-text-secondary">
                          <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                            {subject.code}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-text-primary text-sm">
                          {subject.name}
                        </TableCell>
                        <TableCell className="text-xs text-text-secondary tabular-nums">
                          {subject.credits} hrs
                        </TableCell>
                        <TableCell className="text-xs text-text-muted max-w-md truncate">
                          {subject.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClass(subject.id, subject.name)}
                            disabled={deleteSubjectMutation.isPending}
                            className="h-8 w-8 p-0 text-text-muted hover:text-status-danger"
                            title="Delete Course"
                          >
                            <TrashCan size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
            <DialogTitle className="flex items-center gap-2 text-status-danger">
              <WarningAlt size={20} />
              <span>Confirm Faculty Deletion</span>
            </DialogTitle>
            <DialogDescription>
              You are about to delete <strong className="text-text-primary">{deletingFaculty?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {isLoadingPreview ? (
            <div className="py-6 text-center text-xs text-text-muted">
              Analyzing cascade deletion impact...
            </div>
          ) : cascadePreview ? (
            <div className="space-y-4 py-2">
              {!cascadePreview.is_safe_to_delete && (
                <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <WarningAlt size={14} />
                    High Impact Warning
                  </p>
                  <p>{cascadePreview.warning || 'This faculty has active student enrollments.'}</p>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Records Permanently Deleted
                </h3>
                <div className="rounded-md border border-border-default divide-y divide-border-subtle bg-surface-subtle/30 text-xs">
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-text-secondary">Students</span>
                    <span className="font-mono font-semibold text-status-danger tabular-nums">
                      {cascadePreview.will_delete.students.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-text-secondary">Courses / Subjects</span>
                    <span className="font-mono font-semibold text-status-danger tabular-nums">
                      {cascadePreview.will_delete.subjects.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-text-secondary">Attendance Records</span>
                    <span className="font-mono font-semibold text-status-danger tabular-nums">
                      {cascadePreview.will_delete.attendance_records.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {cascadePreview.is_safe_to_delete && (
                <div className="p-3 rounded-md bg-status-success/10 border border-status-success/20 text-status-success text-xs flex items-center gap-2">
                  <Checkmark size={16} />
                  <span>No students enrolled. Safe to proceed with deletion.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
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
                  onClick={confirmDeleteFaculty}
                  disabled={deleteFacultyMutation.isPending}
                  className="bg-status-danger text-white hover:bg-status-danger/90"
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
