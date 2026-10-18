import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarCancel20Regular, CalendarCheckmark20Regular, CheckmarkCircle20Regular, ErrorCircle16Regular } from '@fluentui/react-icons';
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
import { api, parseApiError, type ClassSessionInfo } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import { MessageBar, formatDateLabel, formatTimeRange } from './shared';

export interface SessionStatusDialogProps {
  /** `keep` clears a calendar-change review flag and keeps the session's status (admin). */
  mode: 'cancel' | 'uncancel' | 'keep';
  session: Pick<ClassSessionInfo, 'id' | 'start_time' | 'end_time'> &
    Partial<Pick<ClassSessionInfo, 'session_date' | 'subject_name' | 'subject_code' | 'recorded_count'>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

/**
 * Cancel ("not held"), restore, or keep (clear a review flag on) a class session with a
 * reason (`POST /attendance/sessions/{id}/cancel|uncancel|clear-review`). Existing records are
 * kept; a cancelled session is simply excluded from all metrics.
 */
const SessionStatusDialog: React.FC<SessionStatusDialogProps> = ({ mode, session, open, onOpenChange, onDone }) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isCancel = mode === 'cancel';
  const isKeep = mode === 'keep';

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open, session.id]);

  const mutation = useMutation({
    mutationFn: (): Promise<unknown> =>
      isKeep
        ? api.sessions.clearReview(session.id, reason.trim())
        : isCancel
          ? api.sessions.cancel(session.id, reason.trim())
          : api.sessions.uncancel(session.id, reason.trim()),
    onSuccess: () => {
      toast({
        title: isKeep ? 'Review cleared' : isCancel ? 'Session marked as not held' : 'Session restored',
        description: isKeep
          ? 'The session keeps its status and counts in attendance metrics.'
          : isCancel
            ? 'It is excluded from attendance metrics. Existing records were kept.'
            : 'Attendance can be recorded for this session again.',
      });
      onOpenChange(false);
      onDone?.();
    },
    onError: (err) => setError(parseApiError(err).message),
  });

  const submit = () => {
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  const label = [session.subject_name, session.subject_code ? `(${session.subject_code})` : null]
    .filter(Boolean)
    .join(' ');
  const when = [formatDateLabel(session.session_date), formatTimeRange(session.start_time, session.end_time)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-section-title">
            {isKeep ? (
              <CheckmarkCircle20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            ) : isCancel ? (
              <CalendarCancel20Regular className="shrink-0 text-status-error" aria-hidden />
            ) : (
              <CalendarCheckmark20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            )}
            {isKeep ? 'Keep session as recorded' : isCancel ? 'Mark session as not held' : 'Restore session'}
          </DialogTitle>
          <DialogDescription className="text-body text-text-muted">
            {label || 'Class session'}
            {when ? ` · ${when}` : ''}
          </DialogDescription>
        </DialogHeader>

        <MessageBar tone={isCancel ? 'warning' : 'info'} icon={<ErrorCircle16Regular />}>
          {isKeep
            ? 'A calendar change (holiday, exam or cancellation) covers this session, but attendance was already recorded. Keeping it confirms the class took place; it stays in attendance metrics.'
            : isCancel
              ? 'The session is cancelled and excluded from every percentage. Any records already taken are kept (not deleted) and count again if the session is restored.'
              : 'The session returns to its previous state: held if it has real attendance records, otherwise not recorded.'}
          {isCancel && typeof session.recorded_count === 'number' && session.recorded_count > 0 ? (
            <span className="mt-1 block font-semibold">
              {session.recorded_count} record{session.recorded_count === 1 ? '' : 's'} already exist for this session.
            </span>
          ) : null}
        </MessageBar>

        <div className="flex flex-col gap-1">
          <label htmlFor="session-status-reason" className="text-body-strong text-text-primary">
            Reason <span className="text-status-error">*</span>
          </label>
          <Textarea
            id="session-status-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isKeep
                ? 'e.g. Class took place before the closure was announced'
                : isCancel
                  ? 'e.g. Teacher on leave, class did not take place'
                  : 'e.g. Cancelled by mistake'
            }
          />
        </div>

        {error && (
          <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
            {error}
          </MessageBar>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Back
          </Button>
          <Button variant={isCancel && !isKeep ? 'destructive' : 'default'} onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : isKeep ? 'Keep session' : isCancel ? 'Mark not held' : 'Restore session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionStatusDialog;
