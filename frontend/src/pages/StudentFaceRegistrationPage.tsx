import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import StudentSidebar from '@/components/StudentSidebar';
import FaceRegistration from '@/components/FaceRegistration';
import FaceMessage from '@/components/face/FaceMessage';
import { invalidateStudentFaceViews, useFaceEnrollment } from '@/components/face/faceQueries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowClockwise20Regular,
  CheckmarkCircle24Filled,
  Delete20Regular,
  LockClosed24Regular,
  ScanPerson20Regular,
} from '@fluentui/react-icons';
import { api, parseApiError } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';

const formatDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const StudentFaceRegistrationPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const enrollment = useFaceEnrollment();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = () => void invalidateStudentFaceViews(queryClient);

  const deleteFace = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await api.faceRecognition.deleteMyFace();
      setConfirmOpen(false);
      toast({ title: 'Face data deleted', description: res.message || 'Your face template was deleted.' });
      refresh();
    } catch (err) {
      setDeleteError(parseApiError(err).message || "Couldn't delete your face data. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const data = enrollment.data;
  const registeredOn = formatDate(data?.registered_at);

  let body: React.ReactNode;
  if (enrollment.isLoading) {
    body = (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-body text-text-secondary" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden />
          Loading your face registration…
        </div>
      </div>
    );
  } else if (enrollment.isError || !data) {
    body = (
      <FaceMessage
        tone="error"
        title="Couldn't load your face registration"
        actions={
          <Button size="sm" variant="outline" onClick={() => void enrollment.refetch()}>
            <ArrowClockwise20Regular aria-hidden />
            Retry
          </Button>
        }
      >
        {parseApiError(enrollment.error).message || 'Please try again in a moment.'}
      </FaceMessage>
    );
  } else if (data.status === 'enrolled') {
    body = (
      <Card className="border-border-subtle bg-surface-default shadow">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-success-subtle text-status-success">
              <CheckmarkCircle24Filled aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-subheading text-text-primary">Face registered</h2>
              <p className="text-body text-text-secondary">
                {registeredOn ? `Registered on ${registeredOn}.` : 'Your face is registered.'} You can check in to your classes with
                your face.
              </p>
            </div>
          </div>

          <ul className="space-y-1.5 rounded-md border border-border-subtle bg-surface-subtle px-4 py-3 text-caption text-text-secondary">
            <li>We keep a numeric face template, not your photos.</li>
            <li>It is used only to confirm it's you when you check in.</li>
            <li>
              Need new photos? Delete your face data below, then ask an administrator to reset your registration so you can register
              again.
            </li>
          </ul>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              className="text-status-error hover:text-status-error"
              onClick={() => {
                setDeleteError(null);
                setConfirmOpen(true);
              }}
            >
              <Delete20Regular aria-hidden />
              Delete my face data
            </Button>
            <Button asChild>
              <Link to="/student/attendance/mark">
                <ScanPerson20Regular aria-hidden />
                Check in to a class
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  } else if (data.can_enroll) {
    body = (
      <FaceRegistration
        resetByAdmin={data.status === 'reset'}
        onSuccess={() => {
          toast({ title: 'Face registered', description: 'You can now check in with your face.' });
          refresh();
        }}
        onCancel={() => navigate('/student')}
        onStateChanged={refresh}
      />
    );
  } else {
    body = (
      <Card className="border-border-subtle bg-surface-default shadow">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-warning-subtle text-status-warning">
              <LockClosed24Regular aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-subheading text-text-primary">Face registration locked</h2>
              <p className="text-body text-text-secondary">
                {data.status === 'deleted' ? 'You deleted your face data. ' : data.message ? `${data.message} ` : ''}
                Ask an administrator to reset your face registration, then come back here to register again.
              </p>
            </div>
          </div>
          <div className="flex justify-end border-t border-border-subtle pt-4">
            <Button variant="outline" onClick={() => navigate('/student')}>
              Back to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <StudentSidebar>
      <div className="mx-auto max-w-3xl space-y-5 py-2">
        <div className="page-header mb-0">
          <div>
            <h1 className="text-page-title text-text-primary">Face registration</h1>
            <p className="mt-1 text-body text-text-muted">Register your face once to check in to your classes with the camera.</p>
          </div>
        </div>
        {body}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your face data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your face template. You won't be able to check in with your face, and an administrator will
              have to reset your registration before you can register again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <FaceMessage tone="error">{deleteError}</FaceMessage>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void deleteFace()} disabled={deleting}>
              {deleting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              ) : (
                <Delete20Regular aria-hidden />
              )}
              {deleting ? 'Deleting…' : 'Delete face data'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StudentSidebar>
  );
};

export default StudentFaceRegistrationPage;
