
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
  Person20Regular,
  PersonAdd20Regular,
  HatGraduation20Regular,
  Call20Regular,
  LockClosed20Regular,
  Save20Regular,
  ArrowReset20Regular,
} from '@fluentui/react-icons';
import { api } from '@/integrations/api/client';
import { cn } from '@/lib/utils';

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
  faculty?: string;             // Display-only faculty name (populated by list views)
  semester: number;
  year: number;
  batch: number;
  phone_number?: string;        // Added missing field
  emergency_contact?: string;   // Added missing field
  password?: string;
  confirmPassword?: string;
}

// Fluent-style native dropdown to match ui/input
const selectClass =
  'flex h-9 w-full rounded-md border border-border-default border-b-border-strong bg-surface-default px-3 text-body text-text-primary transition-colors duration-150 ease-fluent-standard hover:border-border-strong focus:border-b-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

const Field = ({ id, label, required, hint, error, className, children }: FieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <Label htmlFor={id} className="text-body-strong font-semibold text-text-primary">
      {label}
      {required && <span className="ml-0.5 text-status-error" aria-hidden>*</span>}
    </Label>
    {children}
    {error ? (
      <p role="alert" className="text-caption text-status-error">{error}</p>
    ) : hint ? (
      <p className="text-caption text-text-muted">{hint}</p>
    ) : null}
  </div>
);

type SectionProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  optional?: boolean;
  children: React.ReactNode;
};

const FormSection = ({ icon, title, description, optional, children }: SectionProps) => (
  <section className="grid gap-4 py-6 first:pt-0 last:pb-0 lg:grid-cols-[220px_1fr] lg:gap-8">
    <div className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-subtle text-text-secondary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-subheading text-text-primary">{title}</h3>
          <Badge variant={optional ? 'outline' : 'secondary'} shape="pill" className="font-normal">
            {optional ? 'Optional' : 'Required'}
          </Badge>
        </div>
        <p className="mt-0.5 text-caption text-text-muted">{description}</p>
      </div>
    </div>
    <div className="min-w-0 space-y-4">{children}</div>
  </section>
);


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
    <div className="w-full">
      <div className="mx-auto max-w-4xl">
        <Card className="overflow-hidden border-0 bg-surface-default shadow">
          <CardHeader className="flex-row items-center gap-3 space-y-0 border-b border-border-subtle px-6 py-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              {initialData ? <Person20Regular aria-hidden /> : <PersonAdd20Regular aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-section-title text-text-primary">
                {initialData ? 'Edit Student Profile' : 'Add New Student'}
              </CardTitle>
              <CardDescription className="mt-0.5 text-body text-text-muted">
                {initialData
                  ? 'Update the student information and personal details.'
                  : 'Enter complete student details to create a new student record with all personal information.'}
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <CardContent className="divide-y divide-border-subtle px-6 py-6">

              {/* Personal Information Section */}
              <FormSection
                icon={<Person20Regular aria-hidden />}
                title="Personal Information"
                description="Basic student details"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field id="full_name" label="Full Name" required error={errors.full_name?.message}>
                    <Input
                      id="full_name"
                      {...register('full_name', { required: "Full name is required" })}
                      placeholder="e.g. John Doe"
                      disabled={isLoading}
                      aria-invalid={!!errors.full_name}
                    />
                  </Field>

                  <Field id="email" label="Email Address" required error={errors.email?.message}>
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
                      aria-invalid={!!errors.email}
                    />
                  </Field>
                </div>
              </FormSection>

              {/* Academic Information Section */}
              <FormSection
                icon={<HatGraduation20Regular aria-hidden />}
                title="Academic Information"
                description="Student ID and enrollment details"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field id="student_id" label="Student ID" required error={errors.student_id?.message}>
                    <Input
                      id="student_id"
                      {...register('student_id', { required: "Student ID is required" })}
                      placeholder="e.g. STU2025001"
                      disabled={isLoading}
                      className="font-mono"
                      aria-invalid={!!errors.student_id}
                    />
                  </Field>

                  <Field id="faculty_id" label="Faculty" required error={errors.faculty_id?.message}>
                    <select
                      id="faculty_id"
                      {...register('faculty_id', {
                        required: "Faculty is required",
                        valueAsNumber: true,
                        validate: value => value > 0 || "Please select a faculty"
                      })}
                      className={selectClass}
                      disabled={isLoading}
                      aria-invalid={!!errors.faculty_id}
                    >
                      <option value="">Select Faculty</option>
                      {faculties.map((faculty: { id: number; name: string }) => (
                        <option key={faculty.id} value={faculty.id}>
                          {faculty.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field id="semester" label="Semester" required error={errors.semester?.message}>
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
                      aria-invalid={!!errors.semester}
                    />
                  </Field>

                  <Field id="year" label="Academic Year" hint="Set automatically from semester" error={errors.year?.message}>
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
                      className="cursor-not-allowed bg-surface-subtle text-text-secondary"
                    />
                  </Field>

                  <Field id="batch" label="Batch Year" required error={errors.batch?.message}>
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
                      aria-invalid={!!errors.batch}
                    />
                  </Field>
                </div>
              </FormSection>

              {/* Contact Information Section */}
              <FormSection
                icon={<Call20Regular aria-hidden />}
                title="Contact Information"
                description="Phone numbers for communication"
                optional
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field id="phone_number" label="Phone Number" error={errors.phone_number?.message}>
                    <Input
                      id="phone_number"
                      type="tel"
                      {...register('phone_number')}
                      placeholder="e.g. +977-9812345678"
                      disabled={isLoading}
                    />
                  </Field>

                  <Field id="emergency_contact" label="Emergency Contact" error={errors.emergency_contact?.message}>
                    <Input
                      id="emergency_contact"
                      type="tel"
                      {...register('emergency_contact')}
                      placeholder="e.g. +977-9887654321"
                      disabled={isLoading}
                    />
                  </Field>
                </div>
              </FormSection>

              {/* Security Section - Password fields only shown when creating a new student */}
              {!initialData && (
                <FormSection
                  icon={<LockClosed20Regular aria-hidden />}
                  title="Security"
                  description="Account password credentials"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      id="password"
                      label="Password"
                      required
                      hint="At least 8 characters"
                      error={errors.password?.message}
                    >
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
                        aria-invalid={!!errors.password}
                      />
                    </Field>

                    <Field id="confirmPassword" label="Confirm Password" required error={errors.confirmPassword?.message}>
                      <PasswordInput
                        id="confirmPassword"
                        {...register('confirmPassword', {
                          required: initialData ? false : "Please confirm password",
                          validate: (value, formValues) =>
                            value === formValues.password || "Passwords do not match"
                        })}
                        placeholder="••••••••"
                        disabled={isLoading}
                        aria-invalid={!!errors.confirmPassword}
                      />
                    </Field>
                  </div>
                </FormSection>
              )}
            </CardContent>

            <CardFooter className="justify-end gap-2 border-t border-border-subtle bg-surface-subtle px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => reset()}
                disabled={isLoading}
              >
                <ArrowReset20Regular aria-hidden />
                Reset Form
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="min-w-[140px]"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                    {initialData ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save20Regular aria-hidden />
                    {initialData ? 'Update Student' : 'Create Student'}
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default StudentForm;
