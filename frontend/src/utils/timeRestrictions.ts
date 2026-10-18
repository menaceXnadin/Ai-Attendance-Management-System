/**
 * Student check-in availability — display only.
 *
 * The server is authoritative (DOMAIN_RULES §13.9): `GET /schedules/student/today`
 * returns each class's `checkin_window` (`opens_at`, `late_after`, `closes_at`,
 * `state`), the session status and the student's own record (`my_status`), plus
 * `term_state` / `day_status`. This module only interprets that payload for the UI.
 *
 * Fail closed: no schedule, a failed request, a holiday, between-terms or a class
 * without a server window all mean "check-in closed" with a clear reason. There are
 * no hard-coded fallback periods, and no client override can open check-in.
 */
import type {
  CheckinRejectionCode,
  RecordStatus,
  StudentTodayClass,
  StudentTodaySchedule,
} from '@/integrations/api/client';

export interface ClassPeriod {
  id: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  subjectId?: number;
  sessionId?: number | null;
}

export interface CheckinAvailability {
  allowed: boolean;
  reason: string;
  /** The class whose window is open right now (if any). */
  currentPeriod: ClassPeriod | null;
  /** The next class whose window has not opened yet. */
  nextPeriod?: ClassPeriod;
  /** Human countdown to `nextPeriod` opening, e.g. "1h 5m". */
  timeUntilNext?: string;
  /** The open class itself (when `allowed`). */
  openClass?: StudentTodayClass;
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

/** Parses a server ISO date-time; returns null if missing/invalid. */
export const parseServerTime = (iso?: string | null): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "9:50 AM" from a server ISO date-time or an HH:MM[:SS] string. */
export const formatClock = (value?: string | null): string => {
  if (!value) return '';
  const iso = /T\d{2}:\d{2}/.test(value);
  const timePart = iso ? value.split('T')[1] : value;
  const [h, m] = timePart.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

/** Backward-compatible alias (HH:MM → 12h). */
export const formatTimeForDisplay = (timeStr: string): string => formatClock(timeStr);

const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const toPeriod = (c: StudentTodayClass): ClassPeriod => ({
  id: c.session_id ? `session-${c.session_id}` : `schedule-${c.id}-${c.start_time}`,
  name: c.subject_name,
  startTime: hhmm(c.start_time),
  endTime: hhmm(c.end_time),
  subjectId: c.subject_id,
  sessionId: c.session_id ?? null,
});

export const isClassCancelled = (c: StudentTodayClass): boolean =>
  c.session_status === 'cancelled' || !!c.is_cancelled;

/** The student's own record for the class, as reported by the server (`undefined` = server did not say). */
export const myStatusOf = (c: StudentTodayClass): RecordStatus | null | undefined =>
  'my_status' in c ? (c.my_status ?? null) : undefined;

const DAY_STATUS_REASON: Record<string, string> = {
  holiday: 'Today is a holiday — there are no classes, so check-in is closed.',
  weekly_off: 'Today is a weekly day off — check-in is closed.',
  exam: 'Regular classes are suspended for exams today — check-in is closed.',
  between_terms: 'The institution is between terms — check-in is closed.',
};

/**
 * Decides whether the check-in button may be offered, from the server payload only.
 * `now` is used for countdown text, never to open a window the server marked closed.
 */
export const evaluateCheckin = (
  schedule: StudentTodaySchedule | null | undefined,
  opts: { loading?: boolean; loadFailed?: boolean; now?: number } = {}
): CheckinAvailability => {
  const now = opts.now ?? Date.now();
  if (opts.loadFailed) {
    return {
      allowed: false,
      reason: "Couldn't load today's schedule from the server. Check-in stays closed until it loads.",
      currentPeriod: null,
    };
  }
  if (!schedule) {
    return { allowed: false, reason: opts.loading ? "Loading today's schedule…" : 'Check-in is closed.', currentPeriod: null };
  }
  if (schedule.term_state === 'between_terms') {
    return { allowed: false, reason: DAY_STATUS_REASON.between_terms, currentPeriod: null };
  }
  if (schedule.term_state === 'no_terms') {
    return { allowed: false, reason: 'No academic term is configured — check-in is closed.', currentPeriod: null };
  }
  if (schedule.day_status && schedule.day_status !== 'instructional' && DAY_STATUS_REASON[schedule.day_status]) {
    return { allowed: false, reason: DAY_STATUS_REASON[schedule.day_status], currentPeriod: null };
  }
  const classes = schedule.classes ?? [];
  if (classes.length === 0) {
    return { allowed: false, reason: 'No classes are scheduled for you today — check-in is closed.', currentPeriod: null };
  }

  const live = classes.filter((c) => !isClassCancelled(c));
  const openClasses = live.filter((c) => c.checkin_window?.state === 'open');
  // Prefer the server's own `checkin_allowed` flag; otherwise "open window + no record yet".
  const openUnrecorded =
    live.find((c) => c.checkin_allowed === true) ??
    openClasses.find((c) => c.checkin_allowed !== false && !myStatusOf(c));
  if (openUnrecorded) {
    const closes = formatClock(openUnrecorded.checkin_window?.closes_at);
    const lateAfter = parseServerTime(openUnrecorded.checkin_window?.late_after);
    const lateNote = lateAfter && lateAfter.getTime() <= now ? ' You will be marked late.' : '';
    return {
      allowed: true,
      reason: `Check-in is open for ${openUnrecorded.subject_name}${closes ? ` until ${closes}` : ''}.${lateNote}`,
      currentPeriod: toPeriod(openUnrecorded),
      openClass: openUnrecorded,
    };
  }

  const upcoming = live
    .filter((c) => c.checkin_window?.state === 'not_open')
    .sort((a, b) => (a.checkin_window?.opens_at ?? '').localeCompare(b.checkin_window?.opens_at ?? ''));
  const next = upcoming[0];
  const nextOpens = parseServerTime(next?.checkin_window?.opens_at);
  const timeUntilNext = nextOpens ? formatDuration(nextOpens.getTime() - now) : undefined;

  if (openClasses.length > 0) {
    const recorded = openClasses[0];
    const status = myStatusOf(recorded);
    return {
      allowed: false,
      reason: `Your attendance for ${recorded.subject_name} is already recorded${status ? ` as ${status}` : ''}.`,
      currentPeriod: toPeriod(recorded),
      nextPeriod: next ? toPeriod(next) : undefined,
      timeUntilNext,
    };
  }

  if (next) {
    const opens = formatClock(next.checkin_window?.opens_at);
    return {
      allowed: false,
      reason: `Check-in for ${next.subject_name} opens${opens ? ` at ${opens}` : ' shortly'}.`,
      currentPeriod: null,
      nextPeriod: toPeriod(next),
      timeUntilNext,
    };
  }

  if (live.length > 0 && live.every((c) => !c.checkin_window)) {
    return {
      allowed: false,
      reason: 'The server did not report a check-in window for your classes — check-in is closed.',
      currentPeriod: null,
    };
  }

  return {
    allowed: false,
    reason: live.length === 0 ? "All of today's classes are cancelled." : "Check-in windows for today's classes are closed.",
    currentPeriod: null,
  };
};

/** Human countdown until a window closes, from the server `closes_at`. */
export const getTimeRemainingInWindow = (closesAt?: string | null, now: number = Date.now()): string => {
  const closes = parseServerTime(closesAt);
  if (!closes) return '';
  const ms = closes.getTime() - now;
  return ms <= 0 ? 'Window closed' : `${formatDuration(ms)} left to check in`;
};

/** Friendly text for every face check-in rejection (docs/system/face-verification.md §7). */
const REJECTION_MESSAGES: Record<CheckinRejectionCode, string> = {
  already_recorded: 'Your attendance for this class is already recorded.',
  window_closed: 'The check-in window for this class is closed.',
  not_enrolled: "You're not enrolled in this class, so you can't check in.",
  session_cancelled: 'This class has been cancelled — no check-in needed.',
  no_session_today: 'There is no class session to check in to right now.',
  between_terms: 'The institution is between terms — check-in is closed.',
  face_mismatch: "We couldn't match your face to your registered profile. Face the camera in good light and try again.",
  no_face_detected: "We couldn't see a face. Centre your face in the oval and try again.",
  subject_not_found: "This class couldn't be found. Refresh the page and try again.",
  too_many_attempts: 'Too many unsuccessful attempts. Face check-in is paused for a few minutes.',
  no_registered_face: "You haven't registered your face yet. Register it first, then check in.",
  presence_code_required: 'Enter the 6-digit check-in code shown in class.',
  presence_code_invalid:
    "That check-in code didn't work. The code changes regularly — enter the one currently shown in class.",
  challenge_required: 'Your check-in attempt expired. Please try again.',
  challenge_invalid: 'Your check-in attempt expired or was already used. Please try again.',
  invalid_frames: "The camera didn't capture the right photos. Please try again.",
  multiple_faces: 'More than one face was in view. Make sure only you are in the frame.',
  low_quality: "The photos weren't clear enough to check you in.",
  liveness_failed: "We didn't see your head turn. When the arrow appears, turn your head that way.",
  turned_too_far: 'You turned your head too far. Turn it about halfway (not to the side profile) and try again.',
  spoof_suspected: "We couldn't verify a live face. Make sure you're in good light and not using a photo or screen.",
  liveness_unavailable: 'Face check-in is temporarily unavailable. Please tell your teacher or an administrator.',
};

/** Friendly text for a server check-in rejection (`code` from mark-attendance). */
export const checkinRejectionMessage = (
  code?: string | null,
  serverMessage?: string | null,
  currentStatus?: RecordStatus | null
): string => {
  if (code === 'already_recorded' && currentStatus) {
    return `Your attendance for this class is already recorded as ${currentStatus}.`;
  }
  if (code && code in REJECTION_MESSAGES) return REJECTION_MESSAGES[code as CheckinRejectionCode];
  return serverMessage || 'Attendance could not be recorded.';
};

/** Rejections the student can fix by simply trying again (a new challenge is fetched). */
const RETRYABLE_CHECKIN_CODES: ReadonlySet<string> = new Set([
  'face_mismatch',
  'no_face_detected',
  'multiple_faces',
  'low_quality',
  'liveness_failed',
  'turned_too_far',
  'spoof_suspected',
  'challenge_required',
  'challenge_invalid',
  'invalid_frames',
  'presence_code_required',
  'presence_code_invalid',
]);

export const isRetryableCheckinCode = (code?: string | null): boolean => !!code && RETRYABLE_CHECKIN_CODES.has(code);

/**
 * Actionable hints for per-frame quality problems (check-in `quality_issues`, enrolment
 * `image_results[].issues`). Unknown codes are skipped.
 */
export const FACE_QUALITY_HINTS: Record<string, string> = {
  too_dark: 'Move to a brighter spot or face a light source.',
  too_bright: 'Move out of direct light so your face isn’t washed out.',
  too_blurry: 'Hold still while the photos are taken.',
  too_small: 'Move closer to the camera.',
  low_confidence: 'Face the camera with your whole face visible (no sunglasses, mask or hat).',
  not_frontal: 'Face the camera directly for the first photos.',
  no_face: 'Keep your face inside the oval.',
  invalid_image: "A photo couldn't be read. Please try again.",
  multiple_faces: 'Make sure only your face is in view.',
  turned_too_far: 'You turned too far. Turn your head about halfway, not all the way to the side.',
};

export const faceQualityHints = (issues?: readonly string[] | null): string[] => {
  const seen = new Set<string>();
  const hints: string[] = [];
  for (const issue of issues ?? []) {
    const hint = FACE_QUALITY_HINTS[issue];
    if (hint && !seen.has(hint)) {
      seen.add(hint);
      hints.push(hint);
    }
  }
  return hints;
};

/** "4:05" / "45 s" countdown text. */
export const formatRetryCountdown = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
