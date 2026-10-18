import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowReset20Regular,
  ErrorCircle16Regular,
  History16Regular,
  ScanPerson20Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageBar } from '@/components/attendance-admin/shared';
import { api, parseApiError, type StudentFaceInfo } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import { FaceStatusBadge, ToneDot } from './FaceBadges';
import {
  FACE_STATUS_META,
  describeDetails,
  eventLabel,
  eventTone,
  formatStamp,
  humanizeCode,
  resolveFaceStatus,
} from './faceLabels';

const MIN_REASON = 3;

export interface StudentFaceDialogStudent {
  id: string | number;
  name: string;
  studentId?: string | null;
}

export interface StudentFaceDialogProps {
  student: StudentFaceDialogStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful reset (refresh the list). */
  onChanged?: () => void;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-caption text-text-muted">{label}</dt>
    <dd className="mt-0.5 text-body text-text-primary">{children}</dd>
  </div>
);

const PoseChips: React.FC<{ poses: string[] }> = ({ poses }) => {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    poses.forEach((p) => map.set(p, (map.get(p) ?? 0) + 1));
    const order = ['front', 'left', 'right'];
    return Array.from(map.entries()).sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [poses]);
  if (counts.length === 0) return <span className="text-text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {counts.map(([pose, n]) => (
        <span
          key={pose}
          className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-subtle px-2 py-px text-caption text-text-secondary"
        >
          {humanizeCode(pose)}
          <span className="font-semibold tabular-nums text-text-primary">×{n}</span>
        </span>
      ))}
    </span>
  );
};

