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
  userType?: 'student' | 'admin';
}

const LoginPage = () => {
  const { register: registerStudent, handleSubmit: handleStudentSubmit, formState: { errors: studentErrors } } = useForm<LoginFormData>({
    defaultValues: { userType: 'student' }
  });
  const { register: registerAdmin, handleSubmit: handleAdminSubmit, formState: { errors: adminErrors } } = useForm<LoginFormData>({
    defaultValues: { userType: 'admin' }
  });
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const onStudentSubmit = async (data: LoginFormData) => {
    await handleLogin(data, 'student');
  };

  const onAdminSubmit = async (data: LoginFormData) => {
    await handleLogin(data, 'admin');
  };

  const handleLogin = async (data: LoginFormData, userType: 'student' | 'admin') => {
    const { error, user: signedInUser } = await signIn(data.email, data.password);
    if (error) {
      const errorMsg = error?.message || "Login failed";
      setLoginError(errorMsg);
      setShowError(true);
      toast({
        title: "Login failed",
        description: errorMsg,
        variant: "destructive",
      });
      setTimeout(() => setShowError(false), 2500); // Hide after 2.5s
      setTimeout(() => setLoginError(null), 3000); // Remove from DOM after animation
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
      } else if (userType === 'student' && signedInUser?.role === 'admin') {
        toast({
          title: "Wrong login portal",
          description: "Please use the admin login for your account.",
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
        navigate("/app"); // Navigate to admin dashboard
      } else {
        // Default to student for any other role or if role is undefined
        toast({
          title: "Student login successful",
          description: "Welcome to your student dashboard.",
        });
        navigate("/student"); // Navigate to student dashboard
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
        
        <Card className="w-full max-w-md bg-slate-900/80 border border-slate-700/50 shadow-2xl rounded-2xl backdrop-blur-md z-10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
              Login to AttendAI
            </CardTitle>
            <CardDescription className="text-center text-blue-300">
              Choose your login type
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="student" className="w-full">            <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-800/50">
              <TabsTrigger value="student" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-teal-400 data-[state=active]:text-white data-[state=inactive]:text-blue-300">Student Login</TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=inactive]:text-blue-300">Admin Login</TabsTrigger>
              </TabsList>
              
              {/* Student Login Tab */}
              <TabsContent value="student">
                <div className="mb-4 p-3 bg-blue-950/50 border border-blue-700/30 rounded-md">
                  <p className="text-sm text-blue-300">
                    Students, please use the login credentials provided by your admin.
                  </p>
                </div>
                <form onSubmit={handleStudentSubmit(onStudentSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-email" className="text-blue-200">Email</Label>
                    <Input
                      id="student-email"
                      type="email"
                      placeholder="Enter your email"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 placeholder:text-blue-400/50"
                      {...registerStudent("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {studentErrors.email && (
                      <p className="text-sm text-red-500">{studentErrors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password" className="text-blue-200">Password</Label>
                    <PasswordInput
                      id="student-password"
                      className="bg-slate-800/70 border-slate-700 text-blue-100"
                      {...registerStudent("password", { required: "Password is required" })}
                    />
                    {studentErrors.password && (
                      <p className="text-sm text-red-500">{studentErrors.password.message}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="student-remember-me"
                        name="remember-me"
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      <label htmlFor="student-remember-me" className="ml-2 block text-sm text-blue-300">
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <Link to="/" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white transition-all duration-300">
                    Student Sign in
                  </Button>
                </form>
              </TabsContent>
              
              {/* Admin Login Tab */}
              <TabsContent value="admin">
                <form onSubmit={handleAdminSubmit(onAdminSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="text-blue-200">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter your email"
                      className="bg-slate-800/70 border-slate-700 text-blue-100 placeholder:text-blue-400/50"
                      {...registerAdmin("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {adminErrors.email && (
                      <p className="text-sm text-red-500">{adminErrors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="text-blue-200">Admin Password</Label>
                    <PasswordInput
                      id="admin-password"
                      className="bg-slate-800/70 border-slate-700 text-blue-100"
                      {...registerAdmin("password", { required: "Password is required" })}
                    />
                    {adminErrors.password && (
                      <p className="text-sm text-red-500">{adminErrors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="admin-remember-me"
                        name="remember-me"
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      <label htmlFor="admin-remember-me" className="ml-2 block text-sm text-blue-300">
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <Link to="/" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button type="submit" variant="default" className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-300">
                    Admin Sign in
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
      `}</style>

      <Footer />
    </>
  );
};

export default LoginPage;
