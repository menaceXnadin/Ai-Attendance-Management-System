import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/useAuth';
import { Renew, WarningFilled, UserMultiple, Education, Enterprise } from '@carbon/icons-react';

interface LoginFormData {
  email: string;
  password: string;
  userType?: 'student' | 'admin' | 'teacher';
}

const LoginPage = () => {
  const { register: registerStudent, handleSubmit: handleStudentSubmit, formState: { errors: studentErrors } } = useForm<LoginFormData>({
    defaultValues: { userType: 'student' }
  });
  const { register: registerAdmin, handleSubmit: handleAdminSubmit, formState: { errors: adminErrors } } = useForm<LoginFormData>({
    defaultValues: { userType: 'admin' }
  });
  const { register: registerTeacher, handleSubmit: handleTeacherSubmit, formState: { errors: teacherErrors } } = useForm<LoginFormData>({
    defaultValues: { userType: 'teacher' }
  });
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onStudentSubmit = async (data: LoginFormData) => {
    await handleLogin(data, 'student');
  };

  const onAdminSubmit = async (data: LoginFormData) => {
    await handleLogin(data, 'admin');
  };

  const onTeacherSubmit = async (data: LoginFormData) => {
    await handleLogin(data, 'teacher');
  };

  const handleLogin = async (data: LoginFormData, userType: 'student' | 'admin' | 'teacher') => {
    setIsSubmitting(true);
    setLoginError(null);
    const { error, user: signedInUser } = await signIn(data.email, data.password);
    setIsSubmitting(false);
    
    const getErrorMessage = (err: unknown): string => {
      if (!err) return 'Login failed';
      if (typeof err === 'string') return err;
      if (typeof err === 'object' && err !== null) {
        const obj = err as Record<string, unknown>;
        if (typeof obj.message === 'string') return obj.message;
      }
      return 'Login failed';
    };

    if (error) {
      const errorMsg = getErrorMessage(error);
      setLoginError(errorMsg);
      toast({
        title: "Authentication Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } else {
      setLoginError(null);
      
      // Check if the user has the correct role
      if (userType === 'admin' && signedInUser?.role !== 'admin') {
        toast({
          title: "Access denied",
          description: "This account does not have administrator privileges.",
          variant: "destructive",
        });
        return;
      } else if (userType === 'teacher' && signedInUser?.role !== 'faculty' && signedInUser?.role !== 'teacher') {
        toast({
          title: "Access denied",
          description: "This account does not have teacher privileges.",
          variant: "destructive",
        });
        return;
      } else if (userType === 'student' && (signedInUser?.role === 'admin' || signedInUser?.role === 'faculty')) {
        toast({
          title: "Wrong portal",
          description: "Please use the corresponding staff portal for your account.",
          variant: "destructive",
        });
        return;
      }
      
      // Redirect based on role
      if (signedInUser?.role === 'admin') {
        toast({
          title: "Login Successful",
          description: "Welcome to the administrator portal.",
        });
        navigate("/app");
      } else if (signedInUser?.role === 'faculty' || signedInUser?.role === 'teacher') {
        toast({
          title: "Login Successful",
          description: "Welcome to the teacher portal.",
        });
        navigate("/teacher");
      } else {
        toast({
          title: "Login Successful",
          description: "Welcome to your student dashboard.",
        });
        navigate("/student");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas text-text-primary">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">AttendAI Portal</h1>
            <p className="text-sm text-text-secondary mt-1">
              Sign in with institutional credentials to access your portal
            </p>
          </div>

          <Card className="border border-border-subtle bg-surface-default shadow-card rounded-lg">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base font-semibold text-text-primary">
                Account Sign In
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Select your institutional role to continue
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              {loginError && (
                <div className="mb-5 p-3 rounded-md bg-status-error/10 border border-status-error/30 text-status-error text-xs flex items-center gap-2">
                  <WarningFilled className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <Tabs defaultValue="student" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 p-1 bg-surface-canvas border border-border-subtle rounded-md">
                  <TabsTrigger 
                    value="student" 
                    className="flex items-center justify-center gap-1.5 text-xs py-2 data-[state=active]:bg-surface-default data-[state=active]:text-text-primary data-[state=active]:shadow-xs text-text-muted font-medium transition-all"
                  >
                    <Education className="w-3.5 h-3.5" />
                    Student
                  </TabsTrigger>
                  <TabsTrigger 
                    value="teacher" 
                    className="flex items-center justify-center gap-1.5 text-xs py-2 data-[state=active]:bg-surface-default data-[state=active]:text-text-primary data-[state=active]:shadow-xs text-text-muted font-medium transition-all"
                  >
                    <UserMultiple className="w-3.5 h-3.5" />
                    Teacher
                  </TabsTrigger>
                  <TabsTrigger 
                    value="admin" 
                    className="flex items-center justify-center gap-1.5 text-xs py-2 data-[state=active]:bg-surface-default data-[state=active]:text-text-primary data-[state=active]:shadow-xs text-text-muted font-medium transition-all"
                  >
                    <Enterprise className="w-3.5 h-3.5" />
                    Admin
                  </TabsTrigger>
                </TabsList>
                
                {/* Student Login Tab */}
                <TabsContent value="student" className="space-y-4">
                  <div className="p-2.5 rounded-md bg-surface-canvas border border-border-subtle text-xs text-text-secondary">
                    Enter the student email and password provisioned by administration.
                  </div>
                  <form onSubmit={handleStudentSubmit(onStudentSubmit)} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="student-email" className="text-xs font-medium text-text-secondary">
                        Student Email
                      </Label>
                      <Input
                        id="student-email"
                        type="email"
                        placeholder="student@institution.edu"
                        {...registerStudent("email", {
                          required: "Email is required",
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: "Invalid email address",
                          },
                        })}
                      />
                      {studentErrors.email && (
                        <p className="text-xs text-status-error">{studentErrors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="student-password" className="text-xs font-medium text-text-secondary">
                        Password
                      </Label>
                      <PasswordInput
                        id="student-password"
                        placeholder="Enter password"
                        {...registerStudent("password", { required: "Password is required" })}
                      />
                      {studentErrors.password && (
                        <p className="text-xs text-status-error">{studentErrors.password.message}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-end">
                      <Link to="/forgot-password" className="text-xs font-medium text-action-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Renew className="w-4 h-4 animate-spin" />
                          Authenticating...
                        </span>
                      ) : (
                        "Sign In as Student"
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                {/* Teacher Login Tab */}
                <TabsContent value="teacher" className="space-y-4">
                  <div className="p-2.5 rounded-md bg-surface-canvas border border-border-subtle text-xs text-text-secondary">
                    Faculty members: sign in with your verified departmental credentials.
                  </div>
                  <form onSubmit={handleTeacherSubmit(onTeacherSubmit)} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="teacher-email" className="text-xs font-medium text-text-secondary">
                        Faculty Email
                      </Label>
                      <Input
                        id="teacher-email"
                        type="email"
                        placeholder="faculty@institution.edu"
                        {...registerTeacher("email", {
                          required: "Email is required",
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: "Invalid email address",
                          },
                        })}
                      />
                      {teacherErrors.email && (
                        <p className="text-xs text-status-error">{teacherErrors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="teacher-password" className="text-xs font-medium text-text-secondary">
                        Password
                      </Label>
                      <PasswordInput
                        id="teacher-password"
                        placeholder="Enter password"
                        {...registerTeacher("password", { required: "Password is required" })}
                      />
                      {teacherErrors.password && (
                        <p className="text-xs text-status-error">{teacherErrors.password.message}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <Link to="/forgot-password" className="text-xs font-medium text-action-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Renew className="w-4 h-4 animate-spin" />
                          Authenticating...
                        </span>
                      ) : (
                        "Sign In as Teacher"
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                {/* Admin Login Tab */}
                <TabsContent value="admin" className="space-y-4">
                  <div className="p-2.5 rounded-md bg-surface-canvas border border-border-subtle text-xs text-text-secondary">
                    System administrators: enter authorized institutional account details.
                  </div>
                  <form onSubmit={handleAdminSubmit(onAdminSubmit)} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-email" className="text-xs font-medium text-text-secondary">
                        Administrator Email
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@institution.edu"
                        {...registerAdmin("email", {
                          required: "Email is required",
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: "Invalid email address",
                          },
                        })}
                      />
                      {adminErrors.email && (
                        <p className="text-xs text-status-error">{adminErrors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-password" className="text-xs font-medium text-text-secondary">
                        Admin Password
                      </Label>
                      <PasswordInput
                        id="admin-password"
                        placeholder="Enter admin password"
                        {...registerAdmin("password", { required: "Password is required" })}
                      />
                      {adminErrors.password && (
                        <p className="text-xs text-status-error">{adminErrors.password.message}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <Link to="/forgot-password" className="text-xs font-medium text-action-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Renew className="w-4 h-4 animate-spin" />
                          Authenticating...
                        </span>
                      ) : (
                        "Sign In as Administrator"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>

            <CardFooter className="border-t border-border-subtle pt-4 text-center justify-center">
              <p className="text-xs text-text-muted">
                Need access? Contact the department system administrator.
              </p>
            </CardFooter>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LoginPage;