const FaceDetails: React.FC<{
  student: StudentFaceDialogStudent;
  onChanged?: () => void;
}> = ({ student, onChanged }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'idle' | 'reason' | 'confirm'>('idle');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['student-face', String(student.id)],
    queryFn: () => api.students.getFace(student.id),
    staleTime: 0,
  });

  useEffect(() => {
    setStep('idle');
    setReason('');
    setReasonError(null);
    setResetError(null);
  }, [student.id]);

  const mutation = useMutation({
    mutationFn: () => api.students.resetFace(student.id, reason.trim()),
    onSuccess: (res) => {
      toast({
        title: 'Face registration reset',
        description: res?.message || `${student.name} can register their face again from the student portal.`,
      });
      setStep('idle');
      setReason('');
      setResetError(null);
      void queryClient.invalidateQueries({ queryKey: ['student-face', String(student.id)] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      onChanged?.();
    },
    onError: (err) => {
      setResetError(parseApiError(err).message);
      setStep('reason');
    },
  });

  const info: StudentFaceInfo | undefined = query.data;
  const status = resolveFaceStatus(info?.status, (info?.template_count ?? 0) > 0);
  const canReset = !!info && (status === 'enrolled' || status === 'deleted' || info.template_count > 0);
  const events = useMemo(
    () =>
      [...(info?.events ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [info]
  );

  const continueToConfirm = () => {
    if (reason.trim().length < MIN_REASON) {
      setReasonError(`Enter a reason of at least ${MIN_REASON} characters.`);
      return;
    }
    setReasonError(null);
    setResetError(null);
    setStep('confirm');
  };

  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading face registration">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (query.isError || !info) {
    return (
      <MessageBar
        tone="error"
        role="alert"
        icon={<ErrorCircle16Regular />}
        actions={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
      >
        Couldn't load the face registration. {query.isError ? parseApiError(query.error).message : ''}
      </MessageBar>
    );
  }

  return (
    <div className="space-y-5">
      {/* Status */}
      <section aria-labelledby="face-status-heading" className="space-y-3">
        <h3 id="face-status-heading" className="sr-only">
          Status
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <FaceStatusBadge status={info.status} registered={info.template_count > 0} />
        </div>
        <p className="text-body text-text-secondary">{FACE_STATUS_META[status].description}</p>
        <dl className="grid grid-cols-1 gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3 sm:grid-cols-2">
          <Field label="Registered">{info.registered_at ? formatStamp(info.registered_at) : '—'}</Field>
          <Field label="Consent given">{info.consent_at ? formatStamp(info.consent_at) : '—'}</Field>
          <Field label="Templates">
            <span className="tabular-nums">{info.template_count}</span>
          </Field>
          <Field label="Poses">
            <PoseChips poses={info.poses ?? []} />
          </Field>
          {info.model && (
            <Field label="Model">
              <span className="font-mono text-caption">{info.model}</span>
            </Field>
          )}
        </dl>
      </section>

      {/* History */}
      <section aria-labelledby="face-history-heading" className="space-y-2">
        <h3 id="face-history-heading" className="flex items-center gap-1.5 text-body-strong text-text-primary">
          <History16Regular className="text-text-muted" aria-hidden />
          History
        </h3>
        {events.length === 0 ? (
          <p className="text-body text-text-muted">No face registration events yet.</p>
        ) : (
          <ol className="max-h-64 divide-y divide-border-subtle overflow-y-auto rounded-md border border-border-subtle">
            {events.map((e) => {
              const lines = describeDetails(e.details);
              return (
                <li key={e.id} className="flex gap-3 px-3 py-2.5">
                  <ToneDot tone={eventTone(e.action)} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-body-strong text-text-primary">{eventLabel(e.action)}</p>
                      <time dateTime={e.created_at} className="text-caption tabular-nums text-text-muted">
                        {formatStamp(e.created_at)}
                      </time>
                    </div>
                    {e.actor_name && <p className="text-caption text-text-muted">By {e.actor_name}</p>}
                    {e.reason && <p className="mt-0.5 text-body text-text-secondary">“{e.reason}”</p>}
                    {lines.length > 0 && (
                      <p className="mt-0.5 font-mono text-caption text-text-muted">{lines.join(' · ')}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Reset */}
      <section aria-labelledby="face-reset-heading" className="space-y-3 border-t border-border-subtle pt-4">
        <h3 id="face-reset-heading" className="text-body-strong text-text-primary">
          Reset face registration
        </h3>

        {step === 'idle' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-text-muted">
              {canReset
                ? 'Deletes the face templates so the student can register again. Attendance records are not affected.'
                : status === 'reset'
                  ? 'Already reset — waiting for the student to register again.'
                  : "Nothing to reset — this student hasn't registered a face."}
            </p>
            <Button variant="destructive" size="sm" disabled={!canReset} onClick={() => setStep('reason')}>
              <ArrowReset20Regular aria-hidden />
              Reset face registration
            </Button>
          </div>
        )}

        {step === 'reason' && (
          <div className="space-y-3">
            <MessageBar tone="warning" icon={<Warning16Regular />}>
              The student's face templates will be deleted. They must register again before they can check in with
              their face. Attendance records are kept.
            </MessageBar>
            <div className="flex flex-col gap-1">
              <label htmlFor="face-reset-reason" className="text-body-strong text-text-primary">
                Reason <span className="text-status-error">*</span>
              </label>
              <Textarea
                id="face-reset-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                placeholder="e.g. Student's appearance changed; poor-quality enrolment; deleted by mistake"
                aria-invalid={!!reasonError}
                aria-describedby="face-reset-reason-hint"
                autoFocus
              />
              <p
                id="face-reset-reason-hint"
                className={reasonError ? 'text-caption text-status-error' : 'text-caption text-text-muted'}
              >
                {reasonError ?? 'Saved in the face registration history.'}
              </p>
            </div>
            {resetError && (
              <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
                {resetError}
              </MessageBar>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setStep('idle')}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={continueToConfirm}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3" role="group" aria-labelledby="face-reset-confirm">
            <MessageBar tone="error" icon={<Warning16Regular />}>
              <span id="face-reset-confirm" className="font-semibold">
                Reset the face registration for {student.name}?
              </span>
              <span className="mt-0.5 block text-text-secondary">Reason: “{reason.trim()}”</span>
            </MessageBar>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => setStep('reason')} disabled={mutation.isPending}>
                Back
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                autoFocus
              >
                <ArrowReset20Regular aria-hidden />
                {mutation.isPending ? 'Resetting…' : 'Reset face registration'}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

/**
 * Admin view of one student's face enrolment (`GET /students/{id}/face`) with the event
 * history and a reason-required reset (`POST /students/{id}/face/reset`), per
 * docs/system/face-verification.md §8.
 */
const StudentFaceDialog: React.FC<StudentFaceDialogProps> = ({ student, open, onOpenChange, onChanged }) => (
  <Dialog open={open && !!student} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-xl flex-col gap-4 overflow-hidden">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ScanPerson20Regular className="shrink-0 text-brand-foreground" aria-hidden />
          Face registration
        </DialogTitle>
        <DialogDescription>
          {student?.name}
          {student?.studentId ? ` · ${student.studentId}` : ''}
        </DialogDescription>
      </DialogHeader>
      <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
        {student && <FaceDetails student={student} onChanged={onChanged} />}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default StudentFaceDialog;
