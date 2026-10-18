import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowSync16Regular,
  Book16Regular,
  ClipboardTaskListLtr24Regular,
  Dismiss16Regular,
  HatGraduation20Regular,
  People16Regular,
  People24Regular,
  Search16Regular,
  Search20Regular,
} from '@fluentui/react-icons';
import { api } from '@/integrations/api/client';
import type { Student } from '@/integrations/api/types';
import { EmptyState } from '@/components/feedback/EmptyState';
import DateSessionRegister from '@/components/attendance-admin/DateSessionRegister';
import StudentDayAttendance from '@/components/attendance-admin/StudentDayAttendance';
import { getInitials, localToday } from '@/components/attendance-admin/shared';

interface Faculty {
  id: number;
  name: string;
  description?: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
  credits?: number;
  faculty_id?: number;
  semester?: number;
}

interface StudentOption {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  faculty_id: number;
  faculty?: string;
}

const toOption = (s: Student): StudentOption => {
  const raw = s as Student & { full_name?: string };
  const id = Number(s.id);
  return {
    id: Number.isFinite(id) ? id : 0,
    student_id: s.studentId || s.student_id || '—',
    name: s.name || raw.full_name || 'Unknown',
    email: s.email || '',
    semester: Number(s.semester) || 1,
    faculty_id: Number(s.faculty_id) || 0,
    faculty: s.faculty,
  };
};

/**
 * Admin attendance management (contract v1).
 * - By subject: resolves the class session(s) on the chosen date and opens the
 *   session register (only changed rows are submitted; unmarked = "Not marked").
 * - By student: the student's record in every session of their cohort that day,
 *   corrected one record at a time (admin single write).
 * The removed `/attendance/mark-bulk` cascade is no longer used anywhere.
 */
