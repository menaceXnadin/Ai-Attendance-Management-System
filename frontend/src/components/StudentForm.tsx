
import React from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { api } from '@/integrations/api/client';

interface StudentFormProps {
  onSubmit: (data: StudentFormData) => void;
  initialData?: StudentFormData;
  isLoading?: boolean;
}

export interface StudentFormData {
  id?: string;
  full_name: string;
  student_id: string;
  email: string;
  faculty_id: number;  // Changed to faculty_id
  semester: number;
  year: number;
  batch: number;
  password?: string;
  confirmPassword?: string;
}


const StudentForm = ({ onSubmit, initialData, isLoading = false }: StudentFormProps) => {
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<StudentFormData>({
    defaultValues: initialData || {
      full_name: '',
      student_id: '',
      email: '',
      faculty_id: 0,  // Changed to faculty_id
      semester: 1,
      year: 1,
      batch: new Date().getFullYear(),
    },
  });
  const { toast } = useToast();

  // Fetch faculties for dropdown
  const { data: faculties = [] } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => api.faculties.getAll(),
  });

  // Auto-set year based on semester (fix React warning)
  const semester = watch('semester');
  React.useEffect(() => {
    let year = 1;
    if (semester === 1 || semester === 2) year = 1;
    else if (semester === 3 || semester === 4) year = 2;
    else if (semester === 5 || semester === 6) year = 3;
    else if (semester === 7 || semester === 8) year = 4;
    setValue('year', year, { shouldValidate: true });
  }, [semester, setValue]);

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
            ? 'Update the student information.' 
            : 'Enter the required student details to create a new student record.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input 
                id="full_name" 
                {...register('full_name', { required: "Full name is required" })} 
                placeholder="John Doe" 
                disabled={isLoading}
              />
              {errors.full_name && <span className="text-sm text-red-500">{errors.full_name.message}</span>}
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
              <Label htmlFor="student_id">Student ID</Label>
              <Input 
                id="student_id" 
                {...register('student_id', { required: "Student ID is required" })} 
                placeholder="STU12345" 
                disabled={isLoading}
              />
              {errors.student_id && <span className="text-sm text-red-500">{errors.student_id.message}</span>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="faculty_id">Faculty</Label>
              <select 
                id="faculty_id" 
                {...register('faculty_id', { 
                  required: "Faculty is required",
                  valueAsNumber: true,
                  validate: value => value > 0 || "Please select a faculty"
                })} 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
              >
                <option value="">Select Faculty</option>
                {faculties.map((faculty: { id: number; name: string }) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </select>
              {errors.faculty_id && <span className="text-sm text-red-500">{errors.faculty_id.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <Input 
                id="semester" 
                type="number" 
                min="1" 
                max="8" 
                {...register('semester', { 
                  required: "Semester is required",
                  valueAsNumber: true,
                  min: {
                    value: 1,
                    message: "Semester must be at least 1"
                  },
                  max: {
                    value: 8,
                    message: "Semester cannot be more than 8"
                  }
                })} 
                placeholder="1" 
                disabled={isLoading}
              />
              {errors.semester && <span className="text-sm text-red-500">{errors.semester.message}</span>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="year">Academic Year</Label>
              <Input 
                id="year" 
                type="number" 
                min="1" 
                max="4" 
                {...register('year', { 
                  required: "Academic year is required",
                  valueAsNumber: true,
                  min: {
                    value: 1,
                    message: "Year must be at least 1"
                  },
                  max: {
                    value: 4,
                    message: "Year cannot be more than 4"
                  }
                })} 
                placeholder="1" 
                readOnly
                disabled={isLoading}
              />
              {errors.year && <span className="text-sm text-red-500">{errors.year.message}</span>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batch">Batch Year</Label>
              <Input 
                id="batch" 
                type="number" 
                min="2020" 
                max={new Date().getFullYear() + 1}
                {...register('batch', { 
                  required: "Batch year is required",
                  valueAsNumber: true,
                  min: {
                    value: 2020,
                    message: "Batch year must be at least 2020"
                  },
                  max: {
                    value: new Date().getFullYear() + 1,
                    message: `Batch year cannot be more than ${new Date().getFullYear() + 1}`
                  }
                })} 
                placeholder={new Date().getFullYear().toString()}
                disabled={isLoading}
              />
              {errors.batch && <span className="text-sm text-red-500">{errors.batch.message}</span>}
            </div>
          </div>
          
          {/* Password fields only shown when creating a new student */}
          {!initialData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput 
                  id="password" 
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
                <PasswordInput 
                  id="confirmPassword" 
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
