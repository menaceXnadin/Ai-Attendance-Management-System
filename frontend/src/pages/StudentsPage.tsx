import React, { useState } from 'react';
import StudentFormEnhanced, { StudentFormData } from '@/components/StudentFormEnhanced';
import StudentList from '@/components/StudentList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, X, GraduationCap, Users, User, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { StudentCreateData } from '@/integrations/api/types';
import { useAuth } from '@/contexts/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// No longer needed with the simplified form

const StudentsPage = () => {
  const [selectedStudent, setSelectedStudent] = useState<StudentFormData | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('list');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [searchStudentId, setSearchStudentId] = useState<string>('');
  // Advanced filters
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [hasEmail, setHasEmail] = useState<'any' | 'yes' | 'no'>('any');
  const [sortBy, setSortBy] = useState<'name' | 'batch' | 'semester' | 'year'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
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
          phone_number: student.phone_number || '',
          emergency_contact: student.emergency_contact || '',
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

  // Derive dynamic options from loaded students
  const batchOptions = React.useMemo(() => {
    const set = new Set<number>();
    students.forEach(s => {
      if (s.batch) set.add(Number(s.batch));
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [students]);

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
        s.faculty?.toLowerCase().includes(query) ||
        s.phone_number?.toLowerCase().includes(query) ||
        String(s.batch || '').includes(query)
      );
    }

    // Filter by semesters
    if (selectedSemesters.length > 0) {
      const set = new Set(selectedSemesters);
      filtered = filtered.filter(s => set.has(Number(s.semester)));
    }

    // Filter by years
    if (selectedYears.length > 0) {
      const set = new Set(selectedYears);
      filtered = filtered.filter(s => set.has(Number(s.year)));
    }

    // Filter by batch
    if (selectedBatch) {
      filtered = filtered.filter(s => Number(s.batch) === Number(selectedBatch));
    }

    // Filter by email availability
    if (hasEmail !== 'any') {
      filtered = filtered.filter(s => {
        const has = !!(s.email && s.email !== 'unknown@example.com');
        return hasEmail === 'yes' ? has : !has;
      });
    }

    // Sorting
    const compare = (a: any, b: any) => {
      let res = 0;
      if (sortBy === 'name') {
        res = (a.full_name || '').localeCompare(b.full_name || '');
      } else if (sortBy === 'batch') {
        res = Number(a.batch || 0) - Number(b.batch || 0);
      } else if (sortBy === 'semester') {
        res = Number(a.semester || 0) - Number(b.semester || 0);
      } else if (sortBy === 'year') {
        res = Number(a.year || 0) - Number(b.year || 0);
      }
      return sortDir === 'asc' ? res : -res;
    };

    return [...filtered].sort(compare);
  }, [students, selectedFaculty, searchStudentId, selectedSemesters, selectedYears, selectedBatch, hasEmail, sortBy, sortDir]);

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
        // Note: student_id is NOT included - backend will auto-generate it
        const createData: StudentCreateData = {
          name: student.full_name,
          email: student.email,
          // studentId: student.student_id,  // Removed - backend auto-generates
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
    onSuccess: (data) => {
      console.log('[Frontend] Student addition successful:', data);
      console.log('[Frontend] Auto-generated Student ID:', data.student_id);
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void refetch(); // Explicitly refetch students data
      setActiveTab('list');
      toast({
        title: "Student Added Successfully! 🎉",
        description: `Student ID ${data.student_id} has been auto-generated and assigned.`,
        duration: 5000,
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
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void refetch(); // Explicitly refetch students data
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
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void refetch(); // Explicitly refetch students data
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

  const handleSort = (field: 'name' | 'batch' | 'semester' | 'year') => {
    if (sortBy === field) {
      // Toggle direction if same field
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortBy(field);
      setSortDir('asc');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-6 lg:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
      {/* Modern Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 dark:from-slate-50 dark:via-blue-200 dark:to-slate-50 bg-clip-text text-transparent">
            Student Management
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            {activeTab === 'list' 
              ? `Manage and monitor ${students.length} registered students`
              : selectedStudent ? 'Update student information' : 'Register a new student'}
          </p>
        </div>
        {activeTab === 'list' ? (
          <Button 
            onClick={handleAddNewClick} 
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 px-6 h-11"
          >
            <User className="h-4 w-4 mr-2" />
            Add New Student
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={() => { setActiveTab('list'); }}
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 px-6 h-11"
          >
            <X className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="hidden">
          <TabsTrigger value="list">Students List</TabsTrigger>
          <TabsTrigger value="form">
            {selectedStudent ? 'Edit Student' : 'Add Student'}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="space-y-6">
          {/* Enhanced Search and Filter Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            {/* Enhanced Search Bar */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200">
                <Search className={`h-5 w-5 ${searchStudentId ? 'text-blue-500' : 'text-slate-400'} transition-colors duration-200`} />
              </div>
              <input
                type="text"
                placeholder="Search by name, student ID, email, phone, faculty, or batch..."
                className="w-full border-2 rounded-lg px-12 py-3.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 text-base font-medium"
                value={searchStudentId}
                onChange={e => { setSearchStudentId(e.target.value); }}
              />
              {searchStudentId && (
                <button
                  onClick={() => { setSearchStudentId(''); }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full p-2 transition-all duration-200 hover:scale-110"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {searchStudentId && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Searching across: Name • Student ID • Email • Phone • Faculty • Batch</span>
              </div>
            )}

            {/* Advanced Filters - Redesigned */}
            <Accordion type="single" collapsible className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-xl overflow-hidden">
              <AccordionItem value="advanced" className="border-none">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline group/trigger">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 group-hover/trigger:border-blue-400/50 transition-all duration-300 group-hover/trigger:scale-110">
                        <SlidersHorizontal className="h-4 w-4 text-blue-400 group-hover/trigger:rotate-180 transition-transform duration-500" />
                      </div>
                      <div>
                        <span className="text-lg font-semibold text-slate-100 group-hover/trigger:text-white transition-colors duration-200">Advanced Filters</span>
                        <p className="text-xs text-slate-400 mt-0.5">Refine your student search</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-6">
                      {/* Faculty Filter */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 hover:border-slate-600/70 transition-all duration-300">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                          <GraduationCap className="h-4 w-4 text-green-400" />
                          Faculty
                        </label>
                        <select
                          className="w-full border rounded-lg px-4 py-2.5 bg-slate-900/80 text-white border-slate-600/50 focus:border-green-500/70 focus:ring-2 focus:ring-green-500/20 hover:border-slate-500/70 transition-all duration-200 cursor-pointer shadow-sm"
                          value={selectedFaculty}
                          onChange={e => { setSelectedFaculty(e.target.value); }}
                        >
                          <option value="">All Faculties</option>
                          {faculties.map(faculty => (
                            <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Academic Filters Grid */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Semesters */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300 group/semester">
                          <p className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400 group-hover/semester:animate-pulse"></span>
                            Semester
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                              <button
                                key={num}
                                onClick={() => {
                                  setSelectedSemesters(prev => 
                                    prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                                  );
                                }}
                                className={`p-2 rounded-md border transition-all duration-200 cursor-pointer text-xs font-medium ${
                                  selectedSemesters.includes(num)
                                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                                    : 'border-slate-600/40 text-slate-300 hover:border-purple-400/50 hover:bg-purple-500/10 hover:text-white'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Years */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 hover:border-amber-500/30 transition-all duration-300 group/year">
                          <p className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 group-hover/year:animate-pulse"></span>
                            Year
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 4 }, (_, i) => i + 1).map(num => (
                              <button
                                key={num}
                                onClick={() => {
                                  setSelectedYears(prev => 
                                    prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                                  );
                                }}
                                className={`p-2 rounded-md border transition-all duration-200 cursor-pointer text-xs font-medium ${
                                  selectedYears.includes(num)
                                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                                    : 'border-slate-600/40 text-slate-300 hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-white'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Batch */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 hover:border-sky-500/30 transition-all duration-300 group/batch">
                          <label className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-sky-400 group-hover/batch:animate-pulse"></span>
                            Batch
                          </label>
                          <select
                            className="w-full border rounded-lg px-3 py-2 bg-slate-900/80 text-white border-slate-600/50 focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/20 hover:border-slate-500/70 transition-all duration-200 cursor-pointer text-sm"
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                          >
                            <option value="">All Batches</option>
                            {batchOptions.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>

                        {/* Email presence */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 hover:border-pink-500/30 transition-all duration-300 group/email">
                          <label className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-pink-400 group-hover/email:animate-pulse"></span>
                            Email Status
                          </label>
                          <select
                            className="w-full border rounded-lg px-3 py-2 bg-slate-900/80 text-white border-slate-600/50 focus:border-pink-500/70 focus:ring-2 focus:ring-pink-500/20 hover:border-slate-500/70 transition-all duration-200 cursor-pointer text-sm"
                            value={hasEmail}
                            onChange={(e) => setHasEmail(e.target.value as any)}
                          >
                            <option value="any">Any</option>
                            <option value="yes">Has Email</option>
                            <option value="no">Missing Email</option>
                          </select>
                        </div>
                      </div>

                      {/* Clear filters action */}
                      <div className="flex justify-end pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedFaculty('');
                            setSelectedSemesters([]);
                            setSelectedYears([]);
                            setSelectedBatch('');
                            setHasEmail('any');
                          }}
                          className="border-slate-600/50 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 group/clear"
                        >
                          <X className="h-4 w-4 mr-2 group-hover/clear:rotate-90 transition-transform duration-300" />
                          Clear All Filters
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

            {/* Active Filters Display */}
            {(selectedFaculty || searchStudentId.trim() || selectedSemesters.length || selectedYears.length || selectedBatch || hasEmail !== 'any') && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Active Filters</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-300 dark:from-slate-700 to-transparent"></div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {searchStudentId.trim() && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-500/30 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 group">
                      <Search className="h-3.5 w-3.5" />
                      <span>"{searchStudentId}"</span>
                      <button
                        onClick={() => { setSearchStudentId(''); }}
                        className="hover:text-blue-900 dark:hover:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-full p-1 transition-all duration-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {selectedFaculty && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-500/30 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 group">
                      <GraduationCap className="h-3.5 w-3.5" />
                      <span>{faculties.find(f => f.id === Number(selectedFaculty))?.name}</span>
                      <button
                        onClick={() => { setSelectedFaculty(''); }}
                        className="hover:text-emerald-900 dark:hover:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-full p-1 transition-all duration-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {selectedSemesters.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-2 border-purple-200 dark:border-purple-500/30 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
                      <span>Sem: {selectedSemesters.sort((a,b)=>a-b).join(', ')}</span>
                      <button onClick={() => setSelectedSemesters([])} className="hover:text-purple-900 dark:hover:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-full p-1 transition-all duration-200">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {selectedYears.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-2 border-amber-200 dark:border-amber-500/30 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
                      <span>Year: {selectedYears.sort((a,b)=>a-b).join(', ')}</span>
                      <button onClick={() => setSelectedYears([])} className="hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-full p-1 transition-all duration-200">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {selectedBatch && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-2 border-sky-200 dark:border-sky-500/30 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
                      <span>Batch: {selectedBatch}</span>
                      <button onClick={() => setSelectedBatch('')} className="hover:text-sky-900 dark:hover:text-sky-100 hover:bg-sky-100 dark:hover:bg-sky-500/20 rounded-full p-1 transition-all duration-200">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {hasEmail !== 'any' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-300 border-2 border-pink-200 dark:border-pink-500/30 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
                      <span>{hasEmail === 'yes' ? '✓ Has Email' : '✗ Missing Email'}</span>
                      <button onClick={() => setHasEmail('any')} className="hover:text-pink-900 dark:hover:text-pink-100 hover:bg-pink-100 dark:hover:bg-pink-500/20 rounded-full p-1 transition-all duration-200">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchStudentId('');
                      setSelectedFaculty('');
                      setSelectedSemesters([]);
                      setSelectedYears([]);
                      setSelectedBatch('');
                      setHasEmail('any');
                    }}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 ml-2 font-medium"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Clear All
                  </Button>
                </div>
              </div>
            )}
          </div>
          {/* Results Section */}
          {selectedFaculty || searchStudentId.trim() ? (
            filteredStudents.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span>Showing <span className="font-bold text-blue-600 dark:text-blue-400">{filteredStudents.length}</span> student{filteredStudents.length !== 1 ? 's' : ''}</span>
                    </div>
                    {(selectedFaculty || searchStudentId.trim()) && (
                      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                    )}
                    {selectedFaculty && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        from <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{faculties.find(f => f.id === Number(selectedFaculty))?.name}</span>
                      </span>
                    )}
                    {searchStudentId.trim() && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        matching <span className="text-blue-600 dark:text-blue-400 font-semibold">"{searchStudentId}"</span>
                      </span>
                    )}
                  </div>
                </div>
                <StudentList 
                  students={filteredStudents} 
                  onEdit={handleEditStudent}
                  onDelete={handleDeleteStudent}
                  isLoading={isLoading}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortChange={handleSort}
                />
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Search className="h-8 w-8 text-slate-400 dark:text-slate-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No students found</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedFaculty && `No students found for the selected faculty`}
                      {searchStudentId.trim() && ` matching "${searchStudentId}"`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 pt-2">Try adjusting your search criteria or filters.</p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-200 dark:border-slate-700">
                  <Users className="h-8 w-8 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ready to search</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Use the search bar above to find students by name, ID, email, or select a faculty to filter results.
                  </p>
                </div>
              </div>
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
    </div>
  );
};

export default StudentsPage;
