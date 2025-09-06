import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  X, 
  Filter,
  User,
  Mail,
  GraduationCap,
  Calendar,
  Hash,
  Phone,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className={`space-y-4 ${className}`}>
      {/* Selected Student Display */}
      {selectedStudent && (
        <Card className="bg-slate-700/30 border-slate-600/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{selectedStudent.name}</h3>
                  <p className="text-sm text-slate-400">
                    {selectedStudent.student_id} • {selectedStudent.faculty} • Semester {selectedStudent.semester}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStudentSelect('')}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <X className="h-4 w-4 mr-2" />
                Change Student
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Interface */}
      {(!selectedStudent || showResults) && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Search and Select Student
            </label>
            
            {/* Main Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name, student ID, email, or faculty..."
                className="pl-10 pr-10 bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
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
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
              {showAdvancedFilters ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>
            
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <X className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/30 rounded-lg">
              {/* Faculty Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Faculty</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-slate-700/50 text-white border-slate-600/50"
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
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Semester</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-slate-700/50 text-white border-slate-600/50"
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
                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/30">
                  Search: "{searchQuery}"
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-2 hover:text-blue-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedFaculty && (
                <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400/30">
                  Faculty: {selectedFaculty}
                  <button
                    onClick={() => setSelectedFaculty('')}
                    className="ml-2 hover:text-green-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedSemester && (
                <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-400/30">
                  Semester: {selectedSemester}
                  <button
                    onClick={() => setSelectedSemester('')}
                    className="ml-2 hover:text-purple-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>
              {filteredStudents.length} student(s) found
              {filteredStudents.length === 20 && ' (showing first 20)'}
            </span>
            {filteredStudents.length > 0 && (
              <span>Click on a student to select</span>
            )}
          </div>

          {/* Search Results */}
          {(showResults || hasActiveFilters) && (
            <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-600/50 rounded-lg bg-slate-800/30">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  {hasActiveFilters ? (
                    <>
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>No students match your search criteria.</p>
                      <p className="text-sm">Try adjusting your filters or search terms.</p>
                    </>
                  ) : (
                    <>
                      <Search className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Start typing to search for students.</p>
                      <p className="text-sm">Search by name, ID, email, or use filters.</p>
                    </>
                  )}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentClick(student)}
                    className={`p-4 cursor-pointer transition-all hover:bg-slate-700/50 border-b border-slate-600/30 last:border-b-0 ${
                      selectedStudentId === student.id.toString()
                        ? 'bg-blue-500/20 border-blue-400/50'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-blue-400" />
                          <h3 className="font-medium text-white">{student.name}</h3>
                          {selectedStudentId === student.id.toString() && (
                            <Badge className="bg-blue-500/20 text-blue-300">Selected</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-400">
                          <div className="flex items-center gap-2">
                            <Hash className="h-3 w-3" />
                            <span>ID: {student.student_id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <span>{student.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-3 w-3" />
                            <span>{student.faculty}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>Semester {student.semester}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedStudentSelector;