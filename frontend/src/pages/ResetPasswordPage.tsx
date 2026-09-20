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
import { Locked, CheckmarkFilled, WarningFilled, Security, Checkmark, Close, Renew } from '@carbon/icons-react';
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
    length: (newPassword?.length || 0) >= 8,
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
      <div className="min-h-screen flex flex-col bg-surface-canvas text-text-primary">
        <Navbar />
        
        <main className="flex-grow flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <Card className="border border-border-subtle bg-surface-default shadow-card rounded-lg">
              <CardHeader className="border-b border-border-subtle pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error">
                    <WarningFilled className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-text-primary">
                      Invalid or Expired Link
                    </CardTitle>
                    <CardDescription className="text-xs text-text-muted">
                      This password reset authorization is no longer valid
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-6 space-y-4">
                <div className="p-4 rounded-lg bg-surface-canvas border border-border-subtle space-y-2 text-xs">
                  <h3 className="font-semibold text-text-primary">Possible Reasons:</h3>
                  <ul className="space-y-1.5 text-text-secondary list-disc pl-4">
                    <li>The reset token has already been consumed.</li>
                    <li>The link expired (valid for 60 minutes after issuance).</li>
                    <li>The link URL was modified or copied incompletely.</li>
                  </ul>
                </div>

                <div className="space-y-2 pt-2">
                  <Button 
                    onClick={() => navigate('/forgot-password')} 
                    className="w-full"
                  >
                    Request New Reset Link
                  </Button>
                  <Button 
                    onClick={() => navigate('/login')} 
                    variant="outline" 
                    className="w-full"
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
    <div className="min-h-screen flex flex-col bg-surface-canvas text-text-primary">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">AttendAI Security</h1>
            <p className="text-sm text-text-secondary mt-1">
              Create and confirm your updated institutional password
            </p>
          </div>

          <Card className="border border-border-subtle bg-surface-default shadow-card rounded-lg">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-surface-canvas border border-border-subtle text-action-primary">
                  {resetSuccess ? (
                    <CheckmarkFilled className="w-6 h-6 text-status-success" />
                  ) : (
                    <Locked className="w-6 h-6 text-action-primary" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-text-primary">
                    {resetSuccess ? 'Password Updated' : 'Create New Password'}
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    {resetSuccess 
                      ? 'Your security credentials have been updated'
                      : 'Choose a strong password meeting security standards'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            {resetSuccess ? (
              <CardContent className="pt-6 space-y-5">
                <div className="p-4 rounded-lg bg-status-success/5 border border-status-success/30 text-center space-y-2">
                  <div className="inline-flex p-2 bg-status-success/10 rounded-full text-status-success mb-1">
                    <Checkmark className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-sm text-text-primary">Password Reset Complete</h3>
                  <p className="text-xs text-text-secondary">
                    You can now sign in using your new credentials. Redirecting to login shortly...
                  </p>
                </div>
                
                <Button 
                  onClick={() => navigate('/login')} 
                  className="w-full"
                >
                  Continue to Login
                </Button>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-medium text-text-secondary">
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
                    />
                    {errors.newPassword && (
                      <p className="text-xs text-status-error flex items-center gap-1">
                        <Close className="w-3.5 h-3.5" /> {errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  {newPassword && (
                    <div className="p-3 rounded-lg bg-surface-canvas border border-border-subtle space-y-2">
                      <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <Security className="w-3.5 h-3.5 text-action-primary" />
                        Password Requirements
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`flex items-center gap-1.5 ${
                          passwordChecks.length ? 'text-status-success' : 'text-text-muted'
                        }`}>
                          <Checkmark className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>8+ characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${
                          passwordChecks.uppercase ? 'text-status-success' : 'text-text-muted'
                        }`}>
                          <Checkmark className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Uppercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${
                          passwordChecks.lowercase ? 'text-status-success' : 'text-text-muted'
                        }`}>
                          <Checkmark className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Lowercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${
                          passwordChecks.number ? 'text-status-success' : 'text-text-muted'
                        }`}>
                          <Checkmark className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Number</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-medium text-text-secondary">
                      Confirm Password
                    </Label>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="Confirm new password"
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (value) => value === newPassword || 'Passwords do not match',
                      })}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-status-error flex items-center gap-1">
                        <Close className="w-3.5 h-3.5" /> {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="border-t border-border-subtle pt-4 flex flex-col space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Renew className="w-4 h-4 animate-spin" />
                        Updating Password...
                      </span>
                    ) : (
                      'Update Password'
                    )}
                  </Button>

                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full text-text-secondary hover:text-text-primary"
                    onClick={() => navigate('/login')}
                  >
                    Cancel
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>

          <p className="text-center text-xs text-text-muted mt-6">
            Remember your credentials? <Link to="/login" className="text-action-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
