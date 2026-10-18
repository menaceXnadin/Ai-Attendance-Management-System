import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import logo from '@/assets/main.png';
import {
  ArrowLeft16Regular,
  CheckmarkCircle20Filled,
  Info20Regular,
  LockClosed20Regular,
  PersonSupport20Regular,
} from '@fluentui/react-icons';
import { apiClient } from '@/integrations/api/client';

interface ForgotPasswordFormData {
  email: string;
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
    <div className="flex min-h-screen flex-col bg-surface-canvas text-text-primary">
      <Navbar />

      <main className="relative flex min-h-[calc(100vh-3.5rem)] flex-grow items-center justify-center overflow-hidden px-4 py-12">
        {/* Soft brand-tinted backdrop (pure CSS) */}
        <div className="pointer-events-none absolute inset-0" style={AUTH_BACKDROP} aria-hidden />

        <div className="relative w-full max-w-[440px] space-y-3">
          <div className="w-full rounded-lg bg-surface-default p-8 shadow-xl sm:p-11">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="h-6 w-6 object-contain" />
              <span className="text-subheading text-text-primary">AttendAI</span>
              <span className="mx-1 h-4 w-px bg-border-default" aria-hidden />
              <span className="text-body text-text-secondary">Account Recovery</span>
            </div>

            <h1 className="mt-6 text-page-title text-text-primary">
              {requestRecorded ? 'Request recorded' : 'Reset your password'}
            </h1>
            <p className="mt-1 text-body text-text-secondary">
              {requestRecorded
                ? 'Your recovery request has been submitted'
                : 'Enter institutional email associated with your account'}
            </p>

            {requestRecorded ? (
              <div className="mt-6 space-y-5">
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2 text-body text-text-primary"
                >
                  <CheckmarkCircle20Filled className="mt-px shrink-0 text-status-success" aria-hidden />
                  <span>If the account exists, an admin can generate a reset link.</span>
                </div>

                <div className="rounded-md bg-surface-subtle p-4">
                  <div className="flex items-start gap-3">
                    <LockClosed20Regular className="mt-px shrink-0 text-brand-foreground" aria-hidden />
                    <div className="space-y-2">
                      <h2 className="text-body-strong text-text-primary">Next Steps</h2>
                      <ul className="list-disc space-y-1.5 pl-4 text-body text-text-secondary">
                        <li>An authorized administrator will review your account status.</li>
                        <li>Upon approval, a one-time secure password link will be activated.</li>
                        <li>Security links remain valid for 60 minutes after generation.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button
                    onClick={() => setRequestRecorded(false)}
                    variant="outline"
                  >
                    Submit Another Request
                  </Button>
                  <Button
                    onClick={() => navigate('/login')}
                    className="font-semibold"
                  >
                    Return to Login
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-body-strong font-semibold text-text-primary">
                    Registered Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="user@institution.edu"
                    aria-invalid={!!errors.email}
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="text-caption text-status-error">{errors.email.message}</p>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info-subtle px-3 py-2 text-body text-text-primary">
                  <Info20Regular className="mt-px shrink-0 text-status-info" aria-hidden />
                  <p>For institutional privacy, password reset links are verified before authorization.</p>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button asChild type="button" variant="ghost" className="text-text-secondary hover:text-text-primary">
                    <Link to="/login">
                      <ArrowLeft16Regular aria-hidden />
                      Back to Login
                    </Link>
                  </Button>

                  <Button
                    type="submit"
                    className="min-w-[120px] font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <ButtonSpinner />
                        Submitting Request...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Secondary help card */}
          <div className="flex w-full items-center gap-3 rounded-lg bg-surface-default px-8 py-3 shadow sm:px-11">
            <PersonSupport20Regular className="shrink-0 text-text-secondary" aria-hidden />
            <p className="text-body text-text-secondary">
              Need direct assistance? Contact institutional IT support.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
