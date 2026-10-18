import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ConfirmHeldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Server message from the 409 `confirm_held` response. */
  message?: string;
  /** `students_without_record` from the 409 response. */
  studentsWithoutRecord?: number | null;
  /** Number of sessions involved (student view saves several at once). */
  sessionCount?: number;
}

/**
 * Confirmation for 409 `confirm_held` (DOMAIN_RULES §13.3): the session ended
 * without anyone recording attendance, so writing a record now declares it held.
 */
const ConfirmHeldDialog: React.FC<ConfirmHeldDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  message,
  studentsWithoutRecord,
  sessionCount = 1,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-section-title">
          {sessionCount > 1 ? `Confirm ${sessionCount} classes were held?` : 'Confirm this class was held?'}
        </AlertDialogTitle>
        <AlertDialogDescription className="space-y-2 text-body text-text-secondary">
          <span className="block">
            {sessionCount > 1 ? 'These sessions ended' : 'This session ended'} without attendance being recorded.
            Saving now marks {sessionCount > 1 ? 'them' : 'it'} as <strong className="font-semibold text-text-primary">held</strong>.
          </span>
          {typeof studentsWithoutRecord === 'number' && studentsWithoutRecord > 0 ? (
            <span className="block">
              <strong className="font-semibold text-text-primary">{studentsWithoutRecord}</strong> student
              {studentsWithoutRecord === 1 ? '' : 's'} without a record will then be marked absent automatically.
            </span>
          ) : null}
          {message ? <span className="block text-caption text-text-muted">{message}</span> : null}
          <span className="block text-caption text-text-muted">
            If the class did not take place, cancel instead and mark the session as not held.
          </span>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Go back</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Yes, it was held</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmHeldDialog;
