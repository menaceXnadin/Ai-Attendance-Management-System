import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Lock, CheckCircle, AlertCircle, Shield, Check, X } from 'lucide-react';
import { apiClient } from '@/integrations/api/client';

interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

const ResetPasswordPage: React.FC = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const token = searchParams.get('token');

  const newPassword = watch('newPassword');

  // Password strength validation
  const passwordChecks = {
    length: newPassword?.length >= 8,
    uppercase: /[A-Z]/.test(newPassword || ''),
    lowercase: /[a-z]/.test(newPassword || ''),
    number: /\d/.test(newPassword || ''),
  };

  useEffect(() => {
    // Validate that token exists
    if (!token) {
      setTokenValid(false);
      toast({
        title: "Invalid reset link",
        description: "The password reset link is invalid or missing.",
        variant: "destructive",
      });
    } else {
      setTokenValid(true);
    }
  }, [token, toast]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast({
        title: "Error",
        description: "Invalid reset token",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/auth/reset-password',
        { token, new_password: data.newPassword }
      );
      
      if (response.data?.success) {
        setResetSuccess(true);
        toast({
          title: "Password reset successful!",
          description: "Your password has been changed. You can now login.",
          variant: "default",
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error: unknown) {
      console.error('Reset password error:', error);
      const err = error as { response?: { data?: { detail?: string } } };
      const errorMessage = err.response?.data?.detail || 'Failed to reset password. The link may have expired.';
      
      toast({
        title: "Reset failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show error if token is invalid
  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 to-blue-950 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500 rounded-full opacity-10 blur-3xl animate-pulse"></div>
          <div className="absolute top-60 -left-20 w-60 h-60 bg-orange-400 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <Navbar />
        
        <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
          <div className="w-full max-w-md">
            <Card className="bg-slate-900/80 border border-slate-700/50 shadow-2xl backdrop-blur-md">
              <CardHeader className="space-y-6 pb-8">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-2xl blur-xl opacity-30 animate-pulse"></div>
                    <div className="relative p-4 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl shadow-lg">
                      <AlertCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 text-center">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
                    Invalid Reset Link
                  </CardTitle>
                  <CardDescription className="text-base text-blue-300">
                    This password reset link is invalid or has expired
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6 pb-8">
                <div className="bg-red-950/30 border border-red-700/30 rounded-xl p-6 space-y-3">
                  <h3 className="font-semibold text-blue-200">What went wrong?</h3>
                  <ul className="space-y-2 text-sm text-blue-300/90">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>The link may have been already used</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Reset links expire after 1 hour for security</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>The link may have been copied incorrectly</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <Button 
                    onClick={() => navigate('/forgot-password')} 
                    className="w-full h-11 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-500/30 transition-all duration-200 text-white font-medium"
                  >
                    Request New Reset Link
                  </Button>
                  <Button 
                    onClick={() => navigate('/login')} 
                    variant="outline" 
                    className="w-full h-11 text-blue-300 border-slate-600 hover:bg-slate-800/50 hover:text-teal-300"
                  >
                    Back to Login
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 to-blue-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse"></div>
        <div className="absolute top-60 -left-20 w-60 h-60 bg-teal-400 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">
          <Card className="bg-slate-900/80 border border-slate-700/50 shadow-2xl backdrop-blur-md">
            <CardHeader className="space-y-6 pb-8">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-2xl blur-xl opacity-30 animate-pulse ${
                    resetSuccess ? 'bg-teal-400' : 'bg-teal-400'
                  }`}></div>
                  <div className={`relative p-4 rounded-2xl shadow-lg ${
                    resetSuccess 
                      ? 'bg-gradient-to-br from-blue-500 to-teal-400' 
                      : 'bg-gradient-to-br from-blue-500 to-teal-400'
                  }`}>
                    {resetSuccess ? (
                      <CheckCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
                    ) : (
                      <Lock className="h-10 w-10 text-white" strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 text-center">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
                  {resetSuccess ? 'Password Changed!' : 'Create New Password'}
                </CardTitle>
                <CardDescription className="text-base text-blue-300">
                  {resetSuccess 
                    ? "Your password has been successfully updated"
                    : "Choose a strong password to secure your account"
                  }
                </CardDescription>
              </div>
            </CardHeader>

            {resetSuccess ? (
              <CardContent className="space-y-6 pb-8">
                <div className="bg-blue-950/50 border border-teal-700/30 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="p-3 bg-teal-950/50 rounded-full border border-teal-700/50">
                      <Check className="h-8 w-8 text-teal-400" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-blue-200">All set!</h3>
                    <p className="text-sm text-blue-300">
                      You can now sign in with your new password
                    </p>
                    <div className="flex items-center justify-center gap-1 text-sm text-blue-300/80 pt-2">
                      <span className="inline-block h-1.5 w-1.5 bg-teal-400 rounded-full animate-pulse"></span>
                      <span>Redirecting to login...</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={() => navigate('/login')} 
                  className="w-full h-11 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 shadow-lg shadow-teal-500/30 transition-all duration-200 text-white font-medium"
                >
                  Continue to Login
                </Button>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium text-blue-300">
                      New Password
                    </Label>
                    <PasswordInput
                      id="newPassword"
                      placeholder="Enter new password"
                      {...register('newPassword', {
                        required: 'Password is required',
                        minLength: {
                          value: 8,
                          message: 'Password must be at least 8 characters',
                        },
                        pattern: {
                          value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                          message: 'Password must contain uppercase, lowercase, and number',
                        },
                      })}
                      className={`h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 transition-all duration-200 ${
                        errors.newPassword 
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                          : 'focus:border-teal-400 focus:ring-teal-400'
                      }`}
                    />
                    {errors.newPassword && (
                      <p className="text-sm text-red-600 flex items-center gap-1 animate-in slide-in-from-left-1">
                        <X className="h-4 w-4" /> {errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  {newPassword && (
                    <div className="bg-blue-950/50 border border-slate-600 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2">
                      <h4 className="text-sm font-semibold text-blue-200 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-teal-400" />
                        Password Strength
                      </h4>
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 text-sm transition-colors ${
                          passwordChecks.length ? 'text-teal-400' : 'text-slate-400'
                        }`}>
                          <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                            passwordChecks.length ? 'bg-teal-950/50 border border-teal-700/50' : 'bg-slate-800/50 border border-slate-700'
                          }`}>
                            {passwordChecks.length ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="h-2 w-2 bg-slate-500 rounded-full"></span>
                            )}
                          </div>
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm transition-colors ${
                          passwordChecks.uppercase ? 'text-teal-400' : 'text-slate-400'
                        }`}>
                          <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                            passwordChecks.uppercase ? 'bg-teal-950/50 border border-teal-700/50' : 'bg-slate-800/50 border border-slate-700'
                          }`}>
                            {passwordChecks.uppercase ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="h-2 w-2 bg-slate-500 rounded-full"></span>
                            )}
                          </div>
                          <span>Uppercase letter</span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm transition-colors ${
                          passwordChecks.lowercase ? 'text-teal-400' : 'text-slate-400'
                        }`}>
                          <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                            passwordChecks.lowercase ? 'bg-teal-950/50 border border-teal-700/50' : 'bg-slate-800/50 border border-slate-700'
                          }`}>
                            {passwordChecks.lowercase ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="h-2 w-2 bg-slate-500 rounded-full"></span>
                            )}
                          </div>
                          <span>Lowercase letter</span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm transition-colors ${
                          passwordChecks.number ? 'text-teal-400' : 'text-slate-400'
                        }`}>
                          <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                            passwordChecks.number ? 'bg-teal-950/50 border border-teal-700/50' : 'bg-slate-800/50 border border-slate-700'
                          }`}>
                            {passwordChecks.number ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="h-2 w-2 bg-slate-500 rounded-full"></span>
                            )}
                          </div>
                          <span>Number</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-blue-300">
                      Confirm Password
                    </Label>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="Confirm new password"
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (value) => value === newPassword || 'Passwords do not match',
                      })}
                      className={`h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 transition-all duration-200 ${
                        errors.confirmPassword 
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                          : 'focus:border-teal-400 focus:ring-teal-400'
                      }`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600 flex items-center gap-1 animate-in slide-in-from-left-1">
                        <X className="h-4 w-4" /> {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col space-y-3 pb-8">
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 shadow-lg shadow-teal-500/30 transition-all duration-200 disabled:opacity-50 text-white font-medium"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Updating Password...
                      </span>
                    ) : (
                      'Update Password'
                    )}
                  </Button>

                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full h-11 text-blue-300 hover:bg-slate-800/50 hover:text-teal-300 transition-colors"
                    onClick={() => navigate('/login')}
                  >
                    Cancel
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>

          <p className="text-center text-sm text-blue-300 mt-6">
            Remember your password? <Link to="/login" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
