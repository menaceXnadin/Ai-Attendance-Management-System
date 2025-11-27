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
import { Mail, ArrowLeft, CheckCircle, Shield, Lock } from 'lucide-react';
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
                  <div className="absolute inset-0 bg-teal-400 rounded-2xl blur-xl opacity-30 animate-pulse"></div>
                  <div className="relative p-4 bg-gradient-to-br from-blue-500 to-teal-400 rounded-2xl shadow-lg">
                    {requestRecorded ? (
                      <CheckCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
                    ) : (
                      <Shield className="h-10 w-10 text-white" strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 text-center">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
                  {requestRecorded ? 'Request Submitted' : 'Reset Your Password'}
                </CardTitle>
                <CardDescription className="text-base text-blue-300">
                  {requestRecorded 
                    ? 'Your request has been securely recorded' 
                    : 'Enter your email to request a password reset'}
                </CardDescription>
              </div>
            </CardHeader>

            {requestRecorded ? (
              <CardContent className="space-y-6 pb-8">
                <div className="bg-blue-950/50 border border-teal-700/30 rounded-xl p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="p-2 bg-teal-950/50 rounded-lg border border-teal-700/50">
                        <Lock className="h-5 w-5 text-teal-400" />
                      </div>
                    </div>
                    <div className="space-y-2 flex-1">
                      <h3 className="font-semibold text-blue-200">What happens next?</h3>
                      <ul className="space-y-2 text-sm text-blue-300/90">
                        <li className="flex items-start gap-2">
                          <span className="text-teal-400 mt-0.5">•</span>
                          <span>An administrator will review your request</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-400 mt-0.5">•</span>
                          <span>They will generate a secure reset link for you</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-400 mt-0.5">•</span>
                          <span>The link will expire in 1 hour for security</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button 
                    onClick={() => navigate('/login')} 
                    className="w-full h-11 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 shadow-lg shadow-teal-500/30 transition-all duration-200 text-white font-medium"
                  >
                    Return to Login
                  </Button>
                  <Button 
                    onClick={() => setRequestRecorded(false)} 
                    className="w-full h-11 text-blue-300 border-slate-600 hover:bg-slate-800/50 hover:text-teal-300"
                    variant="outline"
                  >
                    Submit Another Request
                  </Button>
                </div>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-blue-300">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-teal-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@university.edu"
                        {...register('email', {
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address',
                          },
                        })}
                        className={`pl-10 h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 transition-all duration-200 ${
                          errors.email 
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                            : 'focus:border-teal-400 focus:ring-teal-400'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-red-600 flex items-center gap-1 animate-in slide-in-from-left-1">
                        <span className="text-red-500">⚠</span> {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-950/50 border border-blue-700/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-teal-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-blue-300">Security Notice</h4>
                        <p className="text-sm text-blue-300/80 leading-relaxed">
                          For your protection, reset links are only generated by administrators after verifying your request. Links expire in 1 hour.
                        </p>
                      </div>
                    </div>
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
                        Submitting Request...
                      </span>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>

                  <Link to="/login" className="w-full">
                    <Button type="button" variant="ghost" className="w-full h-11 text-blue-300 hover:bg-slate-800/50 hover:text-teal-300 transition-colors">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Login
                    </Button>
                  </Link>
                </CardFooter>
              </form>
            )}
          </Card>

          <p className="text-center text-sm text-blue-300 mt-6">
            Need immediate help? Contact your system administrator
          </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
