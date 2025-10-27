import * as React from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StudentFormData } from './StudentForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2, User, Loader2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudentListProps {
  students: StudentFormData[];
  onEdit: (student: StudentFormData) => void;
  onDelete: (studentId: string) => void;
  isLoading?: boolean;
}

const StudentList = ({ students, onEdit, onDelete, isLoading = false }: StudentListProps) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Students List</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>A list of all students registered in the system.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Faculty</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="h-12 w-12 mb-2 animate-spin" />
                    <p>Loading students...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <User className="h-12 w-12 mb-2 opacity-30" />
                    <p>No students found. Add a student to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.full_name}</TableCell>
                  <TableCell>{student.student_id}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.faculty}</TableCell>
                  <TableCell>{student.semester}</TableCell>
                  <TableCell>{student.year}</TableCell>
                  <TableCell>{student.batch}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/app/students/${student.id}/calendar`)}
                        title="View attendance calendar"
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Calendar
                      </Button>
                      
                      <Button variant="outline" size="sm" onClick={() => onEdit(student)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-500 hover:text-red-600" 
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
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default StudentList;
