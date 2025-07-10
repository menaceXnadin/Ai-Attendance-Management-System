
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface StudentFormProps {
  onSubmit: (data: StudentFormData) => void;
  initialData?: StudentFormData;
  isLoading?: boolean;
}

export interface StudentFormData {
  id?: string;
  name: string;
  rollNo: string;
  studentId: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  profileImage?: File | null;
}

const StudentForm = ({ onSubmit, initialData, isLoading = false }: StudentFormProps) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<StudentFormData>({
    defaultValues: initialData || {
      name: '',
      rollNo: '',
      studentId: '',
      email: '',
      profileImage: null,
    },
  });
  const { toast } = useToast();

  const handleFormSubmit = (data: StudentFormData) => {
    onSubmit(data);
    if (!initialData) {
      reset();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Student' : 'Add New Student'}</CardTitle>
        <CardDescription>
          {initialData 
            ? 'Update the student information and profile picture.' 
            : 'Enter the student details and upload a profile picture for face recognition.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                {...register('name', { required: "Name is required" })} 
                placeholder="John Doe" 
                disabled={isLoading}
              />
              {errors.name && <span className="text-sm text-red-500">{errors.name.message}</span>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                {...register('email', { 
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address"
                  }
                })} 
                placeholder="john.doe@example.com" 
                disabled={isLoading}
              />
              {errors.email && <span className="text-sm text-red-500">{errors.email.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input 
                id="studentId" 
                {...register('studentId', { required: "Student ID is required" })} 
                placeholder="STU12345" 
                disabled={isLoading}
              />
              {errors.studentId && <span className="text-sm text-red-500">{errors.studentId.message}</span>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rollNo">Roll Number</Label>
              <Input 
                id="rollNo" 
                {...register('rollNo', { required: "Roll number is required" })} 
                placeholder="A12" 
                disabled={isLoading}
              />
              {errors.rollNo && <span className="text-sm text-red-500">{errors.rollNo.message}</span>}
            </div>
          </div>
          
          {/* Password fields only shown when creating a new student */}
          {!initialData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password"
                  {...register('password', { 
                    required: initialData ? false : "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters"
                    }
                  })} 
                  placeholder="********" 
                  disabled={isLoading}
                />
                {errors.password && <span className="text-sm text-red-500">{errors.password.message}</span>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input 
                  id="confirmPassword" 
                  type="password"
                  {...register('confirmPassword', { 
                    required: initialData ? false : "Please confirm password",
                    validate: (value, formValues) => 
                      value === formValues.password || "Passwords do not match"
                  })} 
                  placeholder="********" 
                  disabled={isLoading}
                />
                {errors.confirmPassword && <span className="text-sm text-red-500">{errors.confirmPassword.message}</span>}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="profileImage">Profile Image (for facial recognition)</Label>
            <Input 
              id="profileImage" 
              type="file" 
              accept="image/*" 
              {...register('profileImage', { 
                required: initialData ? false : "Profile image is required for facial recognition"
              })}
              disabled={isLoading}
            />
            {errors.profileImage && <span className="text-sm text-red-500">{errors.profileImage.message}</span>}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => reset()} disabled={isLoading}>Reset</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {initialData ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              initialData ? 'Update Student' : 'Add Student'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default StudentForm;
