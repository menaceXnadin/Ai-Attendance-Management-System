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
  const [newFaculty, setNewFaculty] = useState({ name: '', description: '' });
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', code: '', description: '', credits: 3 });
  const [editingClass, setEditingClass] = useState<Subject | null>(null);
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
    mutationFn: async (facultyData: { name: string; description?: string }) => {
      return await api.faculties.create(facultyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      setIsAddingFaculty(false);
      setNewFaculty({ name: '', description: '' });
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
    mutationFn: async (facultyId: number) => {
      return await api.faculties.delete(facultyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      toast({
        title: "Faculty Deleted",
        description: "The faculty has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete faculty: ${error.message}`,
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
    addFacultyMutation.mutate(newFaculty);
  };

  const handleDeleteFaculty = (facultyId: number, facultyName: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${facultyName}"? This will also delete all associated classes.`);
    if (confirmed) {
      deleteFacultyMutation.mutate(facultyId);
    }
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
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={resetToFaculties}
          className={viewMode === 'faculties' ? 'text-white' : 'text-slate-400 hover:text-white'}
        >
          Faculties
        </Button>
        {selectedFaculty && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={backToSemesters}
              className={viewMode === 'semesters' ? 'text-white' : 'text-slate-400 hover:text-white'}
            >
              {selectedFaculty.name}
            </Button>
          </>
        )}
        {selectedSemester && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white">Semester {selectedSemester}</span>
          </>
        )}
      </div>

      {/* Faculty List View */}
      {viewMode === 'faculties' && (
        <>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Faculty Management</h1>
            <Button 
              onClick={() => setIsAddingFaculty(true)}
              className="bg-brand-500 hover:bg-brand-600"
              disabled={isAddingFaculty}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Faculty
            </Button>
          </div>

          {/* Add Faculty Form */}
          {isAddingFaculty && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Faculty</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Faculty Name *</label>
                  <Input
                    value={newFaculty.name}
                    onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                    placeholder="Enter faculty name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <Textarea
                    value={newFaculty.description}
                    onChange={(e) => setNewFaculty({ ...newFaculty, description: e.target.value })}
                    placeholder="Enter faculty description (optional)"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddFaculty}
                    disabled={addFacultyMutation.isPending}
                    className="bg-brand-500 hover:bg-brand-600"
                  >
                    {addFacultyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Faculty
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddingFaculty(false);
                      setNewFaculty({ name: '', description: '' });
                    }}
                    disabled={addFacultyMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Faculties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facultiesLoading ? (
              <div className="col-span-full flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>Loading faculties...</span>
              </div>
            ) : faculties.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                No faculties found. Add a faculty to get started.
              </div>
            ) : (
              faculties.map((faculty: Faculty) => (
                <Card 
                  key={faculty.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow group bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-blue-500/30"
                  onClick={() => handleFacultySelect(faculty)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">{faculty.name}</h3>
                          <p className="text-sm text-slate-400">
                            Created {new Date(faculty.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                    
                    {faculty.description && (
                      <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                        {faculty.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Click to manage semesters</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFaculty(faculty.id, faculty.name);
                        }}
                        disabled={deleteFacultyMutation.isPending}
                        className="text-red-400 hover:text-red-300 border-red-400/30 hover:bg-red-500/10"
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
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetToFaculties}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Faculties
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{selectedFaculty.name}</h1>
              <p className="text-slate-400">Select a semester to manage classes</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  className="cursor-pointer hover:shadow-lg transition-all group bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-blue-500/30"
                  onClick={() => handleSemesterSelect(semester)}
                >
                  <CardContent className="p-6 text-center">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">Semester {semester}</h3>
                    <p className="text-sm text-slate-400 mb-2">
                      {semesterClassCount > 0 ? `${semesterClassCount} classes` : 'No classes'}
                    </p>
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors mx-auto" />
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={backToSemesters}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Semesters
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {selectedFaculty.name} - Semester {selectedSemester}
                </h1>
                <p className="text-slate-400">Manage classes for this semester</p>
              </div>
            </div>
            
            <Button 
              onClick={() => setIsAddingClass(true)}
              className="bg-brand-500 hover:bg-brand-600"
              disabled={isAddingClass}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </div>

          {/* Add Class Form */}
          {isAddingClass && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Class</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="className">Class Name *</Label>
                    <Input
                      id="className"
                      value={newClass.name}
                      onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                      placeholder="Enter class name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="classCode">Class Code *</Label>
                    <Input
                      id="classCode"
                      value={newClass.code}
                      onChange={(e) => setNewClass({ ...newClass, code: e.target.value })}
                      placeholder="Enter class code (e.g., CS101)"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="classDescription">Description</Label>
                  <Textarea
                    id="classDescription"
                    value={newClass.description}
                    onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                    placeholder="Enter class description (optional)"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="credits">Credits</Label>
                  <Input
                    id="credits"
                    type="number"
                    min="1"
                    max="6"
                    value={newClass.credits}
                    onChange={(e) => setNewClass({ ...newClass, credits: parseInt(e.target.value) || 3 })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddClass}
                    disabled={addSubjectMutation.isPending}
                    className="bg-brand-500 hover:bg-brand-600"
                  >
                    {addSubjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Class
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddingClass(false);
                      setNewClass({ name: '', code: '', description: '', credits: 3 });
                    }}
                    disabled={addSubjectMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Classes List */}
          <Card>
            <CardHeader>
              <CardTitle>Classes in {selectedFaculty.name} - Semester {selectedSemester}</CardTitle>
            </CardHeader>
            <CardContent>
              {subjectsLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Loading classes...</span>
                </div>
              ) : semesterSubjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="mx-auto h-12 w-12 opacity-30 mb-2" />
                  <p className="text-lg">No classes found for this semester</p>
                  <p className="text-sm">Add a class to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semesterSubjects.map((subject: Subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-medium">{subject.name}</TableCell>
                        <TableCell>
                          <code className="px-2 py-1 bg-slate-800 rounded text-sm">
                            {subject.code}
                          </code>
                        </TableCell>
                        <TableCell>{subject.credits}</TableCell>
                        <TableCell>
                          {subject.description ? 
                            (subject.description.length > 50 ? 
                              subject.description.substring(0, 50) + '...' : 
                              subject.description
                            ) : 
                            <span className="text-slate-500">No description</span>
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClass(subject.id, subject.name)}
                            disabled={deleteSubjectMutation.isPending}
                            className="text-red-400 hover:text-red-300 border-red-400/30 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FacultiesPage;
