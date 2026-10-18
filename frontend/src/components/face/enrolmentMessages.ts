/**
 * Friendly messages for face enrolment errors (docs/system/face-verification.md §8).
 * The server returns `{"detail": {code, message, details}}`; read it with `parseApiError`.
 */
import { getErrorDetailField, type ApiErrorInfo } from '@/integrations/api/client';
import { FACE_QUALITY_HINTS } from '@/utils/timeRestrictions';

export type EnrolPose = 'front' | 'left' | 'right';

export const POSE_LABEL: Record<EnrolPose, string> = {
  front: 'looking straight',
  left: 'turned to your left',
  right: 'turned to your right',
};

const MESSAGES: Record<string, string> = {
  already_enrolled: 'Your face is already registered.',
  enrolment_locked:
    'Face registration is locked because you deleted your face data. Ask an administrator to reset your face registration.',
  consent_required: 'Please confirm that you agree to storing your face template.',
  challenge_required: 'Your registration attempt expired. Please start the capture again.',
  challenge_invalid: 'Your registration attempt expired or was already used. Please start the capture again.',
  invalid_frames: "We didn't get the right number of photos. Please start the capture again.",
  low_quality: "Some photos weren't clear enough.",
  pose_coverage: 'We need one photo looking straight, one turned left and one turned right.',
  spoof_suspected: "We couldn't verify a live face. Make sure you're in good light and not using a photo or screen.",
  liveness_unavailable: 'Face verification is temporarily unavailable; contact your administrator.',
  duplicate_face: 'This face is already registered to another account. Contact an administrator.',
};

/** Codes where capturing again can help. */
const RETRYABLE = new Set([
  'challenge_required',
  'challenge_invalid',
  'invalid_frames',
  'low_quality',
  'pose_coverage',
  'spoof_suspected',
]);

export interface EnrolmentErrorView {
  code: string | null;
  title: string;
  message: string;
  /** Per-photo problems (low_quality) or missing poses (pose_coverage). */
  details: string[];
  retryable: boolean;
  /** Go back to the consent step. */
  needsConsent: boolean;
  /** The page should re-read the enrolment state (enrolled / locked). */
  refreshState: boolean;
}

interface ImageResult {
  index?: number;
  valid?: boolean;
  pose?: string | null;
  issues?: unknown;
  message?: unknown;
}

export const describeEnrolmentError = (info: ApiErrorInfo, sentPoses: EnrolPose[] = []): EnrolmentErrorView => {
  const code = info.code ?? null;
  const details: string[] = [];

  if (code === 'low_quality') {
    const results = getErrorDetailField<ImageResult[]>(info, 'image_results');
    if (Array.isArray(results)) {
      results.forEach((r, i) => {
        if (r?.valid) return;
        const idx = typeof r?.index === 'number' ? r.index : i;
        const pose = sentPoses[idx];
        const label = `Photo ${idx + 1}${pose ? ` (${POSE_LABEL[pose]})` : ''}`;
        const issues = Array.isArray(r?.issues) ? (r.issues as string[]) : [];
        const text =
          typeof r?.message === 'string' && r.message
            ? r.message
            : issues.map((c) => FACE_QUALITY_HINTS[c]).filter(Boolean).join(' ');
        if (text) details.push(`${label}: ${text}`);
      });
    }
  }
  if (code === 'pose_coverage') {
    const missing = getErrorDetailField<string[]>(info, 'missing_poses');
    const poseIssues = getErrorDetailField<Record<string, string[]>>(info, 'pose_issues') ?? {};
    if (Array.isArray(missing) && missing.length > 0) {
      missing.forEach((p) => {
        const label = POSE_LABEL[p as EnrolPose] ?? p;
        const issues = Array.isArray(poseIssues[p]) ? poseIssues[p] : [];
        const why = issues.includes('turned_too_far')
          ? FACE_QUALITY_HINTS.turned_too_far
          : issues.map((c) => FACE_QUALITY_HINTS[c]).filter(Boolean).join(' ');
        details.push(`Missing: a photo ${label}.${why ? ` ${why}` : ''}`);
      });
    }
  }

  const known = code ? MESSAGES[code] : undefined;
  const message =
    code === 'duplicate_face'
      ? info.message || MESSAGES.duplicate_face
      : known ?? (info.message && info.message !== 'Request failed' ? info.message : "Couldn't register your face. Please try again.");

  return {
    code,
    title: code === 'already_enrolled' ? 'Already registered' : code === 'enrolment_locked' ? 'Registration locked' : "Your face wasn't registered",
    message,
    details,
    retryable: !code || RETRYABLE.has(code),
    needsConsent: code === 'consent_required',
    refreshState: code === 'already_enrolled' || code === 'enrolment_locked',
  };
};
