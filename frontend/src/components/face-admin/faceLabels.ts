import type { FaceEnrollmentStatusValue, FacePolicySettings } from '@/integrations/api/client';

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                             */
/* -------------------------------------------------------------------------- */

/** `spoof_suspected` → "Spoof suspected". */
export const humanizeCode = (code?: string | null): string => {
  if (!code) return '';
  const text = code.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export type FaceTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

export const TONE_BADGE_VARIANT: Record<FaceTone, 'success' | 'destructive' | 'warning' | 'info' | 'outline'> = {
  success: 'success',
  error: 'destructive',
  warning: 'warning',
  info: 'info',
  neutral: 'outline',
};

export const TONE_DOT_CLASS: Record<FaceTone, string> = {
  success: 'bg-status-success',
  error: 'bg-status-error',
  warning: 'bg-status-warning',
  info: 'bg-status-info',
  neutral: 'bg-text-muted',
};

/** Local "HH:MM" for an ISO datetime, or the leading "HH:MM" of an "HH:MM[:SS]" string. */
export const formatClock = (value?: string | null, withSeconds = false): string => {
  if (!value) return '';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, withSeconds ? 8 : 5);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
};

/** Local date and time for an ISO datetime ("18 Oct 2026, 09:42"). */
export const formatStamp = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* -------------------------------------------------------------------------- */
/* Check-in attempt outcomes (docs/system/face-verification.md §7)             */
/* -------------------------------------------------------------------------- */

const OUTCOME_META: Record<string, { label: string; tone: FaceTone }> = {
  success: { label: 'Checked in', tone: 'success' },
  face_mismatch: { label: "Face didn't match", tone: 'error' },
  spoof_suspected: { label: 'Possible photo/screen', tone: 'error' },
  liveness_failed: { label: 'Head-turn not detected', tone: 'error' },
  presence_code_invalid: { label: 'Wrong code', tone: 'error' },
  challenge_invalid: { label: 'Expired challenge', tone: 'error' },
  too_many_attempts: { label: 'Locked out', tone: 'warning' },
  low_quality: { label: 'Low image quality', tone: 'warning' },
  no_face_detected: { label: 'No face detected', tone: 'warning' },
  multiple_faces: { label: 'Multiple faces', tone: 'warning' },
  invalid_frames: { label: 'Incomplete capture', tone: 'warning' },
  presence_code_required: { label: 'Code missing', tone: 'warning' },
  challenge_required: { label: 'Challenge missing', tone: 'warning' },
  liveness_unavailable: { label: 'Liveness check unavailable', tone: 'warning' },
  already_recorded: { label: 'Already recorded', tone: 'info' },
  window_closed: { label: 'Window closed', tone: 'info' },
  not_enrolled: { label: 'Not enrolled', tone: 'info' },
  session_cancelled: { label: 'Session cancelled', tone: 'info' },
  no_session_today: { label: 'No session today', tone: 'info' },
  between_terms: { label: 'Between terms', tone: 'info' },
  no_registered_face: { label: 'No registered face', tone: 'info' },
};

export const outcomeLabel = (outcome: string): string => OUTCOME_META[outcome]?.label ?? humanizeCode(outcome);

export const outcomeTone = (outcome: string, countsAsFailure?: boolean): FaceTone =>
  OUTCOME_META[outcome]?.tone ?? (countsAsFailure ? 'error' : 'neutral');

/* -------------------------------------------------------------------------- */
/* Enrolment status (§8)                                                       */
/* -------------------------------------------------------------------------- */

export type FaceStatusKey = FaceEnrollmentStatusValue;

export const FACE_STATUS_META: Record<FaceStatusKey, { label: string; tone: FaceTone; description: string }> = {
  enrolled: {
    label: 'Registered',
    tone: 'success',
    description: 'Face check-in is available for this student.',
  },
  none: {
    label: 'Not registered',
    tone: 'neutral',
    description: "This student hasn't registered a face yet. They can enrol from the student portal.",
  },
  reset: {
    label: 'Reset — awaiting re-enrolment',
    tone: 'warning',
    description: 'An administrator reset the face registration. The student can register again from the student portal.',
  },
  deleted: {
    label: 'Deleted by student',
    tone: 'error',
    description:
      "The student deleted their face data. They can't register again until an administrator resets the registration.",
  },
};

/** Effective status: the server's `face_enrollment_status`, falling back to `face_registered`. */
export const resolveFaceStatus = (status?: string | null, registered?: boolean | null): FaceStatusKey => {
  if (status === 'enrolled' || status === 'none' || status === 'reset' || status === 'deleted') return status;
  return registered ? 'enrolled' : 'none';
};

/* -------------------------------------------------------------------------- */
/* Enrolment events                                                            */
/* -------------------------------------------------------------------------- */

const EVENT_META: Record<string, { label: string; tone: FaceTone }> = {
  enrolled: { label: 'Enrolled', tone: 'success' },
  reset: { label: 'Reset by administrator', tone: 'warning' },
  deleted: { label: 'Deleted by student', tone: 'error' },
  duplicate_blocked: { label: 'Blocked: matches another student', tone: 'error' },
  spoof_blocked: { label: 'Blocked: possible photo/screen', tone: 'error' },
};

export const eventLabel = (action: string): string => EVENT_META[action]?.label ?? humanizeCode(action);
export const eventTone = (action: string): FaceTone => EVENT_META[action]?.tone ?? 'neutral';

/** Primitive `details` entries as "Key: value" lines for staff (nested values are skipped). */
export const describeDetails = (details?: Record<string, unknown> | null, limit = 4): string[] => {
  if (!details || typeof details !== 'object') return [];
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && ['string', 'number', 'boolean'].includes(typeof v))
    .slice(0, limit)
    .map(([k, v]) => {
      const value = typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : String(v);
      return `${humanizeCode(k)}: ${value}`;
    });
};

/* -------------------------------------------------------------------------- */
/* Policy defaults (docs/system/face-verification.md §4)                       */
/* -------------------------------------------------------------------------- */

/** Shown when a key is missing from the stored `face_verification` setting. */
export const FACE_POLICY_DEFAULTS: FacePolicySettings = {
  match_threshold: 0.45,
  consistency_threshold: 0.3,
  duplicate_threshold: 0.45,
  require_liveness: true,
  antispoof_threshold: 0.7,
  require_head_turn: true,
  head_turn_min_yaw: 0.18,
  max_turn_yaw: 1.0,
  frontal_max_yaw: 0.12,
  challenge_ttl_seconds: 90,
  frames_min: 3,
  frames_max: 8,
  require_presence_code: true,
  presence_code_period_seconds: 30,
  max_failed_attempts: 5,
  failed_attempt_window_minutes: 10,
  min_detection_score: 0.6,
  enrolment_min_detection_score: 0.7,
  min_face_size_px: 80,
  min_sharpness: 20,
  min_brightness: 40,
  max_brightness: 220,
  enrolment_min_images: 3,
};
