
import React, { useState } from 'react';
import StudentForm, { StudentFormData } from '@/components/StudentForm';
import StudentList from '@/components/StudentList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Utility to convert File to base64 string for storage
const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const StudentsPage = () => {
  const [selectedStudent, setSelectedStudent] = useState<StudentFormData | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('list');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch students from our backend API
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      try {
        const data = await api.students.getAll();
        // Convert the API response to match StudentFormData structure
        // Note: profileImage is stored as a string in the API but we need it as a File for the form
        return data.map(student => ({
          id: student.id,
          name: student.name,
          rollNo: student.rollNo,
          studentId: student.studentId,
          email: student.email,
          // We'll just set profileImage to null since we can't convert a string URL back to a File
          // The image URL will be handled separately for display
          profileImage: null,
        }));
      } catch (error) {
        console.error('Error fetching students:', error);
        throw error;
      }
    },
  });

  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (student: StudentFormData) => {
      try {
        const result = await api.students.create({
          name: student.name,
          rollNo: student.rollNo,
          studentId: student.studentId,
          email: student.email,
          profileImage: student.profileImage ? await convertFileToBase64(student.profileImage) : null
        });
        
        return result;
      } catch (error) {
        console.error('Error adding student:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
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
        const updateData = {
          name: student.name,
          rollNo: student.rollNo,
          studentId: student.studentId,
          email: student.email,
        };
        
        // Add profile image if it exists and is a File (not a string URL)
        if (student.profileImage instanceof File) {
          Object.assign(updateData, {
            profileImage: await convertFileToBase64(student.profileImage)
          });
        }
        
        const result = await api.students.update(student.id, updateData);
        return result;
      } catch (error) {
        console.error('Error updating student:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
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

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      try {
        await api.students.delete(studentId);
        return studentId;
      } catch (error) {
        console.error('Error deleting student:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: "Student Deleted",
        description: "The student has been successfully removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete student: ${error.message}`,
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
    deleteStudentMutation.mutate(studentId);
  };

  const onSubmit = (data: StudentFormData) => {
    if (selectedStudent) {
      updateStudentMutation.mutate({ ...data, id: selectedStudent.id });
    } else {
      addStudentMutation.mutate(data);
    }
  };

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
          <StudentList 
            students={students} 
            onEdit={handleEditStudent}
            onDelete={handleDeleteStudent}
            isLoading={isLoading}
          />
        </TabsContent>
        
        <TabsContent value="form" className="mt-6">
          <StudentForm 
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
