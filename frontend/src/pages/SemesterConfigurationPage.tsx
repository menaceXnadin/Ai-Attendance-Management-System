import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar,
  Plus,
  Settings,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Star,
  AlertCircle,
  BookOpen,
  CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/integrations/api/client';
import type { SemesterConfiguration, SemesterConfigurationCreateData, SemesterConfigurationUpdateData } from '@/integrations/api/types';

const SemesterConfigurationPage: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSemester, setEditingSemester] = useState<SemesterConfiguration | null>(null);
  const [newSemester, setNewSemester] = useState<SemesterConfigurationCreateData>({
    semester_number: 1,
    academic_year: new Date().getFullYear(),
    semester_name: '',
    start_date: '',
    end_date: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch semester configurations
  const { data: semesters = [], isLoading, error } = useQuery({
    queryKey: ['semester-configurations'],
    queryFn: async () => {
      const response = await api.semesterConfiguration.getAll();
      return response as SemesterConfiguration[];
    },
  });

  // Create semester mutation
  const createSemesterMutation = useMutation({
    mutationFn: async (data: SemesterConfigurationCreateData) => {
      return await api.semesterConfiguration.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semester-configurations'] });
      setShowCreateForm(false);
      resetForm();
      toast({
        title: "Success",
        description: "Semester configuration created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create semester configuration.",
        variant: "destructive",
      });
    },
  });

  // Update semester mutation
  const updateSemesterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SemesterConfigurationUpdateData> }) => {
      return await api.semesterConfiguration.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semester-configurations'] });
      setEditingSemester(null);
      toast({
        title: "Success",
        description: "Semester configuration updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update semester configuration.",
        variant: "destructive",
      });
    },
  });

  // Set current semester mutation
  const setCurrentSemesterMutation = useMutation({
    mutationFn: async (semesterId: number) => {
      return await api.semesterConfiguration.setCurrent(semesterId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semester-configurations'] });
      toast({
        title: "Success",
        description: "Current semester updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set current semester.",
        variant: "destructive",
      });
    },
  });

  // Delete semester mutation
  const deleteSemesterMutation = useMutation({
    mutationFn: async (semesterId: number) => {
      return await api.semesterConfiguration.delete(semesterId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semester-configurations'] });
      toast({
        title: "Success",
        description: "Semester configuration deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete semester configuration.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNewSemester({
      semester_number: 1,
      academic_year: new Date().getFullYear(),
      semester_name: '',
      start_date: '',
      end_date: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSemester) {
      updateSemesterMutation.mutate({
        id: editingSemester.id,
        data: newSemester
      });
    } else {
      createSemesterMutation.mutate(newSemester);
    }
  };

  const handleEdit = (semester: SemesterConfiguration) => {
    setEditingSemester(semester);
    setNewSemester({
      semester_number: semester.semester_number,
      academic_year: semester.academic_year,
      semester_name: semester.semester_name,
      start_date: semester.start_date,
      end_date: semester.end_date,
      total_weeks: semester.total_weeks,
      exam_week_start: semester.exam_week_start,
      exam_week_end: semester.exam_week_end,
    });
    setShowCreateForm(true);
  };

  const handleDelete = (semesterId: number, semesterName: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${semesterName}"?`);
    if (confirmed) {
      deleteSemesterMutation.mutate(semesterId);
    }
  };

  const handleSetCurrent = (semesterId: number) => {
    setCurrentSemesterMutation.mutate(semesterId);
  };

  const currentSemester = semesters.find(s => s.is_current);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Calendar className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-400" />
          <p className="text-slate-400">Loading semester configurations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-400">Failed to load semester configurations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Semester Configuration</h1>
          <p className="text-slate-400">Manage dynamic semester dates and academic calendar</p>
        </div>
        <Button
          onClick={() => {
            setShowCreateForm(true);
            setEditingSemester(null);
            resetForm();
          }}
          className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Semester
        </Button>
      </div>

      {/* Current Semester Info */}
      {currentSemester && (
        <Card className="bg-gradient-to-r from-green-500/10 to-teal-500/10 border-green-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-green-400" />
              Current Semester
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-400">Semester</p>
                <p className="text-lg font-semibold text-white">{currentSemester.semester_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Duration</p>
                <p className="text-lg font-semibold text-white">
                  {format(new Date(currentSemester.start_date), 'MMM d')} - {format(new Date(currentSemester.end_date), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Progress</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-teal-400 h-2 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, 
                          (new Date().getTime() - new Date(currentSemester.start_date).getTime()) / 
                          (new Date(currentSemester.end_date).getTime() - new Date(currentSemester.start_date).getTime()) * 100
                        ))}%` 
                      }}
                    />
                  </div>
                  <Badge className="bg-green-500/20 text-green-300">
                    {Math.round(Math.min(100, Math.max(0, 
                      (new Date().getTime() - new Date(currentSemester.start_date).getTime()) / 
                      (new Date(currentSemester.end_date).getTime() - new Date(currentSemester.start_date).getTime()) * 100
                    )))}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {editingSemester ? 'Edit Semester Configuration' : 'Create New Semester Configuration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="semester_name" className="text-slate-300">Semester Name</Label>
                  <Input
                    id="semester_name"
                    value={newSemester.semester_name}
                    onChange={(e) => setNewSemester({...newSemester, semester_name: e.target.value})}
                    placeholder="e.g., Fall 2025"
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semester_number" className="text-slate-300">Semester Number (1-8)</Label>
                  <Input
                    id="semester_number"
                    type="number"
                    min="1"
                    max="8"
                    value={newSemester.semester_number}
                    onChange={(e) => setNewSemester({...newSemester, semester_number: parseInt(e.target.value)})}
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academic_year" className="text-slate-300">Academic Year</Label>
                  <Input
                    id="academic_year"
                    type="number"
                    min="2020"
                    max="2030"
                    value={newSemester.academic_year}
                    onChange={(e) => setNewSemester({...newSemester, academic_year: parseInt(e.target.value)})}
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_weeks" className="text-slate-300">Total Weeks</Label>
                  <Input
                    id="total_weeks"
                    type="number"
                    min="1"
                    max="52"
                    value={newSemester.total_weeks || ''}
                    onChange={(e) => setNewSemester({...newSemester, total_weeks: parseInt(e.target.value) || undefined})}
                    placeholder="16"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-slate-300">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={newSemester.start_date}
                    onChange={(e) => setNewSemester({...newSemester, start_date: e.target.value})}
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-slate-300">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={newSemester.end_date}
                    onChange={(e) => setNewSemester({...newSemester, end_date: e.target.value})}
                    required
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam_week_start" className="text-slate-300">Exam Week Start (Optional)</Label>
                  <Input
                    id="exam_week_start"
                    type="date"
                    value={newSemester.exam_week_start || ''}
                    onChange={(e) => setNewSemester({...newSemester, exam_week_start: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam_week_end" className="text-slate-300">Exam Week End (Optional)</Label>
                  <Input
                    id="exam_week_end"
                    type="date"
                    value={newSemester.exam_week_end || ''}
                    onChange={(e) => setNewSemester({...newSemester, exam_week_end: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={createSemesterMutation.isPending || updateSemesterMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white"
                >
                  {createSemesterMutation.isPending || updateSemesterMutation.isPending ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {editingSemester ? 'Update Semester' : 'Create Semester'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingSemester(null);
                    resetForm();
                  }}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Semester List */}
      <div className="grid gap-4">
        {semesters.length === 0 ? (
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardContent className="text-center py-12">
              <CalendarDays className="h-16 w-16 mx-auto mb-4 text-slate-400 opacity-50" />
              <h3 className="text-lg font-semibold text-white mb-2">No Semester Configurations</h3>
              <p className="text-slate-400 mb-6">Create your first semester configuration to get started</p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Semester
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {semesters.map((semester) => (
              <Card 
                key={semester.id} 
                className={`bg-slate-900/60 backdrop-blur-md border-slate-700/50 ${
                  semester.is_current ? 'ring-2 ring-green-500/50' : ''
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-white">{semester.semester_name}</h3>
                          {semester.is_current && (
                            <Badge className="bg-green-500/20 text-green-300">
                              Current
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/30">
                            Semester {semester.semester_number}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                          {format(new Date(semester.start_date), 'MMM d, yyyy')} - {format(new Date(semester.end_date), 'MMM d, yyyy')}
                          {semester.total_weeks && ` • ${semester.total_weeks} weeks`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!semester.is_current && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetCurrent(semester.id)}
                          disabled={setCurrentSemesterMutation.isPending}
                          className="border-green-600 text-green-400 hover:bg-green-500/10"
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Set Current
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(semester)}
                        className="border-blue-600 text-blue-400 hover:bg-blue-500/10"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(semester.id, semester.semester_name)}
                        disabled={semester.is_current}
                        className="border-red-600 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SemesterConfigurationPage;