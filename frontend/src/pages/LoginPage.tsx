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

interface LoginFormData {
  email: string;
  password: string;
  userType?: 'student' | 'admin' | 'teacher';
  rememberMe?: boolean;
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
  const [showError, setShowError] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    const { error, user: signedInUser } = await signIn(data.email, data.password, rememberMe);
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
      setShowError(true);
      toast({
        title: "Login failed",
        description: errorMsg,
        variant: "destructive",
      });
      setTimeout(() => { setShowError(false); }, 2500); // Hide after 2.5s
      setTimeout(() => { setLoginError(null); }, 3000); // Remove from DOM after animation
    } else {
      setLoginError(null);
      setShowError(false);
      
      // Check if the user has the correct role
      if (userType === 'admin' && signedInUser?.role !== 'admin') {
        toast({
          title: "Access denied",
          description: "This account does not have admin privileges.",
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
          title: "Wrong login portal",
          description: "Please use the appropriate login for your account.",
          variant: "destructive",
        });
        return;
      }
      
      // Redirect based on role
      if (signedInUser?.role === 'admin') {
        toast({
          title: "Admin login successful",
          description: "Welcome to the admin dashboard.",
        });
        navigate("/app");
      } else if (signedInUser?.role === 'faculty' || signedInUser?.role === 'teacher') {
        toast({
          title: "Teacher login successful",
          description: "Welcome to your teacher dashboard.",
        });
        navigate("/teacher");
      } else {
        toast({
          title: "Student login successful",
          description: "Welcome to your student dashboard.",
        });
        navigate("/student");
      }
    }
  };

  return (
    <>
      <Navbar />

      {/* Login Error Popup */}
      {loginError && (
        <div className="fixed inset-0 flex items-start justify-center z-50 pointer-events-none">
          <div
            className={`transition-all duration-500 ease-in-out transform ${
              showError ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
            } bg-gradient-to-br from-red-700 via-blue-900 to-blue-800 text-white px-10 py-6 rounded-2xl shadow-2xl text-xl font-bold flex items-center gap-4 pointer-events-auto animate-slideDownError`}
            style={{
              minWidth: 320,
              minHeight: 64,
              animation: showError
                ? "slideDownError 0.5s cubic-bezier(0.4,0,0.2,1) forwards"
                : "slideUpError 0.5s cubic-bezier(0.4,0,0.2,1) forwards",
            }}
          >
            <svg
              className="w-8 h-8 text-white animate-bounce"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
              />
            </svg>
            {loginError}
          </div>
        </div>
      )}

      {/* Login Form Popup (slide down) */}
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-blue-950 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse"></div>
          <div className="absolute top-60 -left-20 w-60 h-60 bg-teal-400 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-indigo-500 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <Card className="w-full max-w-md bg-slate-900/80 border border-slate-700/50 shadow-2xl rounded-2xl backdrop-blur-md z-10 animate-in fade-in-0 zoom-in-95 duration-700">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
              Login to AttendAI
            </CardTitle>
            <CardDescription className="text-center text-blue-300">
              Choose your login type
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="student" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 bg-slate-800/50 transition-all duration-300">
                <TabsTrigger value="student" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-teal-400 data-[state=active]:text-white data-[state=inactive]:text-blue-300 transition-all duration-300 hover:scale-105">Student</TabsTrigger>
                <TabsTrigger value="teacher" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=inactive]:text-blue-300 transition-all duration-300 hover:scale-105">Teacher</TabsTrigger>
                <TabsTrigger value="admin" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=inactive]:text-blue-300 transition-all duration-300 hover:scale-105">Admin</TabsTrigger>
              </TabsList>
              
              {/* Student Login Tab */}
              <TabsContent value="student" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                <div className="mb-4 p-3 bg-blue-950/50 border border-blue-700/30 rounded-md transition-all duration-300 hover:bg-blue-950/60">
                  <p className="text-sm text-blue-300">
                    Students, please use the login credentials provided by your admin.
                  </p>
                </div>
                <form onSubmit={handleStudentSubmit(onStudentSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-email" className="text-blue-200 transition-colors duration-200 hover:text-blue-100">Email</Label>
                    <Input
                      id="student-email"
                      type="email"
                      placeholder="Enter your email"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 placeholder:text-blue-400/50 transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 focus:bg-slate-800/90"
                      {...registerStudent("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {studentErrors.email && (
                      <p className="text-sm text-red-500 animate-in slide-in-from-top-1 duration-300">Email is required</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password" className="text-blue-200 transition-colors duration-200 hover:text-blue-100">Password</Label>
                    <PasswordInput
                      id="student-password"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 transition-all duration-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 focus:bg-slate-800/90"
                      {...registerStudent("password", { required: "Password is required" })}
                    />
                    {studentErrors.password && (
                      <p className="text-sm text-red-500 animate-in slide-in-from-top-1 duration-300">Password is required</p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                      <div className="relative">
                        <input
                          id="student-remember-me"
                          name="remember-me"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-md border-2 transition-all duration-300 ease-in-out transform group-hover:scale-110 flex items-center justify-center ${
                          rememberMe 
                            ? 'bg-blue-500 border-transparent shadow-lg shadow-blue-500/30' 
                            : 'border-slate-600 bg-slate-800/50 group-hover:border-blue-400/50'
                        }`}>
                          {rememberMe && (
                            <svg 
                              className="w-3 h-3 text-white animate-in zoom-in-50 duration-200" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={3} 
                                d="M5 13l4 4L19 7" 
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      <label 
                        htmlFor="student-remember-me" 
                        className="ml-3 text-sm text-blue-300 cursor-pointer transition-all duration-200 group-hover:text-blue-200 select-none"
                      >
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <Link to="/" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Signing in...
                      </div>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              {/* Teacher Login Tab */}
              <TabsContent value="teacher" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                <div className="mb-4 p-3 bg-purple-950/50 border border-purple-700/30 rounded-md transition-all duration-300 hover:bg-purple-950/60">
                  <p className="text-sm text-purple-300">
                    Teachers, use your credentials provided by the administrator.
                  </p>
                </div>
                <form onSubmit={handleTeacherSubmit(onTeacherSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacher-email" className="text-blue-200 transition-colors duration-200 hover:text-blue-100">Teacher Email</Label>
                    <Input
                      id="teacher-email"
                      type="email"
                      placeholder="Enter your email"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 placeholder:text-blue-400/50 transition-all duration-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:bg-slate-800/90"
                      {...registerTeacher("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {teacherErrors.email && (
                      <p className="text-sm text-red-500 animate-in slide-in-from-top-1 duration-300">Email is required</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher-password" className="text-blue-200 transition-colors duration-200 hover:text-blue-100">Password</Label>
                    <PasswordInput
                      id="teacher-password"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 transition-all duration-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:bg-slate-800/90"
                      {...registerTeacher("password", { required: "Password is required" })}
                    />
                    {teacherErrors.password && (
                      <p className="text-sm text-red-500 animate-in slide-in-from-top-1 duration-300">Password is required</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                      <div className="relative">
                        <input
                          id="teacher-remember-me"
                          name="remember-me"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-md border-2 transition-all duration-300 ease-in-out transform group-hover:scale-110 flex items-center justify-center ${
                          rememberMe 
                            ? 'bg-purple-500 border-transparent shadow-lg shadow-purple-500/30' 
                            : 'border-slate-600 bg-slate-800/50 group-hover:border-purple-400/50'
                        }`}>
                          {rememberMe && (
                            <svg 
                              className="w-3 h-3 text-white animate-in zoom-in-50 duration-200" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={3} 
                                d="M5 13l4 4L19 7" 
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      <label 
                        htmlFor="teacher-remember-me" 
                        className="ml-3 text-sm text-blue-300 cursor-pointer transition-all duration-200 group-hover:text-blue-200 select-none"
                      >
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <Link to="/" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Signing in...
                      </div>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              {/* Admin Login Tab */}
              <TabsContent value="admin" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                <form onSubmit={handleAdminSubmit(onAdminSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="text-blue-200 transition-colors duration-200 hover:text-blue-100">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter your email"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 placeholder:text-blue-400/50 transition-all duration-300 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 focus:bg-slate-800/90"
                      {...registerAdmin("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {adminErrors.email && (
                      <p className="text-sm text-red-500 animate-in slide-in-from-top-1 duration-300">Email is required</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="text-blue-200 transition-colors duration-200 hover:text-blue-100">Admin Password</Label>
                    <PasswordInput
                      id="admin-password"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 transition-all duration-300 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 focus:bg-slate-800/90"
                      {...registerAdmin("password", { required: "Password is required" })}
                    />
                    {adminErrors.password && (
                      <p className="text-sm text-red-500 animate-in slide-in-from-top-1 duration-300">Password is required</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                      <div className="relative">
                        <input
                          id="admin-remember-me"
                          name="remember-me"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-md border-2 transition-all duration-300 ease-in-out transform group-hover:scale-110 flex items-center justify-center ${
                          rememberMe 
                            ? 'bg-red-500 border-transparent shadow-lg shadow-red-500/30' 
                            : 'border-slate-600 bg-slate-800/50 group-hover:border-red-400/50'
                        }`}>
                          {rememberMe && (
                            <svg 
                              className="w-3 h-3 text-white animate-in zoom-in-50 duration-200" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={3} 
                                d="M5 13l4 4L19 7" 
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      <label 
                        htmlFor="admin-remember-me" 
                        className="ml-3 text-sm text-blue-300 cursor-pointer transition-all duration-200 group-hover:text-blue-200 select-none"
                      >
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <Link to="/" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    variant="default" 
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Signing in...
                      </div>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="flex flex-col">
            <p className="text-center text-sm text-blue-300/80">
              Contact your administrator if you need access to the system.
            </p>
          </CardFooter>
        </Card>
      </div>

      <style>{`
        @keyframes slideDown {
          0% { opacity: 0; transform: translateY(-100px) scale(0.98); }
          80% { opacity: 1; transform: translateY(10px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideDownError {
          0% { opacity: 0; transform: translateY(-40px) scale(0.98); }
          80% { opacity: 1; transform: translateY(8px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideUpError {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(0.98); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-3px); }
          60% { transform: translateY(-2px); }
        }
        
        .error-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .success-bounce {
          animation: bounce 0.6s ease-in-out;
        }
        
        .tab-transition {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .input-focus-ring {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .input-focus-ring:focus {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .checkbox-hover {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .checkbox-hover:hover {
          transform: scale(1.1);
        }
        
        .link-hover {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .link-hover:hover {
          transform: scale(1.05);
        }
        
        .button-press {
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .button-press:active {
          transform: scale(0.98);
        }
      `}</style>

      <Footer />
    </>
  );
};

export default LoginPage;
