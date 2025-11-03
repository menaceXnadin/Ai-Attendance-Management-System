import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Search, X, Filter, UserSearch, Hash, BookOpen, GraduationCap } from 'lucide-react';

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

  return (
    <div className="space-y-4">
      {/* Primary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Faculty Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-blue-400" />
            Faculty
          </label>
          <Select value={selectedFaculty} onValueChange={setSelectedFaculty} disabled={facultiesLoading}>
            <SelectTrigger className="bg-slate-800/90 border-slate-600 text-white">
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
        </div>

        {/* Semester Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <Hash className="h-4 w-4 text-blue-400" />
            Semester
          </label>
          <Select value={selectedSemester} onValueChange={setSelectedSemester}>
            <SelectTrigger className="bg-slate-800/90 border-slate-600 text-white">
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
        </div>

        {/* Class Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-400" />
            Class / Subject
          </label>
          <Select value={selectedClass} onValueChange={setSelectedClass} disabled={classesLoading}>
            <SelectTrigger className="bg-slate-800/90 border-slate-600 text-white">
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
        </div>

        {/* Date Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-blue-400" />
            Date
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal bg-slate-800/90 border-slate-600 text-white hover:bg-slate-800"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PPP')}
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
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-400" />
            Status
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-slate-800/90 border-slate-600 text-white">
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
        </div>
      </div>

      {/* Search Bar */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-400" />
          Search Students
        </label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by student name, roll number, student ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-12 h-12 bg-slate-800/90 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
          <span className="text-sm font-medium text-blue-300 flex items-center gap-2">
            Active Filters:
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </span>
          {searchQuery.trim() && (
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">
              <UserSearch className="h-3 w-3 mr-1" />
              Search: "{searchQuery}"
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
              <Filter className="h-3 w-3 mr-1" />
              Status: {statusFilter}
            </Badge>
          )}
          {selectedFaculty && selectedFaculty !== 'all' && (
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30">
              <GraduationCap className="h-3 w-3 mr-1" />
              Faculty Selected
            </Badge>
          )}
          {selectedSemester && selectedSemester !== 'all' && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30">
              <Hash className="h-3 w-3 mr-1" />
              Semester: {selectedSemester}
            </Badge>
          )}
          {selectedClass && selectedClass !== 'all' && (
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
              <BookOpen className="h-3 w-3 mr-1" />
              Class Selected
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceFilters;
