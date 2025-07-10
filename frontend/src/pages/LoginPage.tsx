import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      setLoginError("Login failed");
      setShowError(true);
      toast({
        title: "Login failed",
        description: "Invalid email or password. Please try again.",
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
        <Card className="w-full max-w-md bg-white/95 border-none shadow-2xl rounded-2xl backdrop-blur-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-blue-900">
              Login to AttendAI
            </CardTitle>
            <CardDescription className="text-center text-blue-500">
              Choose your login type
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="student" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="student">Student Login</TabsTrigger>
                <TabsTrigger value="admin">Admin Login</TabsTrigger>
              </TabsList>
              
              {/* Student Login Tab */}
              <TabsContent value="student">
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                  <p className="text-sm text-blue-700">
                    Students, please use the login credentials provided by your admin.
                  </p>
                </div>
                <form onSubmit={handleStudentSubmit(onStudentSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-email">Email</Label>
                    <Input
                      id="student-email"
                      type="email"
                      placeholder="student@example.com"
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
                    <Label htmlFor="student-password">Password</Label>
                    <Input
                      id="student-password"
                      type="password"
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
                      <label htmlFor="student-remember-me" className="ml-2 block text-sm text-gray-700">
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <Link to="/" className="font-medium text-brand-500 hover:text-brand-400">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-brand-500 hover:bg-brand-600">
                    Student Sign in
                  </Button>
                </form>
              </TabsContent>
              
              {/* Admin Login Tab */}
              <TabsContent value="admin">
                <form onSubmit={handleAdminSubmit(onAdminSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@example.com"
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
                    <Label htmlFor="admin-password">Admin Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
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
                      <label htmlFor="admin-remember-me" className="ml-2 block text-sm text-gray-700">
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <Link to="/" className="font-medium text-brand-500 hover:text-brand-400">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <Button type="submit" variant="default" className="w-full bg-red-600 hover:bg-red-700">
                    Admin Sign in
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="flex flex-col">
            <p className="text-center text-sm text-gray-600">
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
