import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import {
  CalendarLtr16Regular,
  Search16Regular,
  Dismiss16Regular,
  Dismiss12Regular,
  Filter16Regular,
} from '@fluentui/react-icons';

interface ClassOption {
  id: string;
  name: string;
  semester?: number;
  faculty_id?: number;
}

interface AttendanceFiltersProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedFaculty: string;
  setSelectedFaculty: (faculty: string) => void;
  selectedSemester: string;
  setSelectedSemester: (semester: string) => void;
  selectedClass: string;
  setSelectedClass: (classId: string) => void;
  classes: ClassOption[];
  classesLoading: boolean;
  faculties: Array<{id: string; name: string}>;
  facultiesLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-caption-strong text-text-secondary">{label}</span>
    {children}
  </div>
);

const FilterChip: React.FC<{ label: string; onDismiss: () => void }> = ({ label, onDismiss }) => (
  <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-brand-subtle pl-2.5 pr-1 text-caption text-brand-foreground">
    <span className="truncate">{label}</span>
    <button
      type="button"
      onClick={onDismiss}
      aria-label={`Remove filter ${label}`}
      className="grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors duration-150 ease-fluent-standard hover:bg-brand-subtle-hover"
    >
      <Dismiss12Regular aria-hidden />
    </button>
  </span>
);

const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  selectedDate,
  setSelectedDate,
  selectedFaculty,
  setSelectedFaculty,
  selectedSemester,
  setSelectedSemester,
  selectedClass,
  setSelectedClass,
  classes,
  classesLoading,
  faculties,
  facultiesLoading,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter
}) => {
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (selectedFaculty && selectedFaculty !== 'all') count++;
    if (selectedSemester && selectedSemester !== 'all') count++;
    if (selectedClass && selectedClass !== 'all') count++;
    return count;
  }, [searchQuery, statusFilter, selectedFaculty, selectedSemester, selectedClass]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedFaculty('all');
    setSelectedSemester('all');
    setSelectedClass('all');
    setSelectedDate(new Date());
  };

  // Filter classes by selected faculty and semester
  const filteredClasses = React.useMemo(() => {
    let filtered = classes;

    // Filter by faculty first
    if (selectedFaculty && selectedFaculty !== 'all') {
      const facultyNum = parseInt(selectedFaculty);
      filtered = filtered.filter(cls => cls.faculty_id === facultyNum);
    }

    // Then filter by semester
    if (selectedSemester && selectedSemester !== 'all') {
      const semesterNum = parseInt(selectedSemester);
      filtered = filtered.filter(cls => cls.semester === semesterNum);
    }

    return filtered;
  }, [classes, selectedFaculty, selectedSemester]);

  const selectedFacultyName = faculties.find(f => f.id === selectedFaculty)?.name;
  const selectedClassName = classes.find(c => c.id === selectedClass)?.name;

  return (
    <div className="space-y-3">
      {/* Search + clear */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search16Regular
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input
            type="text"
            aria-label="Search students"
            placeholder="Search by student name, roll number, student ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8 pr-8"
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
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="self-start text-brand-foreground hover:text-brand-foreground sm:ml-auto sm:self-auto"
          >
            <Dismiss16Regular aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Faculty Selection */}
        <FilterField label="Faculty">
          <Select value={selectedFaculty} onValueChange={setSelectedFaculty} disabled={facultiesLoading}>
            <SelectTrigger className="h-9" aria-label="Faculty">
              <SelectValue placeholder="All Faculties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Faculties</SelectItem>
              {faculties.map(faculty => (
                <SelectItem key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {/* Semester Selection */}
        <FilterField label="Semester">
          <Select value={selectedSemester} onValueChange={setSelectedSemester}>
            <SelectTrigger className="h-9" aria-label="Semester">
              <SelectValue placeholder="All Semesters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              <SelectItem value="1">Semester 1</SelectItem>
              <SelectItem value="2">Semester 2</SelectItem>
              <SelectItem value="3">Semester 3</SelectItem>
              <SelectItem value="4">Semester 4</SelectItem>
              <SelectItem value="5">Semester 5</SelectItem>
              <SelectItem value="6">Semester 6</SelectItem>
              <SelectItem value="7">Semester 7</SelectItem>
              <SelectItem value="8">Semester 8</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        {/* Class Selection */}
        <FilterField label="Class / Subject">
          <Select value={selectedClass} onValueChange={setSelectedClass} disabled={classesLoading}>
            <SelectTrigger className="h-9" aria-label="Class or subject">
              <SelectValue placeholder={filteredClasses.length === 0 ? "No classes for semester" : "Select class"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {filteredClasses.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {/* Date Selection */}
        <FilterField label="Date">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                aria-label="Date"
                className="h-9 w-full justify-start px-3 text-left font-normal"
              >
                <CalendarLtr16Regular className="text-text-muted" aria-hidden />
                <span className="truncate">{format(selectedDate, 'PPP')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </FilterField>

        {/* Status Filter */}
        <FilterField label="Status">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9" aria-label="Status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="present">Present Only</SelectItem>
              <SelectItem value="absent">Absent Only</SelectItem>
              <SelectItem value="late">Late Only</SelectItem>
              <SelectItem value="excused">Excused Only</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      {/* Applied filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-caption text-text-muted">
            <Filter16Regular aria-hidden />
            Active filters ({activeFiltersCount})
          </span>
          {searchQuery.trim() && (
            <FilterChip label={`Search: "${searchQuery}"`} onDismiss={() => setSearchQuery('')} />
          )}
          {statusFilter !== 'all' && (
            <FilterChip
              label={`Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`}
              onDismiss={() => setStatusFilter('all')}
            />
          )}
          {selectedFaculty && selectedFaculty !== 'all' && (
            <FilterChip
              label={selectedFacultyName ? `Faculty: ${selectedFacultyName}` : 'Faculty selected'}
              onDismiss={() => setSelectedFaculty('all')}
            />
          )}
          {selectedSemester && selectedSemester !== 'all' && (
            <FilterChip label={`Semester: ${selectedSemester}`} onDismiss={() => setSelectedSemester('all')} />
          )}
          {selectedClass && selectedClass !== 'all' && (
            <FilterChip
              label={selectedClassName ? `Class: ${selectedClassName}` : 'Class selected'}
              onDismiss={() => setSelectedClass('all')}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceFilters;
