import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StudentFormData } from './StudentForm';
import { Edit, TrashCan, Calendar, ArrowUp, ArrowDown, ArrowsVertical } from '@carbon/icons-react';

interface StudentListProps {
  students: StudentFormData[];
  onEdit: (student: StudentFormData) => void;
  onDelete: (studentId: string) => void;
  isLoading?: boolean;
  sortBy?: 'name' | 'batch' | 'semester' | 'year';
  sortDir?: 'asc' | 'desc';
  onSortChange?: (field: 'name' | 'batch' | 'semester' | 'year') => void;
}

const StudentList = ({
  students,
  onEdit,
  onDelete,
  isLoading = false,
  sortBy,
  sortDir,
  onSortChange
}: StudentListProps) => {
  const navigate = useNavigate();

  const SortableHeader = ({ field, label }: { field: 'name' | 'batch' | 'semester' | 'year'; label: string }) => {
    const isActive = sortBy === field;

    return (
      <button
        type="button"
        onClick={() => onSortChange?.(field)}
        className="inline-flex items-center gap-1.5 hover:text-text-primary focus:outline-none transition-colors"
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortDir === 'asc' ? (
            <ArrowUp size={14} className="text-action-primary" aria-hidden="true" />
          ) : (
            <ArrowDown size={14} className="text-action-primary" aria-hidden="true" />
          )
        ) : (
          <ArrowsVertical size={14} className="text-text-muted/60" aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-surface-default">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader field="name" label="Full Name" />
              </TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Faculty</TableHead>
              <TableHead>
                <SortableHeader field="semester" label="Semester" />
              </TableHead>
              <TableHead>
                <SortableHeader field="year" label="Year" />
              </TableHead>
              <TableHead>
                <SortableHeader field="batch" label="Batch" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`loading-${idx}`}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-8 text-center">
                  <EmptyState
                    title="No students found"
                    description="No student records match the current filter criteria."
                  />
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => (
                <TableRow key={student.id} className="group">
                  <TableCell className="font-medium text-text-primary">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle border border-border text-xs font-semibold text-text-secondary">
                        {student.full_name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <span className="truncate max-w-[180px]">{student.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-medium text-text-secondary bg-surface-subtle px-2 py-0.5 rounded border border-border-subtle">
                      {student.student_id}
                    </span>
                  </TableCell>
                  <TableCell className="text-text-secondary text-xs">{student.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal text-xs">
                      {student.faculty}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-text-secondary font-medium">
                    Sem {student.semester}
                  </TableCell>
                  <TableCell className="tabular-nums text-text-secondary font-medium">
                    Year {student.year}
                  </TableCell>
                  <TableCell className="tabular-nums text-text-secondary">
                    {student.batch}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/app/students/${student.id}/calendar`)}
                        title="View attendance calendar"
                        aria-label="View attendance calendar"
                        className="text-text-muted hover:text-text-primary"
                      >
                        <Calendar size={16} aria-hidden="true" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(student)}
                        title="Edit student"
                        aria-label="Edit student"
                        className="text-text-muted hover:text-text-primary"
                      >
                        <Edit size={16} aria-hidden="true" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (student.id && window.confirm(`Are you sure you want to delete ${student.full_name}?`)) {
                            onDelete(student.id);
                          }
                        }}
                        disabled={!student.id}
                        title="Delete student"
                        aria-label="Delete student"
                        className="text-text-muted hover:text-status-error"
                      >
                        <TrashCan size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer with total count */}
      {students.length > 0 && !isLoading && (
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 bg-surface-subtle text-xs text-text-muted">
          <span>
            Total: <strong className="text-text-primary tabular-nums">{students.length}</strong> student{students.length !== 1 ? 's' : ''}
          </span>
          <span>Tabular records</span>
        </div>
      )}
    </div>
  );
};

export default StudentList;
