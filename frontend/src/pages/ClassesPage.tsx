
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Book, Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ClassFormData {
  id?: string;
  name: string;
  description: string;
}

// Importing Class type from the API types
import type { Class as ApiClass } from '@/integrations/api/types';

// Local interface that extends ApiClass with any additional properties needed
interface Class extends ApiClass {
  created_at?: string;
}

const ClassesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassFormData | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClassFormData>({
    defaultValues: {
      name: '',
      description: '',
    }
  });

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      try {
        const data = await api.classes.getAll();
        // Filter classes by teacher if needed
        return data.filter(cls => cls.teacherId === user?.id);
      } catch (error) {
        console.error('Error fetching classes:', error);
        throw error;
      }
    },
    enabled: !!user?.id,
  });

  const addClassMutation = useMutation({
    mutationFn: async (classData: ClassFormData) => {
      try {
        const result = await api.classes.create({
          name: classData.name,
          description: classData.description,
          teacherId: user?.id,
        });
        return result;
      } catch (error) {
        console.error('Error creating class:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Class Created",
        description: "The class has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      reset();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create class: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const updateClassMutation = useMutation({
    mutationFn: async (classData: ClassFormData) => {
      if (!classData.id) {
        throw new Error("Class ID is required for updates");
      }
      
      try {
        const result = await api.classes.update(classData.id, {
          name: classData.name,
          description: classData.description,
        });
        return result;
      } catch (error) {
        console.error('Error updating class:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Class Updated",
        description: "The class has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setEditingClass(null);
      setIsDialogOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update class: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      try {
        await api.classes.delete(classId);
        return classId;
      } catch (error) {
        console.error('Error deleting class:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Class Deleted",
        description: "The class has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete class: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ClassFormData) => {
    if (editingClass?.id) {
      updateClassMutation.mutate({ ...data, id: editingClass.id });
    } else {
      addClassMutation.mutate(data);
    }
  };

  const handleEditClass = (classData: Class) => {
    setEditingClass({
      id: classData.id,
      name: classData.name,
      description: classData.description
    });
    reset({
      name: classData.name,
      description: classData.description
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClass = (classId: string) => {
    if (confirm('Are you sure you want to delete this class?')) {
      deleteClassMutation.mutate(classId);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingClass(null);
      reset({
        name: '',
        description: ''
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Classes Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className="flex gap-2 items-center">
              <Plus size={16} />
              Add New Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
              <DialogDescription>
                {editingClass 
                  ? 'Update the class information below' 
                  : 'Fill in the details to create a new class'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Class Name</Label>
                <Input 
                  id="name"
                  placeholder="e.g., Mathematics 101"
                  {...register('name', { required: "Class name is required" })}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter a description for this class"
                  {...register('description')}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={addClassMutation.isPending || updateClassMutation.isPending}
                >
                  {(addClassMutation.isPending || updateClassMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingClass ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingClass ? 'Update Class' : 'Create Class'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Classes</CardTitle>
          <CardDescription>
            Manage all your classes and academic streams
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="animate-spin h-8 w-8 mr-2" />
              <span>Loading classes...</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Book className="mx-auto h-12 w-12 opacity-30 mb-2" />
              <p className="text-lg">No classes found</p>
              <p className="text-sm">Create your first class to get started</p>
              <Button 
                onClick={() => setIsDialogOpen(true)}
                variant="outline"
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Class
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>
                      {cls.description ? cls.description.substring(0, 70) + (cls.description.length > 70 ? '...' : '') : 'No description'}
                    </TableCell>
                    <TableCell>{cls.createdAt ? new Date(cls.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClass(cls)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteClass(cls.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassesPage;
