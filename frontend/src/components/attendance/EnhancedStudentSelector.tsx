import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search16Regular,
  Search24Regular,
  Dismiss16Regular,
  Dismiss12Regular,
  Filter16Regular,
  People24Regular,
  ChevronDown16Regular,
  ChevronUp16Regular,
  Checkmark12Filled,
  PersonSwap16Regular,
} from '@fluentui/react-icons';

interface Student {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  faculty: string;
  faculty_id: number;
}

interface EnhancedStudentSelectorProps {
  students: Student[];
  selectedStudentId: string;
  onStudentSelect: (studentId: string) => void;
  className?: string;
}

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

const selectClassName =
  'h-9 w-full cursor-pointer rounded-md border border-border-default bg-surface-default px-2.5 text-body text-text-primary transition-colors duration-150 ease-fluent-standard hover:border-border-strong focus:border-brand-stroke focus:outline-none';

const EnhancedStudentSelector: React.FC<EnhancedStudentSelectorProps> = ({
  students,
  selectedStudentId,
  onStudentSelect,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Enhanced search and filtering logic
  const filteredStudents = useMemo(() => {
    let filtered = students;

    // Text search across multiple fields
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(query) ||
        student.student_id.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        student.faculty.toLowerCase().includes(query)
      );
    }

    // Faculty filter
    if (selectedFaculty) {
      filtered = filtered.filter(s => s.faculty.toLowerCase().includes(selectedFaculty.toLowerCase()));
    }

    // Semester filter
    if (selectedSemester) {
      filtered = filtered.filter(s => s.semester === Number(selectedSemester));
    }

    return filtered.slice(0, 20); // Limit results for performance
  }, [students, searchQuery, selectedFaculty, selectedSemester]);

  // Get unique values for filters
  const uniqueFaculties = useMemo(() =>
    [...new Set(students.map(s => s.faculty))].sort(), [students]
  );

  const uniqueSemesters = useMemo(() =>
    [...new Set(students.map(s => s.semester))].sort((a, b) => a - b), [students]
  );

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedFaculty('');
    setSelectedSemester('');
  };

  const hasActiveFilters = searchQuery || selectedFaculty || selectedSemester;
  const selectedStudent = students.find(s => s.id.toString() === selectedStudentId);

  const handleStudentClick = (student: Student) => {
    onStudentSelect(student.id.toString());
    setShowResults(false);
    setSearchQuery(''); // Clear search after selection
  };

  const handleSearchFocus = () => {
    setShowResults(true);
  };

  const handleSearchBlur = () => {
    // Delay hiding results to allow for clicks
    setTimeout(() => setShowResults(false), 200);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Selected Student Display */}
      {selectedStudent && (
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-subtle text-body-strong text-brand-foreground">
                {getInitials(selectedStudent.name)}
              </span>
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-presence-available ring-2 ring-[var(--surface-subtle)]"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-body-strong text-text-primary">{selectedStudent.name}</h3>
              <p className="truncate text-caption text-text-muted">
                {selectedStudent.student_id} • {selectedStudent.faculty} • Semester {selectedStudent.semester}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStudentSelect('')}
            className="self-start sm:self-auto"
          >
            <PersonSwap16Regular aria-hidden />
            Change Student
          </Button>
        </div>
      )}

      {/* Search Interface */}
      {(!selectedStudent || showResults) && (
        <div className="space-y-3">
          <div>
            <label htmlFor="student-picker-search" className="mb-1 block text-body-strong text-text-primary">
              Search and Select Student
            </label>

            {/* Main Search Input */}
            <div className="relative">
              <Search16Regular
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <Input
                id="student-picker-search"
                type="text"
                placeholder="Search by name, student ID, email, or faculty..."
                className="h-9 pl-8 pr-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
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
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              aria-expanded={showAdvancedFilters}
            >
              <Filter16Regular aria-hidden />
              Advanced Filters
              {showAdvancedFilters ? (
                <ChevronUp16Regular aria-hidden />
              ) : (
                <ChevronDown16Regular aria-hidden />
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-brand-foreground hover:text-brand-foreground"
              >
                <Dismiss16Regular aria-hidden />
                Clear All
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3 md:grid-cols-2">
              {/* Faculty Filter */}
              <div className="flex flex-col gap-1">
                <label htmlFor="student-picker-faculty" className="text-caption-strong text-text-secondary">Faculty</label>
                <select
                  id="student-picker-faculty"
                  className={selectClassName}
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                >
                  <option value="">All Faculties</option>
                  {uniqueFaculties.map(faculty => (
                    <option key={faculty} value={faculty}>{faculty}</option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div className="flex flex-col gap-1">
                <label htmlFor="student-picker-semester" className="text-caption-strong text-text-secondary">Semester</label>
                <select
                  id="student-picker-semester"
                  className={selectClassName}
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                >
                  <option value="">All Semesters</option>
                  {uniqueSemesters.map(semester => (
                    <option key={semester} value={semester}>Semester {semester}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {searchQuery && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand-subtle pl-2.5 pr-1 text-caption text-brand-foreground">
                  Search: "{searchQuery}"
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Remove search filter"
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand-subtle-hover"
                  >
                    <Dismiss12Regular aria-hidden />
                  </button>
                </span>
              )}
              {selectedFaculty && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand-subtle pl-2.5 pr-1 text-caption text-brand-foreground">
                  Faculty: {selectedFaculty}
                  <button
                    type="button"
                    onClick={() => setSelectedFaculty('')}
                    aria-label="Remove faculty filter"
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand-subtle-hover"
                  >
                    <Dismiss12Regular aria-hidden />
                  </button>
                </span>
              )}
              {selectedSemester && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand-subtle pl-2.5 pr-1 text-caption text-brand-foreground">
                  Semester: {selectedSemester}
                  <button
                    type="button"
                    onClick={() => setSelectedSemester('')}
                    aria-label="Remove semester filter"
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand-subtle-hover"
                  >
                    <Dismiss12Regular aria-hidden />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between text-caption text-text-muted">
            <span className="tabular-nums">
              {filteredStudents.length} student(s) found
              {filteredStudents.length === 20 && ' (showing first 20)'}
            </span>
            {filteredStudents.length > 0 && (
              <span>Click on a student to select</span>
            )}
          </div>

          {/* Search Results */}
          {(showResults || hasActiveFilters) && (
            <div
              className="max-h-96 overflow-y-auto rounded-md border border-border-subtle bg-surface-default p-1 shadow-md"
              role="listbox"
              aria-label="Students"
            >
              {filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-8 text-center">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                    {hasActiveFilters ? <People24Regular aria-hidden /> : <Search24Regular aria-hidden />}
                  </div>
                  {hasActiveFilters ? (
                    <>
                      <p className="text-body-strong text-text-primary">No students match your search criteria.</p>
                      <p className="text-caption text-text-muted">Try adjusting your filters or search terms.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-body-strong text-text-primary">Start typing to search for students.</p>
                      <p className="text-caption text-text-muted">Search by name, ID, email, or use filters.</p>
                    </>
                  )}
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudentId === student.id.toString();
                  return (
                    <div
                      key={student.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleStudentClick(student)}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150 ease-fluent-standard ${
                        isSelected ? 'bg-brand-subtle' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-sm border ${
                          isSelected
                            ? 'border-brand bg-brand text-brand-on'
                            : 'border-border-strong bg-surface-default'
                        }`}
                        aria-hidden
                      >
                        {isSelected && <Checkmark12Filled />}
                      </span>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground">
                        {getInitials(student.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-body-strong text-text-primary">{student.name}</h3>
                          {isSelected && (
                            <span className="rounded-full bg-brand px-2 py-px text-overline text-brand-on">Selected</span>
                          )}
                        </div>
                        <p className="truncate text-caption text-text-muted">
                          ID: {student.student_id} • {student.email} • {student.faculty} • Semester {student.semester}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedStudentSelector;
