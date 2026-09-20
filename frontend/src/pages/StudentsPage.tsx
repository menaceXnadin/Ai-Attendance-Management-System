import React, { useState } from 'react';
import StudentFormEnhanced, { StudentFormData } from '@/components/StudentFormEnhanced';
import StudentList from '@/components/StudentList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Close, Education, UserMultiple, Add, Filter } from '@carbon/icons-react';
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
    const compare = (a: StudentFormData, b: StudentFormData) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-0.5">
          <h1 className="text-page-title font-semibold text-text-primary">
            Student Management
          </h1>
          <p className="text-xs text-text-muted">
            {activeTab === 'list' 
              ? `Manage and monitor ${students.length} registered students`
              : selectedStudent ? 'Update student information' : 'Register a new student'}
          </p>
        </div>
        {activeTab === 'list' ? (
          <Button 
            onClick={handleAddNewClick} 
            size="default"
            className="gap-2"
          >
            <Add size={16} aria-hidden="true" />
            Add New Student
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="default"
            onClick={() => { setActiveTab('list'); }}
            className="gap-2"
          >
            <Close size={16} aria-hidden="true" />
            Back to List
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="hidden">
          <TabsTrigger value="list">Students List</TabsTrigger>
          <TabsTrigger value="form">
            {selectedStudent ? 'Edit Student' : 'Add Student'}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="space-y-4">
          {/* Search and Filter Section */}
          <div className="rounded-lg border border-border bg-surface-default p-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                <Search size={16} aria-hidden="true" />
              </div>
              <input
                type="text"
                placeholder="Search by name, student ID, email, phone, faculty, or batch..."
                className="w-full rounded-md border border-border bg-surface-default pl-9 pr-9 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary transition-colors"
                value={searchStudentId}
                onChange={e => { setSearchStudentId(e.target.value); }}
              />
              {searchStudentId && (
                <button
                  type="button"
                  onClick={() => { setSearchStudentId(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 rounded"
                  aria-label="Clear search"
                >
                  <Close size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            {searchStudentId && (
              <div className="flex items-center gap-2 text-xs text-text-muted px-1">
                <span className="font-medium">Searching across: Name • Student ID • Email • Phone • Faculty • Batch</span>
              </div>
            )}

            {/* Advanced Filters */}
            <Accordion type="single" collapsible className="rounded-lg border border-border bg-surface-subtle/40 overflow-hidden">
              <AccordionItem value="advanced" className="border-none">
                <AccordionTrigger className="px-4 py-2.5 hover:no-underline text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-action-primary" aria-hidden="true" />
                    <span>Advanced Filters</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-1">
                    {/* Faculty Filter */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                        <Education size={14} aria-hidden="true" />
                        Faculty
                      </label>
                      <select
                        className="w-full rounded-md border border-border bg-surface-default px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
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
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      {/* Semesters */}
                      <div className="p-3 rounded-md border border-border bg-surface-default space-y-2">
                        <p className="text-xs font-semibold text-text-secondary">
                          Semester
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                setSelectedSemesters(prev => 
                                  prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                                );
                              }}
                              className={`py-1 rounded text-xs font-medium border transition-colors ${
                                selectedSemesters.includes(num)
                                  ? 'bg-action-primary text-white border-action-primary'
                                  : 'border-border text-text-secondary hover:bg-surface-subtle'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Years */}
                      <div className="p-3 rounded-md border border-border bg-surface-default space-y-2">
                        <p className="text-xs font-semibold text-text-secondary">
                          Year
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {Array.from({ length: 4 }, (_, i) => i + 1).map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                setSelectedYears(prev => 
                                  prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                                );
                              }}
                              className={`py-1 rounded text-xs font-medium border transition-colors ${
                                selectedYears.includes(num)
                                  ? 'bg-action-primary text-white border-action-primary'
                                  : 'border-border text-text-secondary hover:bg-surface-subtle'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Batch */}
                      <div className="p-3 rounded-md border border-border bg-surface-default space-y-2">
                        <label className="text-xs font-semibold text-text-secondary block">
                          Batch
                        </label>
                        <select
                          className="w-full rounded border border-border bg-surface-default px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
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
                      <div className="p-3 rounded-md border border-border bg-surface-default space-y-2">
                        <label className="text-xs font-semibold text-text-secondary block">
                          Email Status
                        </label>
                        <select
                          className="w-full rounded border border-border bg-surface-default px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
                          value={hasEmail}
                          onChange={(e) => setHasEmail(e.target.value as 'any' | 'yes' | 'no')}
                        >
                          <option value="any">Any</option>
                          <option value="yes">Has Email</option>
                          <option value="no">Missing Email</option>
                        </select>
                      </div>
                    </div>

                    {/* Clear filters action */}
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFaculty('');
                          setSelectedSemesters([]);
                          setSelectedYears([]);
                          setSelectedBatch('');
                          setHasEmail('any');
                        }}
                        className="text-xs text-text-muted hover:text-status-error gap-1.5"
                      >
                        <Close size={14} aria-hidden="true" />
                        Clear All Filters
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Active Filters Display */}
            {(selectedFaculty || searchStudentId.trim() || selectedSemesters.length || selectedYears.length || selectedBatch || hasEmail !== 'any') && (
              <div className="pt-2">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mr-1">Active Filters:</span>
                  {searchStudentId.trim() && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-subtle border border-border text-text-primary">
                      <span>"{searchStudentId}"</span>
                      <button onClick={() => setSearchStudentId('')} className="hover:text-status-error ml-0.5" aria-label="Remove search filter">
                        <Close size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {selectedFaculty && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-subtle border border-border text-text-primary">
                      <span>{faculties.find(f => f.id === Number(selectedFaculty))?.name}</span>
                      <button onClick={() => setSelectedFaculty('')} className="hover:text-status-error ml-0.5" aria-label="Remove faculty filter">
                        <Close size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {selectedSemesters.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-subtle border border-border text-text-primary">
                      <span>Sem: {selectedSemesters.sort((a,b)=>a-b).join(', ')}</span>
                      <button onClick={() => setSelectedSemesters([])} className="hover:text-status-error ml-0.5" aria-label="Remove semester filter">
                        <Close size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {selectedYears.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-subtle border border-border text-text-primary">
                      <span>Year: {selectedYears.sort((a,b)=>a-b).join(', ')}</span>
                      <button onClick={() => setSelectedYears([])} className="hover:text-status-error ml-0.5" aria-label="Remove year filter">
                        <Close size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {selectedBatch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-subtle border border-border text-text-primary">
                      <span>Batch: {selectedBatch}</span>
                      <button onClick={() => setSelectedBatch('')} className="hover:text-status-error ml-0.5" aria-label="Remove batch filter">
                        <Close size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {hasEmail !== 'any' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-subtle border border-border text-text-primary">
                      <span>{hasEmail === 'yes' ? 'Has Email' : 'Missing Email'}</span>
                      <button onClick={() => setHasEmail('any')} className="hover:text-status-error ml-0.5" aria-label="Remove email filter">
                        <Close size={12} aria-hidden="true" />
                      </button>
                    </span>
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
                    className="h-6 px-2 text-xs text-text-muted hover:text-text-primary"
                  >
                    Reset All
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <UserMultiple size={16} className="text-action-primary" aria-hidden="true" />
                <span>Showing <strong className="text-text-primary tabular-nums">{filteredStudents.length}</strong> of <strong className="text-text-primary tabular-nums">{students.length}</strong> students</span>
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
        </TabsContent>
        
        <TabsContent value="form" className="mt-4">
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
