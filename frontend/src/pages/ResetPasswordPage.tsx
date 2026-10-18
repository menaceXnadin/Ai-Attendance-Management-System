import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import logo from '@/assets/main.png';
import {
  CheckmarkCircle16Filled,
  CheckmarkCircle20Filled,
  Circle16Regular,
  ErrorCircle16Regular,
  ErrorCircle20Filled,
  ShieldCheckmark16Regular,
} from '@fluentui/react-icons';
import { apiClient } from '@/integrations/api/client';

interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
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

/** Microsoft account-style centered card shell shared by every state of this page. */
const AuthShell: React.FC<{ children: React.ReactNode; below?: React.ReactNode }> = ({ children, below }) => (
  <div className="flex min-h-screen flex-col bg-surface-canvas text-text-primary">
    <Navbar />

    <main className="relative flex min-h-[calc(100vh-3.5rem)] flex-grow items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0" style={AUTH_BACKDROP} aria-hidden />

      <div className="relative w-full max-w-[440px] space-y-3">
        <div className="w-full rounded-lg bg-surface-default p-8 shadow-xl sm:p-11">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6 object-contain" />
            <span className="text-subheading text-text-primary">AttendAI</span>
            <span className="mx-1 h-4 w-px bg-border-default" aria-hidden />
            <span className="text-body text-text-secondary">Security</span>
          </div>
          {children}
        </div>
        {below}
      </div>
    </main>

    <Footer />
  </div>
);

const RequirementItem: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <div className={`flex items-center gap-1.5 ${met ? 'text-status-success' : 'text-text-muted'}`}>
    {met ? (
      <CheckmarkCircle16Filled className="shrink-0" aria-hidden />
    ) : (
      <Circle16Regular className="shrink-0" aria-hidden />
    )}
    <span className={met ? 'text-text-primary' : undefined}>{label}</span>
  </div>
);

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
      <AuthShell>
        <h1 className="mt-6 text-page-title text-text-primary">Invalid or Expired Link</h1>
        <p className="mt-1 text-body text-text-secondary">
          This password reset authorization is no longer valid
        </p>

        <div className="mt-6 space-y-5">
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2 text-body text-text-primary"
          >
            <ErrorCircle20Filled className="mt-px shrink-0 text-status-error" aria-hidden />
            <span>The password reset link is invalid or missing.</span>
          </div>

          <div className="space-y-2 rounded-md bg-surface-subtle p-4">
            <h2 className="text-body-strong text-text-primary">Possible Reasons:</h2>
            <ul className="list-disc space-y-1.5 pl-4 text-body text-text-secondary">
              <li>The reset token has already been consumed.</li>
              <li>The link expired (valid for 60 minutes after issuance).</li>
              <li>The link URL was modified or copied incompletely.</li>
            </ul>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
            >
              Back to Login
            </Button>
            <Button
              onClick={() => navigate('/forgot-password')}
              className="font-semibold"
            >
              Request New Reset Link
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      below={
        <div className="w-full rounded-lg bg-surface-default px-8 py-3 shadow sm:px-11">
          <p className="text-body text-text-secondary">
            Remember your credentials?{' '}
            <Link to="/login" className="text-brand-foreground hover:text-brand-foreground-hover hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      }
    >
      <h1 className="mt-6 text-page-title text-text-primary">
        {resetSuccess ? 'Password Updated' : 'Create New Password'}
      </h1>
      <p className="mt-1 text-body text-text-secondary">
        {resetSuccess
          ? 'Your security credentials have been updated'
          : 'Choose a strong password meeting security standards'}
      </p>

      {resetSuccess ? (
        <div className="mt-6 space-y-5">
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2 text-body text-text-primary"
          >
            <CheckmarkCircle20Filled className="mt-px shrink-0 text-status-success" aria-hidden />
            <div>
              <p className="font-semibold">Password Reset Complete</p>
              <p className="text-text-secondary">
                You can now sign in using your new credentials. Redirecting to login shortly...
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => navigate('/login')}
              className="min-w-[120px] font-semibold"
            >
              Continue to Login
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newPassword" className={labelClass}>
              New Password
            </Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder="Enter new password"
              aria-invalid={!!errors.newPassword}
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
              <p className="flex items-center gap-1 text-caption text-status-error">
                <ErrorCircle16Regular className="shrink-0" aria-hidden /> {errors.newPassword.message}
              </p>
            )}
          </div>

          {newPassword && (
            <div className="space-y-2 rounded-md bg-surface-subtle p-3">
              <h2 className="flex items-center gap-1.5 text-caption-strong text-text-primary">
                <ShieldCheckmark16Regular className="text-brand-foreground" aria-hidden />
                Password Requirements
              </h2>
              <div className="grid grid-cols-2 gap-2 text-caption">
                <RequirementItem met={passwordChecks.length} label="8+ characters" />
                <RequirementItem met={passwordChecks.uppercase} label="Uppercase letter" />
                <RequirementItem met={passwordChecks.lowercase} label="Lowercase letter" />
                <RequirementItem met={passwordChecks.number} label="Number" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className={labelClass}>
              Confirm Password
            </Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm new password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === newPassword || 'Passwords do not match',
              })}
            />
            {errors.confirmPassword && (
              <p className="flex items-center gap-1 text-caption text-status-error">
                <ErrorCircle16Regular className="shrink-0" aria-hidden /> {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/login')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-w-[120px] font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ButtonSpinner />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPasswordPage;
