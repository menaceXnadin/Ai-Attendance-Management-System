import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/useAuth';

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const onSubmit = async (data: LoginFormData) => {
    const { error } = await signIn(data.email, data.password);
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
      toast({
        title: "Login successful",
        description: "You have been logged in successfully.",
      });
      navigate("/app");
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
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address",
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder=""
                  {...register("password", { required: "Password is required" })}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                <div className="text-sm">
                  <Link to="/" className="font-medium text-brand-500 hover:text-brand-400">
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <Button type="submit" className="w-full bg-brand-500 hover:bg-brand-600">
                Sign in
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col">
            <p className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/register" className="font-medium text-brand-500 hover:text-brand-400">
                Register
              </Link>
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
