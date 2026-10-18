import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/useAuth';
import logo from '@/assets/main.png';
import {
  ErrorCircle20Filled,
  HatGraduation16Regular,
  PeopleTeam16Regular,
  Building16Regular,
  Key20Regular,
} from '@fluentui/react-icons';

interface LoginFormData {
  email: string;
  password: string;
  userType?: 'student' | 'admin' | 'teacher';
}

/** Fluent spinner (tiny) for in-button loading states. */
const ButtonSpinner = () => (
  <span
    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    aria-hidden
  />
);

const AUTH_BACKDROP: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(55% 60% at 0% 0%, var(--brand-subtle) 0%, transparent 70%), radial-gradient(45% 55% at 100% 100%, var(--brand-subtle) 0%, transparent 70%)',
};

const labelClass = 'text-body-strong font-semibold text-text-primary';
const triggerClass = 'gap-1.5';

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
  const location = useLocation();
  const { signIn } = useAuth();

  /** Where ProtectedRoute sent the user from (e.g. a scanned check-in QR link with ?session&code),
   * if it belongs to this role's portal; otherwise the portal home. */
  const destinationFor = (home: '/app' | '/teacher' | '/student'): string => {
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
    const path = from?.pathname ?? '';
    const inPortal = path === home || path.startsWith(`${home}/`)
      || (home === '/student' && path.startsWith('/face-registration'));
    return inPortal ? `${path}${from?.search ?? ''}` : home;
  };
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
        navigate(destinationFor("/app"));
      } else if (signedInUser?.role === 'faculty' || signedInUser?.role === 'teacher') {
        toast({
          title: "Login Successful",
          description: "Welcome to the teacher portal.",
        });
        navigate(destinationFor("/teacher"));
      } else {
        toast({
          title: "Login Successful",
          description: "Welcome to your student dashboard.",
        });
        navigate(destinationFor("/student"));
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas text-text-primary">
      <Navbar />

      <main className="relative flex min-h-[calc(100vh-3.5rem)] flex-1 items-center justify-center overflow-hidden px-4 py-12">
        {/* Soft brand-tinted backdrop (pure CSS) */}
        <div className="pointer-events-none absolute inset-0" style={AUTH_BACKDROP} aria-hidden />

        <div className="relative w-full max-w-[440px] space-y-3">
          <div className="w-full rounded-lg bg-surface-default p-8 shadow-xl sm:p-11">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="h-6 w-6 object-contain" />
              <span className="text-subheading text-text-primary">AttendAI</span>
            </div>

            <h1 className="mt-6 text-page-title text-text-primary">Sign in</h1>
            <p className="mt-1 text-body text-text-secondary">
              Sign in with institutional credentials to access your portal
            </p>

            {loginError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2 text-body text-text-primary"
              >
                <ErrorCircle20Filled className="mt-px shrink-0 text-status-error" aria-hidden />
                <span>{loginError}</span>
              </div>
            )}

            <Tabs defaultValue="student" className="mt-6 w-full">
              <p className="mb-2 text-caption text-text-muted">Select your institutional role to continue</p>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="student" className={triggerClass}>
                  <HatGraduation16Regular aria-hidden />
                  Student
                </TabsTrigger>
                <TabsTrigger value="teacher" className={triggerClass}>
                  <PeopleTeam16Regular aria-hidden />
                  Teacher
                </TabsTrigger>
                <TabsTrigger value="admin" className={triggerClass}>
                  <Building16Regular aria-hidden />
                  Admin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="student" className="mt-5 space-y-4">
                <p className="text-body text-text-secondary">
                  Enter the student email and password provisioned by administration.
                </p>
                <form onSubmit={handleStudentSubmit(onStudentSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="student-email" className={labelClass}>
                      Student Email
                    </Label>
                    <Input
                      id="student-email"
                      type="email"
                      autoComplete="username"
                      placeholder="student@institution.edu"
                      aria-invalid={!!studentErrors.email}
                      {...registerStudent("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {studentErrors.email && (
                      <p className="text-caption text-status-error">{studentErrors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="student-password" className={labelClass}>
                      Password
                    </Label>
                    <PasswordInput
                      id="student-password"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      aria-invalid={!!studentErrors.password}
                      {...registerStudent("password", { required: "Password is required" })}
                    />
                    {studentErrors.password && (
                      <p className="text-caption text-status-error">{studentErrors.password.message}</p>
                    )}
                  </div>

                  <div>
                    <Link
                      to="/forgot-password"
                      className="text-body text-brand-foreground hover:text-brand-foreground-hover hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-w-[120px] font-semibold"
                    >
                      {isSubmitting ? (
                        <>
                          <ButtonSpinner />
                          Authenticating...
                        </>
                      ) : (
                        "Sign in as student"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="teacher" className="mt-5 space-y-4">
                <p className="text-body text-text-secondary">
                  Faculty members: sign in with your verified departmental credentials.
                </p>
                <form onSubmit={handleTeacherSubmit(onTeacherSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="teacher-email" className={labelClass}>
                      Faculty Email
                    </Label>
                    <Input
                      id="teacher-email"
                      type="email"
                      autoComplete="username"
                      placeholder="faculty@institution.edu"
                      aria-invalid={!!teacherErrors.email}
                      {...registerTeacher("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {teacherErrors.email && (
                      <p className="text-caption text-status-error">{teacherErrors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="teacher-password" className={labelClass}>
                      Password
                    </Label>
                    <PasswordInput
                      id="teacher-password"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      aria-invalid={!!teacherErrors.password}
                      {...registerTeacher("password", { required: "Password is required" })}
                    />
                    {teacherErrors.password && (
                      <p className="text-caption text-status-error">{teacherErrors.password.message}</p>
                    )}
                  </div>

                  <div>
                    <Link
                      to="/forgot-password"
                      className="text-body text-brand-foreground hover:text-brand-foreground-hover hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-w-[120px] font-semibold"
                    >
                      {isSubmitting ? (
                        <>
                          <ButtonSpinner />
                          Authenticating...
                        </>
                      ) : (
                        "Sign in as teacher"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="admin" className="mt-5 space-y-4">
                <p className="text-body text-text-secondary">
                  System administrators: enter authorized institutional account details.
                </p>
                <form onSubmit={handleAdminSubmit(onAdminSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email" className={labelClass}>
                      Administrator Email
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      autoComplete="username"
                      placeholder="admin@institution.edu"
                      aria-invalid={!!adminErrors.email}
                      {...registerAdmin("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {adminErrors.email && (
                      <p className="text-caption text-status-error">{adminErrors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-password" className={labelClass}>
                      Admin Password
                    </Label>
                    <PasswordInput
                      id="admin-password"
                      autoComplete="current-password"
                      placeholder="Enter admin password"
                      aria-invalid={!!adminErrors.password}
                      {...registerAdmin("password", { required: "Password is required" })}
                    />
                    {adminErrors.password && (
                      <p className="text-caption text-status-error">{adminErrors.password.message}</p>
                    )}
                  </div>

                  <div>
                    <Link
                      to="/forgot-password"
                      className="text-body text-brand-foreground hover:text-brand-foreground-hover hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-w-[120px] font-semibold"
                    >
                      {isSubmitting ? (
                        <>
                          <ButtonSpinner />
                          Authenticating...
                        </>
                      ) : (
                        "Sign in as administrator"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          {/* Secondary "sign-in options" style card */}
          <div className="flex w-full items-center gap-3 rounded-lg bg-surface-default px-8 py-3 shadow sm:px-11">
            <Key20Regular className="shrink-0 text-text-secondary" aria-hidden />
            <p className="text-body text-text-secondary">
              Need access? Contact the department system administrator.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LoginPage;
