import React from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  User, 
  Mail, 
  IdCard, 
  GraduationCap, 
  Calendar, 
  Phone, 
  Shield, 
  Lock,
  Users,
  BookOpen,
  Hash
} from 'lucide-react';
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
  faculty_id: number;
  semester: number;
  year: number;
  batch: number;
  phone_number?: string;
  emergency_contact?: string;
  password?: string;
  confirmPassword?: string;
}

const StudentForm = ({ onSubmit, initialData, isLoading = false }: StudentFormProps) => {
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<StudentFormData>({
    defaultValues: initialData || {
      full_name: '',
      student_id: '',
      email: '',
      faculty_id: 0,
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

  // Auto-set year based on semester
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-2xl bg-white dark:bg-slate-800">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">
                  {initialData ? 'Edit Student Profile' : 'Add New Student'}
                </CardTitle>
                <CardDescription className="text-blue-100">
                  {initialData 
                    ? 'Update the student information and personal details.' 
                    : 'Enter complete student details to create a new student record with all personal information.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <CardContent className="p-8 space-y-8">
              
              {/* Personal Information Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Information</h3>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Required</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      Full Name
                    </Label>
                    <Input 
                      id="full_name" 
                      {...register('full_name', { required: "Full name is required" })} 
                      placeholder="e.g. John Doe" 
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.full_name && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.full_name.message}
                    </span>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      Email Address
                    </Label>
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
                      placeholder="e.g. john.doe@college.edu" 
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.email && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.email.message}
                    </span>}
                  </div>
                </div>
              </div>

              {/* Academic Information Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Academic Information</h3>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">Required</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="student_id" className="flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-gray-500" />
                      Student ID
                    </Label>
                    <Input 
                      id="student_id" 
                      {...register('student_id', { required: "Student ID is required" })} 
                      placeholder="e.g. STU2025001" 
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.student_id && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.student_id.message}
                    </span>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="faculty_id" className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-gray-500" />
                      Faculty
                    </Label>
                    <select 
                      id="faculty_id" 
                      {...register('faculty_id', { 
                        required: "Faculty is required",
                        valueAsNumber: true,
                        validate: value => value > 0 || "Please select a faculty"
                      })} 
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isLoading}
                    >
                      <option value="">Select Faculty</option>
                      {faculties.map((faculty: { id: number; name: string }) => (
                        <option key={faculty.id} value={faculty.id}>
                          {faculty.name}
                        </option>
                      ))}
                    </select>
                    {errors.faculty_id && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.faculty_id.message}
                    </span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="semester" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-gray-500" />
                      Semester
                    </Label>
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
                      className="h-11"
                    />
                    {errors.semester && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.semester.message}
                    </span>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="year" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Academic Year
                    </Label>
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
                      className="h-11 bg-gray-50 dark:bg-gray-700"
                    />
                    {errors.year && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.year.message}
                    </span>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="batch" className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      Batch Year
                    </Label>
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
                      className="h-11"
                    />
                    {errors.batch && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.batch.message}
                    </span>}
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Phone className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contact Information</h3>
                  <Badge variant="outline" className="border-green-200 text-green-700">Optional</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone_number" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      Phone Number
                    </Label>
                    <Input 
                      id="phone_number" 
                      type="tel"
                      {...register('phone_number')} 
                      placeholder="e.g. +977-9812345678" 
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.phone_number && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.phone_number.message}
                    </span>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact" className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      Emergency Contact
                    </Label>
                    <Input 
                      id="emergency_contact" 
                      type="tel"
                      {...register('emergency_contact')} 
                      placeholder="e.g. +977-9887654321" 
                      disabled={isLoading}
                      className="h-11"
                    />
                    {errors.emergency_contact && <span className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.emergency_contact.message}
                    </span>}
                  </div>
                </div>
              </div>
              
              {/* Security Section - Password fields only shown when creating a new student */}
              {!initialData && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="h-5 w-5 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security</h3>
                    <Badge variant="secondary" className="bg-red-100 text-red-700">Required</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-500" />
                        Password
                      </Label>
                      <PasswordInput 
                        id="password" 
                        {...register('password', { 
                          required: initialData ? false : "Password is required",
                          minLength: {
                            value: 8,
                            message: "Password must be at least 8 characters"
                          }
                        })} 
                        placeholder="••••••••" 
                        disabled={isLoading}
                        className="h-11"
                      />
                      {errors.password && <span className="text-sm text-red-500 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        {errors.password.message}
                      </span>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-500" />
                        Confirm Password
                      </Label>
                      <PasswordInput 
                        id="confirmPassword" 
                        {...register('confirmPassword', { 
                          required: initialData ? false : "Please confirm password",
                          validate: (value, formValues) => 
                            value === formValues.password || "Passwords do not match"
                        })} 
                        placeholder="••••••••" 
                        disabled={isLoading}
                        className="h-11"
                      />
                      {errors.confirmPassword && <span className="text-sm text-red-500 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        {errors.confirmPassword.message}
                      </span>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="bg-gray-50 dark:bg-slate-700 rounded-b-lg p-6">
              <div className="flex justify-between w-full">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => reset()} 
                  disabled={isLoading}
                  className="px-6"
                >
                  <Hash className="mr-2 h-4 w-4" />
                  Reset Form
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {initialData ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <User className="mr-2 h-4 w-4" />
                      {initialData ? 'Update Student' : 'Create Student'}
                    </>
                  )}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default StudentForm;
