import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { 
  Trash2, 
  Plus, 
  Loader2, 
  ChevronRight, 
  ArrowLeft, 
  BookOpen, 
  Users,
  Edit3,
  Save,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface Faculty {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
  credits: number;
  faculty_id: number;
  class_schedule?: {
    semester?: number;
    days?: string[];
    time?: string;
    faculty?: string;
  };
}

type ViewMode = 'faculties' | 'semesters' | 'classes';

const FacultiesPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('faculties');
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [newFaculty, setNewFaculty] = useState({ name: '', code: '', description: '' });
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', code: '', description: '', credits: 3 });
  const [editingClass, setEditingClass] = useState<Subject | null>(null);
  const [deletingFaculty, setDeletingFaculty] = useState<Faculty | null>(null);
  const [cascadePreview, setCascadePreview] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch faculties
  const { data: faculties = [], isLoading: facultiesLoading, refetch: refetchFaculties } = useQuery({
    queryKey: ['faculties'],
    queryFn: async () => {
      const response = await api.faculties.getAll();
      return response;
    },
  });

  // Fetch subjects for selected faculty
  const { data: subjects = [], isLoading: subjectsLoading, refetch: refetchSubjects } = useQuery({
    queryKey: ['subjects', selectedFaculty?.id],
    queryFn: async () => {
      if (!selectedFaculty) return [];
      const response = await api.subjects.getByFaculty(selectedFaculty.id);
      return response;
    },
    enabled: !!selectedFaculty,
  });

  // Add faculty mutation
  const addFacultyMutation = useMutation({
    mutationFn: async (facultyData: { name: string; code: string; description?: string }) => {
      return await api.faculties.create(facultyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      setIsAddingFaculty(false);
      setNewFaculty({ name: '', code: '', description: '' });
      toast({
        title: "Faculty Added",
        description: "The faculty has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to add faculty: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete faculty mutation
  const deleteFacultyMutation = useMutation({
    mutationFn: async ({ facultyId, force }: { facultyId: number; force: boolean }) => {
      return await api.faculties.delete(facultyId, force);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      setDeletingFaculty(null);
      setCascadePreview(null);
      toast({
        title: "Faculty Deleted",
        description: "The faculty has been successfully removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete faculty",
        variant: "destructive",
      });
    }
  });

  // Add subject mutation
  const addSubjectMutation = useMutation({
    mutationFn: async (subjectData: {
      name: string;
      code: string;
      description?: string;
      credits: number;
      faculty_id: number;
    }) => {
      return await api.subjects.create(subjectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', selectedFaculty?.id] });
      setIsAddingClass(false);
      setNewClass({ name: '', code: '', description: '', credits: 3 });
      toast({
        title: "Class Added",
        description: "The class has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to add class: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (subjectId: number) => {
      return await api.subjects.delete(subjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', selectedFaculty?.id] });
      toast({
        title: "Class Deleted",
        description: "The class has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete class: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleAddFaculty = () => {
    if (!newFaculty.name.trim()) {
      toast({
        title: "Error",
        description: "Faculty name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!newFaculty.code.trim()) {
      toast({
        title: "Error",
        description: "Faculty code is required.",
        variant: "destructive",
      });
      return;
    }
    if (newFaculty.code.length !== 4 || !/^[A-Z]+$/.test(newFaculty.code)) {
      toast({
        title: "Error",
        description: "Faculty code must be exactly 4 uppercase letters (e.g., CSCI, MATH).",
        variant: "destructive",
      });
      return;
    }
    addFacultyMutation.mutate(newFaculty);
  };

  const handleDeleteFaculty = async (facultyId: number, facultyName: string) => {
    const faculty = faculties.find((f: Faculty) => f.id === facultyId);
    if (!faculty) return;
    
    setDeletingFaculty(faculty);
    setIsLoadingPreview(true);
    
    try {
      // Fetch cascade preview
      const preview = await api.faculties.getCascadePreview(facultyId);
      setCascadePreview(preview);
      setIsLoadingPreview(false);
    } catch (error) {
      setIsLoadingPreview(false);
      toast({
        title: "Error",
        description: "Failed to load deletion preview",
        variant: "destructive",
      });
    }
  };
  
  const confirmDeleteFaculty = () => {
    if (!deletingFaculty) return;
    deleteFacultyMutation.mutate({ 
      facultyId: deletingFaculty.id, 
      force: true 
    });
  };

  const handleFacultySelect = (faculty: Faculty) => {
    setSelectedFaculty(faculty);
    setViewMode('semesters');
  };

  const handleSemesterSelect = (semester: number) => {
    setSelectedSemester(semester);
    setViewMode('classes');
  };

  const handleAddClass = () => {
    if (!newClass.name.trim() || !newClass.code.trim()) {
      toast({
        title: "Error",
        description: "Class name and code are required.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedFaculty) {
      toast({
        title: "Error",
        description: "No faculty selected.",
        variant: "destructive",
      });
      return;
    }

    addSubjectMutation.mutate({
      ...newClass,
      faculty_id: selectedFaculty.id,
    });
  };

  const handleDeleteClass = (subjectId: number, className: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${className}"?`);
    if (confirmed) {
      deleteSubjectMutation.mutate(subjectId);
    }
  };

  const resetToFaculties = () => {
    setViewMode('faculties');
    setSelectedFaculty(null);
    setSelectedSemester(null);
  };

  const backToSemesters = () => {
    setViewMode('semesters');
    setSelectedSemester(null);
  };

  // Filter subjects by selected semester
  const semesterSubjects = subjects.filter(subject => {
    // Check if subject has class_schedule with semester info
    if (subject.class_schedule && typeof subject.class_schedule === 'object') {
      const schedule = subject.class_schedule as { semester?: number };
      return schedule.semester === selectedSemester;
    }
    return false;
  });

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="p-6 md:p-8">
      <div className="space-y-8 px-1">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 px-1">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={resetToFaculties}
          className={`text-sm font-medium transition-all duration-200 ${
            viewMode === 'faculties' 
              ? 'text-white bg-slate-800/50' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
          }`}
        >
          Faculties
        </Button>
        {selectedFaculty && (
          <>
            <ChevronRight className="h-4 w-4 text-slate-600" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={backToSemesters}
              className={`text-sm font-medium transition-all duration-200 ${
                viewMode === 'semesters' 
                  ? 'text-white bg-slate-800/50' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
              }`}
            >
              {selectedFaculty.name}
            </Button>
          </>
        )}
        {selectedSemester && (
          <>
            <ChevronRight className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-white bg-slate-800/50 px-3 py-1.5 rounded-md">
              Semester {selectedSemester}
            </span>
          </>
        )}
      </div>

      {/* Faculty List View */}
      {viewMode === 'faculties' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Faculty Management</h1>
              <p className="text-slate-400 text-sm">
                Organize and manage academic faculties, departments, and their curriculum structure
              </p>
            </div>
            <Button 
              onClick={() => setIsAddingFaculty(true)}
              disabled={isAddingFaculty}
              className="h-11 px-6 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Faculty
            </Button>
          </div>

          {/* Add Faculty Form */}
          {isAddingFaculty && (
            <Card className="border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
              <CardHeader className="border-b border-slate-700/50 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-semibold text-white flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                        <Plus className="h-5 w-5 text-white" />
                      </div>
                      Create New Faculty
                    </CardTitle>
                    <p className="text-sm text-slate-400 mt-2">
                      Add a new faculty to your institution's academic structure
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingFaculty(false);
                      setNewFaculty({ name: '', code: '', description: '' });
                    }}
                    disabled={addFacultyMutation.isPending}
                    className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-8 pb-6">
                <div className="space-y-7">
                  {/* Faculty Name Field */}
                  <div className="space-y-2.5">
                    <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      Faculty Name
                      <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={newFaculty.name}
                      onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                      placeholder="e.g., Computer Science, Engineering, Mathematics"
                      className="h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                    <p className="text-xs text-slate-500 leading-relaxed">
                      The full name of the faculty or department
                    </p>
                  </div>

                  {/* Faculty Code Field */}
                  <div className="space-y-2.5">
                    <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      Faculty Code
                      <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        value={newFaculty.code}
                        onChange={(e) => setNewFaculty({ ...newFaculty, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., CSCI, MATH, ENGN"
                        maxLength={4}
                        className="h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-mono text-lg tracking-[0.15em] uppercase pr-12"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                        {newFaculty.code.length}/4
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-xs">ℹ</span>
                      </div>
                      <p className="text-xs text-blue-300/90 leading-relaxed">
                        Enter exactly <strong className="font-semibold">4 uppercase letters</strong> as a unique identifier
                        <br />
                        <span className="text-blue-400/70">Examples: CSCI (Computer Science), MATH (Mathematics), PHYS (Physics)</span>
                      </p>
                    </div>
                  </div>

                  {/* Description Field */}
                  <div className="space-y-2.5">
                    <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      Description
                      <span className="text-xs text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <Textarea
                      value={newFaculty.description}
                      onChange={(e) => setNewFaculty({ ...newFaculty, description: e.target.value })}
                      placeholder="Provide additional details about this faculty, its programs, or focus areas..."
                      rows={4}
                      className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                    />
                    <p className="text-xs text-slate-500 leading-relaxed">
                      A brief overview to help identify and describe this faculty
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-700/30">
                    <Button 
                      onClick={handleAddFaculty}
                      disabled={addFacultyMutation.isPending}
                      className="h-11 px-6 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
                    >
                      {addFacultyMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating Faculty...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Faculty
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsAddingFaculty(false);
                        setNewFaculty({ name: '', code: '', description: '' });
                      }}
                      disabled={addFacultyMutation.isPending}
                      className="h-11 px-6 border-slate-700/50 text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Faculties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {facultiesLoading ? (
              <div className="col-span-full flex flex-col justify-center items-center py-20">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-slate-700/30 border-t-blue-500 animate-spin" />
                  <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-teal-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <p className="text-slate-400 mt-6 font-medium">Loading faculties...</p>
              </div>
            ) : faculties.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mb-6">
                  <Users className="h-12 w-12 text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Faculties Yet</h3>
                <p className="text-slate-400 text-center max-w-md mb-6">
                  Get started by creating your first faculty. Faculties help organize your institution's academic structure.
                </p>
                <Button 
                  onClick={() => setIsAddingFaculty(true)}
                  className="h-11 px-6 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium shadow-lg shadow-blue-500/25"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Faculty
                </Button>
              </div>
            ) : (
              faculties.map((faculty: Faculty) => (
                <Card 
                  key={faculty.id} 
                  className="group relative overflow-hidden cursor-pointer bg-slate-900/40 backdrop-blur-xl border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
                  onClick={() => handleFacultySelect(faculty)}
                >
                  {/* Gradient Background Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-teal-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <CardContent className="relative p-6">
                    {/* Header Section */}
                    <div className="flex items-start gap-4 mb-5">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                          <Users className="h-7 w-7 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-slate-900 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-lg mb-1.5 group-hover:text-blue-400 transition-colors duration-200 truncate">
                          {faculty.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/50 font-medium">
                            {new Date(faculty.created_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-lg bg-slate-800/50 flex items-center justify-center group-hover:bg-blue-500/20 transition-all duration-200">
                          <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Description */}
                    {faculty.description ? (
                      <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 mb-5 min-h-[2.5rem]">
                        {faculty.description}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600 italic mb-5 min-h-[2.5rem]">
                        No description provided
                      </p>
                    )}
                    
                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/30">
                      <span className="text-xs font-medium text-slate-500 group-hover:text-blue-400 transition-colors duration-200 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Manage Curriculum
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFaculty(faculty.id, faculty.name);
                        }}
                        disabled={deleteFacultyMutation.isPending}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Semesters View */}
      {viewMode === 'semesters' && selectedFaculty && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetToFaculties}
              className="h-9 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800/50 hover:border-slate-600 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Faculties
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{selectedFaculty.name}</h1>
              <p className="text-slate-400 text-sm">
                Select a semester to view and manage courses
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {semesters.map((semester) => {
              // Count subjects for this specific semester
              const semesterClassCount = subjects.filter(subject => {
                if (subject.class_schedule && typeof subject.class_schedule === 'object') {
                  const schedule = subject.class_schedule as { semester?: number };
                  return schedule.semester === semester;
                }
                return false;
              }).length;
              
              return (
                <Card 
                  key={semester}
                  className="group relative overflow-hidden cursor-pointer bg-slate-900/40 backdrop-blur-xl border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1"
                  onClick={() => handleSemesterSelect(semester)}
                >
                  {/* Gradient Background Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <CardContent className="relative p-6 text-center">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-lg shadow-purple-500/30">
                      <BookOpen className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-semibold text-white text-lg mb-2 group-hover:text-purple-400 transition-colors duration-200">
                      Semester {semester}
                    </h3>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className={`h-2 w-2 rounded-full ${semesterClassCount > 0 ? 'bg-green-500' : 'bg-slate-600'}`} />
                      <p className="text-sm text-slate-400 font-medium">
                        {semesterClassCount > 0 ? `${semesterClassCount} ${semesterClassCount === 1 ? 'class' : 'classes'}` : 'No classes'}
                      </p>
                    </div>
                    <div className="h-8 w-8 mx-auto rounded-lg bg-slate-800/50 flex items-center justify-center group-hover:bg-purple-500/20 transition-all duration-200">
                      <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all duration-200" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Classes View */}
      {viewMode === 'classes' && selectedFaculty && selectedSemester && (
        <>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={backToSemesters}
                className="h-9 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800/50 hover:border-slate-600 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Semesters
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {selectedFaculty.name} - Semester {selectedSemester}
                </h1>
                <p className="text-slate-400 text-sm">
                  Manage courses and curriculum for this semester
                </p>
              </div>
            </div>
            
            <Button 
              onClick={() => setIsAddingClass(true)}
              disabled={isAddingClass}
              className="h-11 px-6 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </div>

          {/* Add Class Form */}
          {isAddingClass && (
            <Card className="border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
              <CardHeader className="border-b border-slate-700/50 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-semibold text-white flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                        <Plus className="h-5 w-5 text-white" />
                      </div>
                      Add New Class
                    </CardTitle>
                    <p className="text-sm text-slate-400 mt-2">
                      Create a new course for {selectedFaculty.name} - Semester {selectedSemester}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingClass(false);
                      setNewClass({ name: '', code: '', description: '', credits: 3 });
                    }}
                    disabled={addSubjectMutation.isPending}
                    className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-8 pb-6">
                <div className="space-y-7">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <Label htmlFor="className" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                        Class Name
                        <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="className"
                        value={newClass.name}
                        onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                        placeholder="e.g., Introduction to Programming"
                        className="h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="classCode" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                        Class Code
                        <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="classCode"
                        value={newClass.code}
                        onChange={(e) => setNewClass({ ...newClass, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., CS101, MATH201"
                        className="h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="classDescription" className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      Description
                      <span className="text-xs text-slate-500 font-normal">(Optional)</span>
                    </Label>
                    <Textarea
                      id="classDescription"
                      value={newClass.description}
                      onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                      placeholder="Provide a brief description of the course content, objectives, and learning outcomes..."
                      rows={4}
                      className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="credits" className="text-sm font-medium text-slate-200">
                      Credit Hours
                    </Label>
                    <Input
                      id="credits"
                      type="number"
                      min="1"
                      max="6"
                      value={newClass.credits}
                      onChange={(e) => setNewClass({ ...newClass, credits: parseInt(e.target.value) || 3 })}
                      className="h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 w-32"
                    />
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Typically ranges from 1 to 6 credit hours
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-700/30">
                    <Button 
                      onClick={handleAddClass}
                      disabled={addSubjectMutation.isPending}
                      className="h-11 px-6 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
                    >
                      {addSubjectMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding Class...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Class
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsAddingClass(false);
                        setNewClass({ name: '', code: '', description: '', credits: 3 });
                      }}
                      disabled={addSubjectMutation.isPending}
                      className="h-11 px-6 border-slate-700/50 text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Classes List */}
          <Card className="border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-xl">
            <CardHeader className="border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-white">
                    Course Catalog
                  </CardTitle>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {semesterSubjects.length} {semesterSubjects.length === 1 ? 'class' : 'classes'} in Semester {selectedSemester}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {subjectsLoading ? (
                <div className="flex flex-col justify-center items-center py-16">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-slate-700/30 border-t-blue-500 animate-spin" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-teal-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                  </div>
                  <p className="text-slate-400 mt-4 font-medium">Loading classes...</p>
                </div>
              ) : semesterSubjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mb-4">
                    <BookOpen className="h-10 w-10 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No Classes Yet</h3>
                  <p className="text-slate-400 text-center max-w-md mb-6">
                    Start building your curriculum by adding classes for this semester
                  </p>
                  <Button 
                    onClick={() => setIsAddingClass(true)}
                    className="h-11 px-6 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-medium shadow-lg shadow-blue-500/25"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Class
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-700/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-slate-800/30">
                        <TableHead className="text-slate-300 font-semibold">Class Name</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Code</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Credits</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Description</TableHead>
                        <TableHead className="text-right text-slate-300 font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semesterSubjects.map((subject: Subject) => (
                        <TableRow key={subject.id} className="border-slate-700/50 hover:bg-slate-800/30 transition-colors duration-150">
                          <TableCell className="font-medium text-white">{subject.name}</TableCell>
                          <TableCell>
                            <code className="px-2.5 py-1.5 bg-slate-800/70 border border-slate-700/50 rounded-md text-sm font-mono text-blue-400">
                              {subject.code}
                            </code>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-semibold">{subject.credits}</span>
                              <span className="text-xs text-slate-500">hrs</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-400 max-w-md">
                            {subject.description ? 
                              (subject.description.length > 60 ? 
                                subject.description.substring(0, 60) + '...' : 
                                subject.description
                              ) : 
                              <span className="text-slate-600 italic">No description</span>
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClass(subject.id, subject.name)}
                              disabled={deleteSubjectMutation.isPending}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Cascade Delete Confirmation Dialog */}
      <Dialog open={!!deletingFaculty} onOpenChange={(open) => {
        if (!open) {
          setDeletingFaculty(null);
          setCascadePreview(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              Confirm Faculty Deletion
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-base pt-2">
              You are about to delete <strong className="text-white">{deletingFaculty?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          {isLoadingPreview ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
              <p className="text-slate-400">Analyzing cascade effects...</p>
            </div>
          ) : cascadePreview && (
            <div className="space-y-6 py-4">
              {/* Warning Banner */}
              {!cascadePreview.is_safe_to_delete && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-400 text-sm font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-red-400 font-semibold mb-1">Critical Warning</h4>
                    <p className="text-red-300/90 text-sm leading-relaxed">
                      {cascadePreview.warning}
                    </p>
                  </div>
                </div>
              )}

              {/* What Will Be Deleted */}
              <div className="space-y-3">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-400" />
                  Will Be Permanently Deleted:
                </h4>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                    <span className="text-slate-300">Students</span>
                    <span className="font-mono font-bold text-red-400">{cascadePreview.will_delete.students.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                    <span className="text-slate-300">Subjects</span>
                    <span className="font-mono font-bold text-red-400">{cascadePreview.will_delete.subjects.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                    <span className="text-slate-300">Attendance Records</span>
                    <span className="font-mono font-bold text-red-400">{cascadePreview.will_delete.attendance_records.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* What Will Be Orphaned */}
              {cascadePreview.will_orphan.academic_events > 0 && (
                <div className="space-y-3">
                  <h4 className="text-white font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-yellow-400" />
                    Will Lose Faculty Reference:
                  </h4>
                  <div className="space-y-2 pl-6">
                    <div className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-300">Academic Events</span>
                      <span className="font-mono font-bold text-yellow-400">{cascadePreview.will_orphan.academic_events.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Safe to delete message */}
              {cascadePreview.is_safe_to_delete && (
                <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-400 text-sm font-bold">✓</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-green-400 font-semibold mb-1">Safe to Delete</h4>
                    <p className="text-green-300/90 text-sm leading-relaxed">
                      This faculty has no students. It's safe to delete.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={confirmDeleteFaculty}
                  disabled={deleteFacultyMutation.isPending}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-medium"
                >
                  {deleteFacultyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Yes, Delete Faculty
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeletingFaculty(null);
                    setCascadePreview(null);
                  }}
                  disabled={deleteFacultyMutation.isPending}
                  className="flex-1 h-11 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default FacultiesPage;
