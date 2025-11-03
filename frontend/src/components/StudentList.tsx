import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StudentFormData } from './StudentForm';
import { Edit, Trash2, User, Loader2, Calendar, ArrowUpDown, ArrowUp, ArrowDown, IdCard, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudentListProps {
  students: StudentFormData[];
  onEdit: (student: StudentFormData) => void;
  onDelete: (studentId: string) => void;
  isLoading?: boolean;
  sortBy?: 'name' | 'batch' | 'semester' | 'year';
  sortDir?: 'asc' | 'desc';
  onSortChange?: (field: 'name' | 'batch' | 'semester' | 'year') => void;
}

const StudentList = ({ students, onEdit, onDelete, isLoading = false, sortBy, sortDir, onSortChange }: StudentListProps) => {
  const navigate = useNavigate();
  
  // Debug: Log students data
  React.useEffect(() => {
    console.log('[StudentList] Received students data:', students);
    students.forEach((student, index) => {
      console.log(`[StudentList] Student ${index}:`, {
        id: student.id,
        full_name: student.full_name,
        student_id: student.student_id,
        idType: typeof student.id,
        hasId: !!student.id
      });
    });
  }, [students]);

  const SortableHeader = ({ field, label }: { field: 'name' | 'batch' | 'semester' | 'year'; label: string }) => {
    const isActive = sortBy === field;
    const icon = !isActive ? (
      <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
    ) : sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    );

    return (
      <button
        onClick={() => onSortChange?.(field)}
        className={`flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 cursor-pointer font-semibold group ${
          isActive ? 'text-blue-600 dark:text-blue-400' : ''
        }`}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="group-hover:scale-110 transition-transform duration-200">
          {icon}
        </span>
      </button>
    );
  };

  return (
    <div className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <TableHead className="font-bold text-slate-700 dark:text-slate-300">
                <SortableHeader field="name" label="Full Name" />
              </TableHead>
              <TableHead className="font-bold text-slate-700 dark:text-slate-300">Student ID</TableHead>
              <TableHead className="font-bold text-slate-700 dark:text-slate-300">Email</TableHead>
              <TableHead className="font-bold text-slate-700 dark:text-slate-300">Faculty</TableHead>
              <TableHead className="font-bold text-slate-700 dark:text-slate-300">
                <SortableHeader field="semester" label="Semester" />
              </TableHead>
              <TableHead className="font-bold text-slate-700 dark:text-slate-300">
                <SortableHeader field="year" label="Year" />
              </TableHead>
              <TableHead className="font-bold text-slate-700 dark:text-slate-300">
                <SortableHeader field="batch" label="Batch" />
              </TableHead>
              <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-10 w-10 mb-3 animate-spin text-blue-500" />
                    <p className="font-medium">Loading students...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                    <div className="w-12 h-12 mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6" />
                    </div>
                    <p className="font-medium text-lg">No students found</p>
                    <p className="text-sm mt-1">Add a student to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              students.map((student, index) => (
                <TableRow 
                  key={student.id} 
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 group"
                >
                  <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        {student.full_name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      {student.full_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <IdCard className="h-3 w-3" />
                      {student.student_id}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-sm">{student.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <GraduationCap className="h-3 w-3" />
                      {student.faculty}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-sm font-bold text-purple-700 dark:text-purple-400">
                      {student.semester}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm font-bold text-amber-700 dark:text-amber-400">
                      {student.year}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-md text-xs font-semibold text-sky-700 dark:text-sky-400">
                      <Calendar className="h-3 w-3" />
                      {student.batch}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/app/students/${student.id}/calendar`)}
                        title="View attendance calendar"
                        className="h-9 px-3 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                      >
                        <Calendar className="h-4 w-4 mr-1.5" />
                        Calendar
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onEdit(student)}
                        className="h-9 px-3 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 shadow-sm hover:shadow"
                      >
                        <Edit className="h-4 w-4 mr-1.5" />
                        Edit
                      </Button>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 px-3 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 shadow-sm hover:shadow" 
                        onClick={() => {
                          console.log("Delete button clicked for student:", student);
                          console.log("Student ID being passed:", student.id);
                          if (student.id) {
                            // Confirm deletion with the user
                            if (window.confirm(`Are you sure you want to delete ${student.full_name}?`)) {
                              onDelete(student.id);
                            } else {
                              console.log("Deletion cancelled by user");
                            }
                          } else {
                            console.error("No student ID available for deletion");
                            alert("Cannot delete student: No ID available");
                          }
                        }}
                        disabled={!student.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Footer with count */}
      {students.length > 0 && !isLoading && (
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              Total: <span className="font-bold text-slate-900 dark:text-slate-100">{students.length}</span> student{students.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-500">
              Hover over rows to see action buttons
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentList;