const EnhancedAttendanceManagement = () => {
  const queryClient = useQueryClient();

  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(localToday());
  const [viewMode, setViewMode] = useState<'subject' | 'student'>('subject');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const facultiesQuery = useQuery({
    queryKey: ['faculties'],
    queryFn: () => api.faculties.getAll(),
    retry: 1,
  });
  const faculties: Faculty[] = Array.isArray(facultiesQuery.data) ? (facultiesQuery.data as Faculty[]) : [];

  const subjectsQuery = useQuery({
    queryKey: ['subjects', Number(selectedFaculty), selectedSemester ? Number(selectedSemester) : null],
    queryFn: () =>
      api.subjects.getByFacultySemester(Number(selectedFaculty), selectedSemester ? Number(selectedSemester) : undefined),
    enabled: Boolean(selectedFaculty),
  });
  const subjects: Subject[] = Array.isArray(subjectsQuery.data) ? (subjectsQuery.data as Subject[]) : [];

  // One student list serves both the cohort selector and the global quick search.
  const studentsQuery = useQuery({
    queryKey: ['students', 'all-for-attendance'],
    queryFn: () => api.students.getAll(),
    enabled: viewMode === 'student' || debouncedSearch.length > 0,
    staleTime: 60_000,
  });
  const allStudents = useMemo<StudentOption[]>(
    () => (Array.isArray(studentsQuery.data) ? studentsQuery.data.map(toOption) : []),
    [studentsQuery.data]
  );

  const cohortStudents = useMemo(
    () =>
      allStudents.filter(
        (s) => s.faculty_id === Number(selectedFaculty) && s.semester === Number(selectedSemester)
      ),
    [allStudents, selectedFaculty, selectedSemester]
  );

  const quickResults = useMemo(() => {
    if (!debouncedSearch) return [];
    const q = debouncedSearch.toLowerCase();
    return allStudents
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.student_id.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.faculty ?? '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [allStudents, debouncedSearch]);

  const handleFacultyChange = (value: string) => {
    setSelectedFaculty(value);
    setSelectedSemester('');
    setSelectedSubject('');
    setSelectedStudent('');
  };

  const handleSemesterChange = (value: string) => {
    setSelectedSemester(value);
    setSelectedSubject('');
    setSelectedStudent('');
  };

  const handleViewModeChange = (mode: 'subject' | 'student') => {
    setViewMode(mode);
    setSelectedSubject('');
    setSelectedStudent('');
  };

  const pickFromSearch = (s: StudentOption) => {
    if (!s.faculty_id) return;
    setSelectedFaculty(String(s.faculty_id));
    setSelectedSemester(String(s.semester));
    setSelectedSubject('');
    setViewMode('student');
    setSelectedStudent(String(s.id));
    setSearchQuery('');
    setDebouncedSearch('');
  };

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['faculties'] });
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    void queryClient.invalidateQueries({ queryKey: ['students', 'all-for-attendance'] });
    void queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['session-register'] });
  };

  const selectedFacultyName = faculties.find((f) => String(f.id) === selectedFaculty)?.name || '';
  const selectedSubjectName = subjects.find((s) => String(s.id) === selectedSubject)?.name || '';
  const selectedStudentData = cohortStudents.find((s) => String(s.id) === selectedStudent);

  const chip = (label: string, value: React.ReactNode) => (
    <span className="rounded-full border border-border-subtle bg-surface-default px-2 py-0.5">
      <strong className="font-semibold text-text-primary">{label}:</strong> {value}
    </span>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-section-title text-text-primary">Attendance Management</h2>
        <p className="mt-1 text-body text-text-muted">
          Record or correct attendance per class session — by subject register or by individual student.
        </p>
      </div>

      {/* Quick Search */}
      <section className="rounded-lg bg-surface-default shadow">
        <header className="border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Search20Regular className="text-brand-foreground" aria-hidden />
            <h3 className="text-subheading text-text-primary">Quick Student Search</h3>
          </div>
          <p className="mt-1 text-caption text-text-muted">
            Search students across all faculties and semesters by name, student ID, email, or department
          </p>
        </header>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Search16Regular
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <Input
              type="text"
              aria-label="Quick student search"
              placeholder="Search by student name, ID, email, or faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-text-muted transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover hover:text-text-primary"
              >
                <Dismiss16Regular aria-hidden />
              </button>
            )}
            {studentsQuery.isFetching && debouncedSearch && (
              <div className="absolute right-9 top-1/2 -translate-y-1/2">
                <ArrowSync16Regular className="animate-spin text-brand-foreground" aria-hidden />
              </div>
            )}
          </div>

          {debouncedSearch && (
            <div>
              {quickResults.length === 0 && !studentsQuery.isFetching ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                    <People24Regular aria-hidden />
                  </div>
                  <p className="text-body-strong text-text-primary">No students found matching "{debouncedSearch}"</p>
                  <p className="mt-0.5 text-caption text-text-muted">Check spelling or try a different term</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-caption text-text-muted">
                    <span className="font-semibold tabular-nums">
                      Found {quickResults.length} student{quickResults.length !== 1 ? 's' : ''}
                    </span>
                    {quickResults.length === 50 && <span className="text-brand-foreground">Showing top 50 results</span>}
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-md border border-border-subtle bg-surface-default p-1">
                    {quickResults.map((student) => (
                      <button
                        type="button"
                        key={student.id}
                        onClick={() => pickFromSearch(student)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground"
                            aria-hidden
                          >
                            {getInitials(student.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-body-strong text-text-primary">{student.name}</p>
                            <div className="flex items-center gap-2 text-caption text-text-muted">
                              <span className="font-mono">{student.student_id}</span>
                              {student.email && (
                                <>
                                  <span aria-hidden>•</span>
                                  <span className="truncate">{student.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-border-subtle bg-surface-subtle px-2 py-0.5 text-caption text-text-secondary">
                          Semester {student.semester}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Selection Controls */}
      <section className="rounded-lg bg-surface-default shadow">
        <header className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <HatGraduation20Regular className="text-brand-foreground" aria-hidden />
            <h3 className="text-subheading text-text-primary">Attendance Filters</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border-default bg-surface-default p-0.5" role="group" aria-label="View mode">
              {(
                [
                  { mode: 'subject' as const, label: 'By Subject', Icon: Book16Regular },
                  { mode: 'student' as const, label: 'By Student', Icon: People16Regular },
                ]
              ).map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleViewModeChange(mode)}
                  aria-pressed={viewMode === mode}
                  className={`inline-flex h-7 items-center gap-1.5 rounded px-3 text-body transition-colors duration-150 ease-fluent-standard ${
                    viewMode === mode ? 'bg-brand-subtle font-semibold text-brand-foreground' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icon aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={refreshAll} title="Refresh datasets">
              <ArrowSync16Regular aria-hidden />
              <span>Refresh</span>
            </Button>
          </div>
        </header>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-caption-strong text-text-secondary">Faculty</label>
              <Select value={selectedFaculty || undefined} onValueChange={handleFacultyChange}>
                <SelectTrigger className="h-9" aria-label="Faculty">
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent>
                  {facultiesQuery.isLoading ? (
                    <SelectItem value="loading-faculties" disabled>
                      Loading faculties...
                    </SelectItem>
                  ) : (
                    faculties.map((faculty) => (
                      <SelectItem key={faculty.id} value={faculty.id.toString()}>
                        {faculty.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-caption-strong text-text-secondary">Semester</label>
              <Select value={selectedSemester || undefined} onValueChange={handleSemesterChange} disabled={!selectedFaculty}>
                <SelectTrigger className="h-9" aria-label="Semester">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <SelectItem key={sem} value={sem.toString()}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {viewMode === 'subject' ? (
              <div className="flex flex-col gap-1">
                <label className="text-caption-strong text-text-secondary">Subject</label>
                <Select value={selectedSubject || undefined} onValueChange={setSelectedSubject} disabled={!selectedSemester}>
                  <SelectTrigger className="h-9" aria-label="Subject">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectsQuery.isLoading ? (
                      <SelectItem value="loading-subjects" disabled>
                        Loading subjects...
                      </SelectItem>
                    ) : subjects.length === 0 ? (
                      <SelectItem value="no-subjects" disabled>
                        No subjects for this semester
                      </SelectItem>
                    ) : (
                      subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id.toString()}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-caption-strong text-text-secondary">Student</label>
                <Select value={selectedStudent || undefined} onValueChange={setSelectedStudent} disabled={!selectedSemester}>
                  <SelectTrigger className="h-9" aria-label="Student">
                    <SelectValue placeholder="Select Student" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentsQuery.isLoading ? (
                      <SelectItem value="loading-students" disabled>
                        Loading students...
                      </SelectItem>
                    ) : cohortStudents.length === 0 ? (
                      <SelectItem value="no-students" disabled>
                        No students available
                      </SelectItem>
                    ) : (
                      cohortStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id.toString()}>
                          {student.name} ({student.student_id})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="eam-attendance-date" className="text-caption-strong text-text-secondary">
                Attendance Date
              </label>
              <Input
                id="eam-attendance-date"
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="h-9 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>

          {selectedFaculty && selectedSemester && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-subtle px-3 py-2 text-caption text-text-secondary">
              {chip('Faculty', selectedFacultyName)}
              {chip('Semester', selectedSemester)}
              {viewMode === 'subject' && selectedSubject && chip('Subject', selectedSubjectName)}
              {viewMode === 'student' && selectedStudent && chip('Student', selectedStudentData?.name || 'Unknown')}
              {chip('Date', selectedDate)}
            </div>
          )}
        </div>
      </section>

      {viewMode === 'subject' && selectedFaculty && selectedSemester && selectedSubject ? (
        <DateSessionRegister
          facultyId={Number(selectedFaculty)}
          semester={Number(selectedSemester)}
          subjectId={Number(selectedSubject)}
          date={selectedDate}
        />
      ) : viewMode === 'student' && selectedFaculty && selectedSemester && selectedStudent ? (
        <StudentDayAttendance
          facultyId={Number(selectedFaculty)}
          semester={Number(selectedSemester)}
          studentId={Number(selectedStudent)}
          studentName={selectedStudentData?.name}
          date={selectedDate}
        />
      ) : (
        <EmptyState
          className="shadow"
          icon={<ClipboardTaskListLtr24Regular aria-hidden />}
          title={viewMode === 'subject' ? 'Choose a subject and date' : 'Choose a student and date'}
          description={
            viewMode === 'subject'
              ? 'Select faculty, semester and subject to open the class register for that day.'
              : 'Select faculty, semester and student (or use Quick Search) to see their classes for that day.'
          }
        />
      )}
    </div>
  );
};

export default EnhancedAttendanceManagement;
