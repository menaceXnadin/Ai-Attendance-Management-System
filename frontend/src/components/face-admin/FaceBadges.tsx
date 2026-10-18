import React from 'react';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  FACE_STATUS_META,
  TONE_BADGE_VARIANT,
  TONE_DOT_CLASS,
  outcomeLabel,
  outcomeTone,
  resolveFaceStatus,
  type FaceTone,
} from './faceLabels';

/** Pill for a face check-in attempt outcome (`success`, `face_mismatch`, ...). */
export const OutcomeBadge: React.FC<{ outcome: string; countsAsFailure?: boolean; className?: string }> = ({
  outcome,
  countsAsFailure,
  className,
}) => (
  <Badge variant={TONE_BADGE_VARIANT[outcomeTone(outcome, countsAsFailure)]} shape="pill" className={className}>
    {outcomeLabel(outcome)}
  </Badge>
);

/** Face enrolment status pill (Registered / Not registered / Reset / Deleted by student). */
export const FaceStatusBadge: React.FC<{
  status?: string | null;
  registered?: boolean | null;
  className?: string;
}> = ({ status, registered, className }) => {
  const meta = FACE_STATUS_META[resolveFaceStatus(status, registered)];
  return (
    <Badge variant={TONE_BADGE_VARIANT[meta.tone]} shape="pill" className={className} title={meta.description}>
      {meta.label}
    </Badge>
  );
};

/** The face status pill as a button (opens the student's face registration). */
export const FaceStatusButton: React.FC<{
  status?: string | null;
  registered?: boolean | null;
  studentName: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ status, registered, studentName, onClick, disabled }) => {
  const meta = FACE_STATUS_META[resolveFaceStatus(status, registered)];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={meta.description}
      aria-label={`Face registration for ${studentName}: ${meta.label}`}
      className={cn(
        badgeVariants({ variant: TONE_BADGE_VARIANT[meta.tone], shape: 'pill' }),
        'cursor-pointer underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline'
      )}
    >
      {meta.label}
    </button>
  );
};

export const ToneDot: React.FC<{ tone: FaceTone; className?: string }> = ({ tone, className }) => (
  <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${TONE_DOT_CLASS[tone]} ${className ?? ''}`} />
);
