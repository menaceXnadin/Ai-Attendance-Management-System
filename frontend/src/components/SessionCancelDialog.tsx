import React, { useEffect, useState } from 'react';
import { ArrowUndo20Regular, CalendarCancel20Regular, Info16Regular } from '@fluentui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export type SessionCancelMode = 'cancel' | 'uncancel';

interface SessionCancelDialogProps {
  open: boolean;
  mode: SessionCancelMode;
  /** e.g. "Data Structures · 09:00–10:00, Mon Oct 13" */
  sessionLabel: string;
  busy?: boolean;
  /** Show the "notify students" switch (cancel mode only). */
  allowNotify?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { reason: string; notifyStudents: boolean }) => void;
}

/** Cancel / restore a class session. A reason is always required (audited server-side). */
const SessionCancelDialog: React.FC<SessionCancelDialogProps> = ({
  open,
  mode,
  sessionLabel,
  busy = false,
  allowNotify = true,
  onOpenChange,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setNotifyStudents(true);
      setTouched(false);
    }
  }, [open, mode]);

  const isCancel = mode === 'cancel';
  const trimmed = reason.trim();
  const showError = touched && !trimmed;

  const submit = () => {
    setTouched(true);
    if (!trimmed) return;
    onConfirm({ reason: trimmed, notifyStudents });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-section-title text-text-primary">
            {isCancel ? (
              <CalendarCancel20Regular className="text-status-error" aria-hidden />
            ) : (
              <ArrowUndo20Regular className="text-brand-foreground" aria-hidden />
            )}
            <span>{isCancel ? 'Cancel class session' : 'Restore cancelled class'}</span>
          </DialogTitle>
          <DialogDescription className="text-body text-text-muted">
            <strong className="font-semibold text-text-primary">{sessionLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="session-reason" className="text-body-strong text-text-primary">
              Reason <span className="text-status-error" aria-hidden>*</span>
            </Label>
            <Textarea
              id="session-reason"
              placeholder={isCancel ? 'e.g. Teacher unwell, campus closure…' : 'e.g. Cancelled by mistake; class was held'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              aria-invalid={showError}
              aria-describedby={showError ? 'session-reason-error' : undefined}
            />
            {showError && (
              <p id="session-reason-error" className="text-caption text-status-error">
                A reason is required.
              </p>
            )}
          </div>

          {isCancel && allowNotify && (
            <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-surface-subtle p-3">
              <div>
                <Label htmlFor="session-notify" className="cursor-pointer text-body-strong text-text-primary">
                  Notify enrolled students
                </Label>
                <p className="mt-0.5 text-caption text-text-muted">Send a cancellation notification now</p>
              </div>
              <Switch id="session-notify" checked={notifyStudents} onCheckedChange={setNotifyStudents} />
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info-subtle px-3 py-2 text-body text-text-primary">
            <Info16Regular className="mt-0.5 shrink-0 text-status-info" aria-hidden />
            <p>
              {isCancel
                ? 'Cancelled sessions are excluded from attendance percentages. Existing records are kept and return if the class is restored.'
                : 'The session returns to its previous state. Any records taken before cancellation count again.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {isCancel ? 'Keep class' : 'Close'}
          </Button>
          <Button variant={isCancel ? 'destructive' : 'default'} onClick={submit} disabled={busy}>
            {busy ? (isCancel ? 'Cancelling…' : 'Restoring…') : isCancel ? 'Cancel class' : 'Restore class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionCancelDialog;
