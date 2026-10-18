import React from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/useAuth';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'student' | 'employee' | 'admin';
}

const RegisterPage = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>({
    defaultValues: { role: 'student' },
  });
  const { toast } = useToast();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    // Block admin registrations
    if (data.role === 'admin') {
      toast({
        title: "Registration not allowed",
        description: "Admin accounts can only be created by system administrators. Please contact support for assistance.",
        variant: "destructive",
      });
      return;
    }

    // Always register as student regardless of selection for security
    const { error, user: registeredUser } = await signUp(
      data.email, 
      data.password, 
      data.firstName, 
      data.lastName
    );

    if (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An error occurred during registration.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registration successful",
        description: "Your student account has been created.",
      });
      // Redirect to student dashboard
      navigate("/student");
    }
  };

  // No Google sign-in in original version

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-surface-canvas">
        <Card className="w-full max-w-[440px] rounded-lg border-transparent bg-surface-default shadow-xl">
          <CardHeader className="space-y-1 p-8 pb-4 sm:px-11 sm:pt-11">
            <CardTitle className="text-page-title text-text-primary">Create an Account</CardTitle>
            <CardDescription className="text-body text-text-secondary">
              Enter your information to register
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4 px-8 sm:px-11">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-body-strong font-semibold text-text-primary">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    {...register('firstName', { required: "First name is required" })}
                  />
                  {errors.firstName && (
                    <p className="text-caption text-status-error">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-body-strong font-semibold text-text-primary">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    {...register('lastName', { required: "Last name is required" })}
                  />
                  {errors.lastName && (
                    <p className="text-caption text-status-error">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-body-strong font-semibold text-text-primary">Email</Label>
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
                />
                {errors.email && (
                  <p className="text-caption text-status-error">{errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-body-strong font-semibold text-text-primary">Password</Label>
                <PasswordInput
                  id="password"
                  {...register('password', {
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters long"
                    }
                  })}
                />
                {errors.password && (
                  <p className="text-caption text-status-error">{errors.password.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-body-strong font-semibold text-text-primary">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  {...register('confirmPassword', {
                    required: "Please confirm your password",
                    validate: value => value === password || "Passwords do not match"
                  })}
                />
                {errors.confirmPassword && (
                  <p className="text-caption text-status-error">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-body-strong font-semibold text-text-primary">Register as</Label>
                <select
                  id="role"
                  {...register('role', { required: true })}
                  className="flex h-9 w-full rounded-md border border-border-default bg-surface-default px-3 py-1.5 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="student">Student/Employee</option>
                  <option value="admin">Admin/Teacher/Manager</option>
                </select>
                {errors.role && (
                  <p className="text-caption text-status-error">Please select a role</p>
                )}
              </div>
              <Button type="submit" className="w-full font-semibold">
                Register
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col px-8 pb-8 sm:px-11 sm:pb-11">
              <p className="text-center text-body text-text-secondary">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-foreground hover:text-brand-foreground-hover hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
      <Footer />
    </>
  );
};

export default RegisterPage;
