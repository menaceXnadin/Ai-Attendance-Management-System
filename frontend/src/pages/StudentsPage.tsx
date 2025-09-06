import React, { useState } from 'react';
import StudentFormEnhanced, { StudentFormData } from '@/components/StudentFormEnhanced';
import StudentList from '@/components/StudentList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, X, GraduationCap, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { StudentCreateData } from '@/integrations/api/types';
import { useAuth } from '@/contexts/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// No longer needed with the simplified form

const StudentsPage = () => {
  const [selectedStudent, setSelectedStudent] = useState<StudentFormData | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('list');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch faculties for filtering
  const { data: allFaculties = [] } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => api.faculties.getAll(),
  });

  // Fetch students from our backend API
  const { data: students = [], isLoading, refetch, error } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const data = await api.students.getAll();
      console.log('[StudentsPage] Raw API data:', data);
      if (!data || data.length === 0) {
        return [];
      }
      // Use the exact faculty value from backend response
      return data.map(student => {
        console.log(`[StudentsPage] Processing student:`, student);
        console.log(`[StudentsPage] Faculty value:`, student.faculty);
        console.log(`[StudentsPage] Faculty type:`, typeof student.faculty);
        
        const mapped = {
          id: student.id || '',
          full_name: student.name || 'Unknown Name',
          student_id: student.studentId || 'Unknown ID',
          studentId: student.studentId || 'Unknown ID',
          email: student.email || 'unknown@example.com',
          faculty: student.faculty || 'Unknown Faculty',
          faculty_id: student.faculty_id || 0, // Use actual faculty_id from backend
          semester: student.semester || 1,
          year: student.year || 1,
          batch: student.batch || new Date().getFullYear(),
        };
        
        console.log(`[StudentsPage] Mapped student:`, mapped);
        return mapped;
      });
    },
    staleTime: 30000,
    retry: (failureCount, error) => {
      if (error && error.message && (error.message.includes('authenticated') || error.message.includes('expired'))) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Refetch students when switching to the list tab
  React.useEffect(() => {
    if (activeTab === 'list') {
      refetch();
    }
  }, [activeTab, refetch]);

  // Use all faculties from backend for dropdown - keep the full objects
  const faculties = React.useMemo(() => {
    return allFaculties; // Return full faculty objects with id and name
  }, [allFaculties]);

  // Enhanced filtering with multiple search criteria
  const filteredStudents = React.useMemo(() => {
    let filtered = students;
    
    // Filter by faculty if selected
    if (selectedFaculty) {
      filtered = filtered.filter(s => s.faculty_id === Number(selectedFaculty));
    }
    
    // Enhanced search across multiple fields
    if (searchStudentId.trim()) {
      const query = searchStudentId.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.full_name?.toLowerCase().includes(query) ||
        s.student_id?.toLowerCase().includes(query) ||
        s.studentId?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.faculty?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [students, selectedFaculty, searchStudentId]);

  React.useEffect(() => {
    console.log('[StudentsPage] Mapped students for StudentList:', students);
  }, [students]);

  // Add student mutation - now includes account creation with password
  const addStudentMutation = useMutation({
    mutationFn: async (student: StudentFormData) => {
      try {
        console.log('[Frontend] Starting student creation with data:', student);
        console.log('[Frontend] Current user:', user); // Debug current user
        console.log('[Frontend] Auth token present:', !!localStorage.getItem('authToken'));
        
        // Debug: Check current auth status
        try {
          const currentUser = await api.auth.getUser();
          console.log('[Frontend] Verified current user from API:', currentUser);
        } catch (authError) {
          console.log('[Frontend] Failed to get current user:', authError);
        }
        
        // Check if user is admin
        if (user?.role !== 'admin') {
          throw new Error(`Admin access required. Current user role: ${user?.role || 'unknown'}`);
        }
        
        // Validate required fields for account creation
        if (!student.password) {
          throw new Error("Password is required to create a student account");
        }
        
        if (student.password !== student.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        
        // Create student with proper backend structure
        const createData: StudentCreateData = {
          name: student.full_name,
          email: student.email,
          studentId: student.student_id,
          password: student.password,
          faculty_id: student.faculty_id, // Pass faculty_id directly
          semester: student.semester,
          year: student.year,
          batch: student.batch,
          phone_number: student.phone_number,      // Add phone number
          emergency_contact: student.emergency_contact, // Add emergency contact
          // Legacy fields for backward compatibility
          rollNo: student.faculty_id?.toString() || "0", 
          role: 'student',
        };
        
        console.log('[Frontend] Mapped student data for API:', createData);
        
        const result = await api.students.create(createData);
        console.log('[Frontend] Student creation successful:', result);
        return result;
      } catch (error) {
        console.error('[Frontend] Error adding student:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[Frontend] Student addition successful, refreshing student list');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetch(); // Explicitly refetch students data
      setActiveTab('list');
      toast({
        title: "Student Added",
        description: "The student has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add student: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async (student: StudentFormData) => {
      if (!student.id) {
        throw new Error("Student ID is required for updates");
      }
      
      try {
        console.log('[Frontend] Updating student with data:', student);
        
        // Map our form data to match backend expected format
        const updateData = {
          full_name: student.full_name,
          email: student.email,
          student_id: student.student_id,
          faculty_id: student.faculty_id, // For backend faculty relationship
          semester: student.semester,
          year: student.year,
          batch: student.batch,
          phone_number: student.phone_number,
          emergency_contact: student.emergency_contact,
        };
        
        console.log('[Frontend] Mapped update data for API:', updateData);
        
        const result = await api.students.update(student.id, updateData);
        console.log('[Frontend] Student update successful:', result);
        return result;
      } catch (error) {
        console.error('Error updating student:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[Frontend] Student update successful, refreshing student list');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetch(); // Explicitly refetch students data
      setSelectedStudent(undefined);
      setActiveTab('list');
      toast({
        title: "Student Updated",
        description: "The student has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update student: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete student mutation - following the same pattern as add student
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      try {
        console.log('[Frontend] Starting delete mutation for student ID:', studentId);
        console.log('[Frontend] Student ID type:', typeof studentId);
        
        // Basic validation
        if (!studentId || studentId === 'undefined' || studentId === 'null') {
          throw new Error("Invalid student ID provided");
        }
        
        // Call the API delete method (same pattern as create)
        const result = await api.students.delete(studentId);
        console.log('[Frontend] Delete API call completed successfully');
        return studentId;
      } catch (error) {
        console.error('[Frontend] Error in delete mutation:', error);
        throw error;
      }
    },
    onSuccess: (deletedStudentId) => {
      console.log('[Frontend] Delete mutation onSuccess triggered for:', deletedStudentId);
      // Same pattern as add student - invalidate queries and show toast
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refetch(); // Explicitly refetch students data
      toast({
        title: "Student Deleted",
        description: "The student has been successfully removed from the system.",
      });
    },
    onError: (error) => {
      console.error('[Frontend] Delete mutation onError triggered:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleAddNewClick = () => {
    setSelectedStudent(undefined);
    setActiveTab('form');
  };

  const handleEditStudent = (student: StudentFormData) => {
    setSelectedStudent(student);
    setActiveTab('form');
  };

  const handleDeleteStudent = (studentId: string) => {
    console.log("Attempting to delete student with ID:", studentId);
    console.log("Student ID type:", typeof studentId);

    // Enhanced validation
    if (!studentId || studentId === 'undefined' || studentId === 'null' || studentId.trim() === '') {
      console.error("Invalid student ID provided:", studentId);
      toast({
        title: "Error",
        description: "Cannot delete student: Invalid or missing student ID",
        variant: "destructive",
      });
      return;
    }

    // Convert to number to validate it's a valid ID
    const numericId = parseInt(studentId);
    if (isNaN(numericId) || numericId <= 0) {
      console.error("Student ID is not a valid number:", studentId);
      toast({
        title: "Error",
        description: "Cannot delete student: Student ID must be a valid number",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this student? This action cannot be undone and will remove all associated data including attendance records and marks.');
    console.log("Delete confirmation result:", confirmed);

    if (confirmed) {
      console.log("Proceeding with deletion for student ID:", studentId);
      deleteStudentMutation.mutate(studentId);
    } else {
      console.log("User cancelled deletion");
    }
  };

  const onSubmit = (data: StudentFormData) => {
    if (selectedStudent) {
      updateStudentMutation.mutate({ ...data, id: selectedStudent.id });
    } else {
      addStudentMutation.mutate(data);
    }
  };

  // Handle authentication errors (after all hooks)
  if (error && (error.message.includes('authenticated') || error.message.includes('expired'))) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button 
            onClick={() => {
              localStorage.removeItem('authToken');
              window.location.href = '/login';
            }}
            className="bg-brand-500 hover:bg-brand-600"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Students Management</h1>
        {activeTab === 'list' ? (
          <Button onClick={handleAddNewClick} className="bg-brand-500 hover:bg-brand-600">
            Add New Student
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setActiveTab('list')}>
            Back to List
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list">Students List</TabsTrigger>
          <TabsTrigger value="form">
            {selectedStudent ? 'Edit Student' : 'Add Student'}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-6">
          <div className="mb-4 space-y-4">
            {/* Enhanced Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, student ID, email, or faculty... (supports partial matching)"
                    className="w-full border rounded px-10 py-3 bg-slate-900 text-white placeholder:text-slate-400 border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={searchStudentId}
                    onChange={e => setSearchStudentId(e.target.value)}
                  />
                  {searchStudentId && (
                    <button
                      onClick={() => setSearchStudentId('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {searchStudentId && (
                  <p className="text-xs text-slate-400 mt-1">
                    Searching across: Name, Student ID, Email, Faculty
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <label className="font-medium text-slate-200 whitespace-nowrap">Faculty:</label>
                <select
                  className="border rounded px-3 py-3 min-w-[180px] bg-slate-900 text-white border-slate-600 focus:border-blue-500"
                  value={selectedFaculty}
                  onChange={e => setSelectedFaculty(e.target.value)}
                >
                  <option value="">All Faculties</option>
                  {faculties.map(faculty => (
                    <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filters Display */}
            {(selectedFaculty || searchStudentId.trim()) && (
              <div className="flex flex-wrap gap-2">
                {searchStudentId.trim() && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-sm">
                    <Search className="h-3 w-3" />
                    <span>Search: "{searchStudentId}"</span>
                    <button
                      onClick={() => setSearchStudentId('')}
                      className="hover:text-blue-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {selectedFaculty && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-300 border border-green-400/30 rounded-full text-sm">
                    <GraduationCap className="h-3 w-3" />
                    <span>Faculty: {faculties.find(f => f.id === Number(selectedFaculty))?.name}</span>
                    <button
                      onClick={() => setSelectedFaculty('')}
                      className="hover:text-green-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {selectedFaculty || searchStudentId.trim() ? (
            filteredStudents.length > 0 ? (
              <>
                <div className="mb-4 text-sm text-slate-400">
                  Showing {filteredStudents.length} student(s)
                  {selectedFaculty && ` from ${faculties.find(f => f.id === Number(selectedFaculty))?.name}`}
                  {searchStudentId.trim() && ` matching "${searchStudentId}"`}
                </div>
                <StudentList 
                  students={filteredStudents} 
                  onEdit={handleEditStudent}
                  onDelete={handleDeleteStudent}
                  isLoading={isLoading}
                />
              </>
            ) : (
              <div className="text-center text-slate-500 py-12">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2">No students found</p>
                <p className="text-sm">
                  {selectedFaculty && `No students found for the selected faculty`}
                  {searchStudentId.trim() && ` matching "${searchStudentId}"`}
                </p>
                <p className="text-sm mt-2">Try adjusting your search criteria or filters.</p>
              </div>
            )
          ) : (
            <div className="text-center text-slate-500 py-12">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">Search for Students</p>
              <p className="text-sm">Use the search bar above to find students by name, ID, email, or select a faculty to filter results.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="form" className="mt-6">
          <StudentFormEnhanced 
            onSubmit={onSubmit}
            initialData={selectedStudent}
            isLoading={addStudentMutation.isPending || updateStudentMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsPage;
