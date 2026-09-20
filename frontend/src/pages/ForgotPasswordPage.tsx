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
import { Email, ArrowLeft, CheckmarkFilled, Security, Locked, Renew } from '@carbon/icons-react';
import { apiClient } from '@/integrations/api/client';

interface ForgotPasswordFormData {
  email: string;
}

const ForgotPasswordPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestRecorded, setRequestRecorded] = useState(false);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/auth/forgot-password',
        { email: data.email }
      );
      if (response.data?.success) {
        setRequestRecorded(true);
        toast({
          title: 'Request recorded',
          description: 'If the account exists, an admin can generate a reset link.',
        });
      }
    } catch (error: unknown) {
      console.error('Forgot password error:', error);
      
      // Even on error, show success message to prevent email enumeration
      setRequestRecorded(true);
      toast({
        title: 'Request received',
        description: 'If the account exists, an admin can generate a reset link.',
        variant: "default",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas text-text-primary">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">AttendAI Account Recovery</h1>
            <p className="text-sm text-text-secondary mt-1">
              Request a secure password reset link
            </p>
          </div>

          <Card className="border border-border-subtle bg-surface-default shadow-card rounded-lg">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-surface-canvas border border-border-subtle text-action-primary">
                  {requestRecorded ? (
                    <CheckmarkFilled className="w-6 h-6 text-status-success" />
                  ) : (
                    <Security className="w-6 h-6 text-action-primary" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-text-primary">
                    {requestRecorded ? 'Request Recorded' : 'Reset Your Password'}
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    {requestRecorded 
                      ? 'Your recovery request has been submitted' 
                      : 'Enter institutional email associated with your account'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            {requestRecorded ? (
              <CardContent className="pt-6 space-y-5">
                <div className="p-4 rounded-lg bg-surface-canvas border border-border-subtle space-y-3">
                  <div className="flex items-start gap-3">
                    <Locked className="w-5 h-5 text-action-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-xs">
                      <h3 className="font-semibold text-text-primary">Next Steps</h3>
                      <ul className="space-y-1.5 text-text-secondary list-disc pl-4">
                        <li>An authorized administrator will review your account status.</li>
                        <li>Upon approval, a one-time secure password link will be activated.</li>
                        <li>Security links remain valid for 60 minutes after generation.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button 
                    onClick={() => navigate('/login')} 
                    className="w-full"
                  >
                    Return to Login
                  </Button>
                  <Button 
                    onClick={() => setRequestRecorded(false)} 
                    className="w-full"
                    variant="outline"
                  >
                    Submit Another Request
                  </Button>
                </div>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-text-secondary">
                      Registered Email Address
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@institution.edu"
                        {...register('email', {
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address',
                          },
                        })}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-status-error">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="p-3 rounded-md bg-surface-canvas border border-border-subtle flex items-start gap-2.5">
                    <Security className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary leading-relaxed">
                      For institutional privacy, password reset links are verified before authorization.
                    </p>
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
                        Submitting Request...
                      </span>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>

                  <Link to="/login" className="w-full">
                    <Button type="button" variant="ghost" className="w-full text-text-secondary hover:text-text-primary">
                      <ArrowLeft className="mr-1.5 w-4 h-4" />
                      Back to Login
                    </Button>
                  </Link>
                </CardFooter>
              </form>
            )}
          </Card>

          <p className="text-center text-xs text-text-muted mt-6">
            Need direct assistance? Contact institutional IT support.
          </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
