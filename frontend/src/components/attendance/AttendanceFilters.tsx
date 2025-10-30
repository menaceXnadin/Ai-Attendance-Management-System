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
}

interface AttendanceFiltersProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedClass: string;
  setSelectedClass: (classId: string) => void;
  classes: ClassOption[];
  classesLoading: boolean;
}

const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  selectedDate,
  setSelectedDate,
  selectedClass,
  setSelectedClass,
  classes,
  classesLoading
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [dateRangeStart, setDateRangeStart] = React.useState<Date | undefined>(undefined);
  const [dateRangeEnd, setDateRangeEnd] = React.useState<Date | undefined>(undefined);
  const [facultyFilter, setFacultyFilter] = React.useState('all');
  const [semesterFilter, setSemesterFilter] = React.useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  // Extract unique faculties from classes (assuming classes have faculty info)
  const faculties = React.useMemo(() => {
    const uniqueFaculties = new Set(classes.map(c => c.name.split(' - ')[0]));
    return Array.from(uniqueFaculties);
  }, [classes]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (dateRangeStart || dateRangeEnd) count++;
    if (facultyFilter !== 'all') count++;
    if (semesterFilter !== 'all') count++;
    return count;
  }, [searchQuery, statusFilter, dateRangeStart, dateRangeEnd, facultyFilter, semesterFilter]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateRangeStart(undefined);
    setDateRangeEnd(undefined);
    setFacultyFilter('all');
    setSemesterFilter('all');
    setSelectedClass('all');
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-4">
      {/* Primary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Class Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-400" />
            Class / Subject
          </label>
          <Select value={selectedClass} onValueChange={setSelectedClass} disabled={classesLoading}>
            <SelectTrigger className="bg-slate-800/90 border-slate-600 text-white">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(cls => (
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

      {/* Advanced Filters Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="text-blue-400 border-blue-400/30 hover:bg-blue-500/10"
        >
          <Filter className="h-4 w-4 mr-2" />
          {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          {activeFiltersCount > 0 && (
            <Badge className="ml-2 bg-blue-500/20 text-blue-300 border-blue-400/30">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <X className="h-4 w-4 mr-2" />
            Clear All Filters
          </Button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-4 animate-in slide-in-from-top-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-400" />
            Advanced Filters
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Faculty Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-400" />
                Faculty
              </label>
              <Select value={facultyFilter} onValueChange={setFacultyFilter}>
                <SelectTrigger className="bg-slate-800/90 border-slate-600 text-white">
                  <SelectValue placeholder="All Faculties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Faculties</SelectItem>
                  {faculties.map(faculty => (
                    <SelectItem key={faculty} value={faculty}>
                      {faculty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Semester Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                <Hash className="h-4 w-4 text-blue-400" />
                Semester
              </label>
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="bg-slate-800/90 border-slate-600 text-white">
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <SelectItem key={sem} value={sem.toString()}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range - Start */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-400" />
                Date Range (Start)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-slate-800/90 border-slate-600 text-white hover:bg-slate-800"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeStart ? format(dateRangeStart, 'PP') : 'Select start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRangeStart}
                    onSelect={setDateRangeStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Range - End */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-400" />
                Date Range (End)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-slate-800/90 border-slate-600 text-white hover:bg-slate-800"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeEnd ? format(dateRangeEnd, 'PP') : 'Select end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRangeEnd}
                    onSelect={setDateRangeEnd}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
          <span className="text-sm font-medium text-blue-300">Active Filters:</span>
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
          {facultyFilter !== 'all' && (
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
              <GraduationCap className="h-3 w-3 mr-1" />
              Faculty: {facultyFilter}
            </Badge>
          )}
          {semesterFilter !== 'all' && (
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-400/30">
              <Hash className="h-3 w-3 mr-1" />
              Semester: {semesterFilter}
            </Badge>
          )}
          {(dateRangeStart || dateRangeEnd) && (
            <Badge className="bg-teal-500/20 text-teal-300 border-teal-400/30">
              <CalendarIcon className="h-3 w-3 mr-1" />
              Date Range: {dateRangeStart ? format(dateRangeStart, 'PP') : '...'} - {dateRangeEnd ? format(dateRangeEnd, 'PP') : '...'}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceFilters;
