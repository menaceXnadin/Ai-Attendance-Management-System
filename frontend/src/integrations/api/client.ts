/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Attendance,
  AttendanceFilters,
  AttendanceSummary,
  Student,
  StudentCreateData,
  Subject,
  AuthResponse,
  User,
  RegisterData,
} from './types';
import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/authToken';

// Vite dev server proxies "/api" to FastAPI at http://127.0.0.1:8000
const API_BASE = '/api';

// ============================================================================
// API contract v1 (Phase 4) — shared types. Backend is authoritative for every
// rule (windows, eligibility, bands, percentages); the client only displays.
// ============================================================================

export type TermState = 'active' | 'between_terms' | 'no_terms';
export type TermLifecycleState = 'current' | 'upcoming' | 'past' | 'inactive';
export type SessionStatus = 'scheduled' | 'held' | 'cancelled';
export type SessionKind = 'regular' | 'makeup';
export type RecordStatus = 'present' | 'late' | 'absent' | 'excused';
export type AttendanceSource = 'teacher' | 'admin' | 'student_face' | 'system_auto' | 'legacy';
export type DayStatus = 'instructional' | 'holiday' | 'weekly_off' | 'exam' | 'between_terms';
export type CheckinWindowState = 'not_open' | 'open' | 'closed';
export type RecordOutcome = 'created' | 'updated' | 'unchanged';

export interface TermSummary {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  exam_week_start?: string | null;
  exam_week_end?: string | null;
}

/** A policy band, half-open `[min, max)`; `max` is null for the top band. */
export interface AttendanceBand {
  name: string;
  label: string;
  min: number;
  max: number | null;
  color?: string;
}

/** `GET /system-settings/attendance-policy`. */
export interface AttendancePolicy {
  minimum_percentage: number;
  late_counts_as_attended: boolean;
  checkin_opens_minutes_before: number;
  late_after_minutes: number;
  checkin_closes_after_minutes: number;
  finalize_grace_minutes: number;
  teacher_edit_window_days: number;
  weekly_off_days: string[];
  /** Sorted by `min` descending (best band first). */
  bands: AttendanceBand[];
  term_state: TermState;
  current_term: TermSummary | null;
}

/**
 * Metrics block (DOMAIN_RULES §13.12). New fields are optional so legacy
 * responses still type-check; prefer `percentage`/`has_data` over the legacy
 * numeric fields (which are 0 when there is no data).
 */
export interface MetricsBlock {
  percentage?: number | null;
  has_data?: boolean;
  considered?: number;
  attended?: number;
  present?: number;
  late?: number;
  absent?: number;
  excused?: number;
  unrecorded?: number;
  cancelled_sessions?: number;
  eligible?: boolean | null;
  eligibility_provisional?: boolean;
  band?: string | null;
  band_label?: string | null;
  term?: TermSummary | null;
  term_state?: TermState;
  // legacy numeric fields (never null)
  percentage_present?: number;
  attendance_rate?: number;
  attendance_percentage?: number;
  total_classes?: number;
}

export interface ClassSessionInfo {
  id: number;
  session_date?: string;
  start_time: string;
  end_time: string;
  subject_id?: number;
  subject_name?: string;
  subject_code?: string;
  faculty_id?: number;
  faculty_name?: string;
  semester?: number;
  teacher_id?: number | null;
  teacher_name?: string | null;
  status: SessionStatus;
  kind?: SessionKind;
  cancelled?: boolean;
  cancellation_reason?: string | null;
  submitted_at?: string | null;
  finalized_at?: string | null;
  attendance_taken_at?: string | null;
  review_required?: boolean;
  review_reason?: string | null;
  roster_size?: number;
  recorded_count?: number;
}

export interface UnrecordedSession extends ClassSessionInfo {
  session_date: string;
  age_days: number;
}

export interface UnrecordedSessionsResponse {
  sessions: UnrecordedSession[];
  schedules_without_teacher: number;
  /** True number of matching sessions (the page may hold fewer). */
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface SessionListFilters {
  date?: string;
  faculty_id?: number;
  semester?: number;
  subject_id?: number;
}

export interface RegisterStudent {
  student_id: number;
  student_number: string;
  name: string;
  /** `null` = not marked (never defaulted to absent). */
  status: RecordStatus | null;
  source: AttendanceSource | null;
  record_id: number | null;
  excluded_from_metrics: boolean;
}

export interface SessionRegister {
  session: ClassSessionInfo;
  students: RegisterStudent[];
}

export interface RegisterEntry {
  student_id: number;
  status: RecordStatus;
  reason?: string;
}

export interface RegisterSubmitOptions {
  /** Batch-level reason, applied by the server to entries that need one (§13.8). */
  reason?: string;
  /** Confirms a past, still-`scheduled` session was actually held (§13.3). */
  confirm_held?: boolean;
  /** Explicit teacher/admin absent write for everyone still unmarked (§13.4). */
  mark_remaining_absent?: boolean;
}

export interface RegisterSubmission extends RegisterSubmitOptions {
  entries: RegisterEntry[];
}

export interface RegisterResultRow {
  student_id: number;
  status: RecordStatus;
  outcome: RecordOutcome;
  record_id?: number | null;
}

export interface RegisterResult {
  success?: boolean;
  message?: string;
  session_id?: number;
  session_status?: SessionStatus;
  submitted?: boolean;
  results?: RegisterResultRow[];
  created?: number;
  updated?: number;
  unchanged?: number;
  unchanged_records?: number;
  [key: string]: unknown;
}

/** Body for `POST /attendance` (admin single-record write). */
export interface SingleRecordInput {
  student_id: number;
  subject_id: number;
  date: string;
  status: RecordStatus;
  session_id?: number;
  start_time?: string;
  reason?: string;
  /** Required (409 `confirm_held`) when the session is past and still `scheduled`. */
  confirm_held?: boolean;
}

export interface MakeupSessionInput {
  subject_id: number;
  faculty_id: number;
  semester: number;
  session_date: string;
  start_time: string;
  end_time: string;
  teacher_id?: number | null;
  reason: string;
}

export interface AttendanceAuditEntry {
  action: string;
  old_status: string | null;
  new_status: string | null;
  old_source: string | null;
  new_source: string | null;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_at: string;
  reason: string | null;
}

export interface SemesterConfig {
  id: number;
  semester_number?: number | null;
  academic_year: number;
  semester_name: string;
  start_date: string;
  end_date: string;
  total_weeks?: number | null;
  exam_week_start?: string | null;
  exam_week_end?: string | null;
  /** Computed from dates by the server (the stored flag is not authoritative). */
  is_current: boolean;
  is_active: boolean;
  state?: TermLifecycleState;
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
}

export interface SemesterConfigInput {
  semester_number?: number | null;
  academic_year: number;
  semester_name: string;
  start_date: string;
  end_date: string;
  total_weeks?: number | null;
  exam_week_start?: string | null;
  exam_week_end?: string | null;
  is_active?: boolean;
}

export type SemesterConfigUpdate = Partial<SemesterConfigInput>;

export interface CurrentTermResult {
  term: SemesterConfig | null;
  term_state: TermState;
}

export interface JobRun {
  id: number;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: 'success' | 'failed' | 'skipped' | string;
  triggered_by?: number | null;
  triggered_by_name?: string | null;
  params?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

export interface AutoAbsentTriggerResult {
  success: boolean;
  message: string;
  records_created: number;
  expired_classes_processed?: number | null;
  students_already_marked?: number | null;
  timestamp: string;
  sessions_materialized?: number;
  sessions_finalized?: number;
  unrecorded_sessions?: number;
  job_run_id?: number | null;
  skipped?: string;
  [key: string]: unknown;
}

export interface AutoAbsentStatus {
  auto_absent_enabled?: boolean;
  current_time?: string;
  in_schedule_window?: boolean;
  schedule_window?: string;
  expired_classes_ready_to_process?: number;
  next_scheduled_run?: string | null;
  notes?: string | string[];
  unrecorded_sessions?: number;
  last_run?: JobRun | null;
  [key: string]: unknown;
}

export interface CheckinWindow {
  /** ISO local date-times. */
  opens_at: string;
  late_after: string;
  closes_at: string;
  state: CheckinWindowState;
}

export interface StudentTodayClass {
  id: number;
  schedule_id?: number | null;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  faculty_id?: number;
  faculty_name?: string;
  day_of_week?: string;
  start_time: string;
  end_time: string;
  semester?: number;
  academic_year?: number;
  classroom?: string | null;
  instructor_name?: string | null;
  is_active?: boolean;
  notes?: string | null;
  duration_minutes?: number;
  time_slot_display?: string;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  session_id?: number | null;
  session_status?: SessionStatus | null;
  my_status?: RecordStatus | null;
  checkin_window?: CheckinWindow | null;
  /** Server shortcut: window open, not cancelled, no record yet. */
  checkin_allowed?: boolean;
}

export interface StudentTodaySchedule {
  classes: StudentTodayClass[];
  term_state: TermState | null;
  day_status: DayStatus | null;
  /** Server date ("today" in the app timezone), when the envelope provides it. */
  date?: string | null;
}

/** Business-rule rejection codes returned by `POST /face-recognition/mark-attendance`
 * (docs/system/face-verification.md §7). */
export type CheckinRejectionCode =
  | 'already_recorded'
  | 'window_closed'
  | 'not_enrolled'
  | 'session_cancelled'
  | 'no_session_today'
  | 'between_terms'
  | 'face_mismatch'
  | 'no_face_detected'
  | 'subject_not_found'
  | 'too_many_attempts'
  | 'no_registered_face'
  | 'presence_code_required'
  | 'presence_code_invalid'
  | 'challenge_required'
  | 'challenge_invalid'
  | 'invalid_frames'
  | 'multiple_faces'
  | 'low_quality'
  | 'liveness_failed'
  | 'turned_too_far'
  | 'spoof_suspected'
  | 'liveness_unavailable';

/** Per-frame quality problems reported with `low_quality`. */
export type FaceQualityIssue = 'too_dark' | 'too_bright' | 'too_blurry' | 'too_small' | 'low_confidence' | 'not_frontal';

/** `GET /face-recognition/policy`: the public subset of the face verification policy. */
export interface FacePublicPolicy {
  require_liveness: boolean;
  require_head_turn: boolean;
  require_presence_code: boolean;
  frames_min: number;
  frames_max: number;
  challenge_ttl_seconds: number;
  presence_code_period_seconds: number;
  enrolment_min_images: number;
}

/** Full policy stored in the `face_verification` system setting (admin). */
export interface FacePolicySettings {
  match_threshold: number;
  consistency_threshold: number;
  duplicate_threshold: number;
  require_liveness: boolean;
  antispoof_threshold: number;
  require_head_turn: boolean;
  head_turn_min_yaw: number;
  max_turn_yaw: number;
  frontal_max_yaw: number;
  challenge_ttl_seconds: number;
  frames_min: number;
  frames_max: number;
  require_presence_code: boolean;
  presence_code_period_seconds: number;
  max_failed_attempts: number;
  failed_attempt_window_minutes: number;
  min_detection_score: number;
  enrolment_min_detection_score: number;
  min_face_size_px: number;
  min_sharpness: number;
  min_brightness: number;
  max_brightness: number;
  enrolment_min_images: number;
}

export type FaceChallengeAction = 'turn_left' | 'turn_right' | 'front_left_right';
export type FaceChallengePurpose = 'checkin' | 'enrolment';

/** `POST /face-recognition/challenge`: single-use liveness challenge. */
export interface FaceChallenge {
  challenge_id: string;
  purpose: FaceChallengePurpose;
  /** `turn_left`/`turn_right` = the student's own left/right (preview is mirrored). */
  action: FaceChallengeAction;
  expires_at: string;
  ttl_seconds: number;
  frames_min: number;
  frames_max: number;
  requires_head_turn: boolean;
  requires_liveness: boolean;
  requires_presence_code: boolean;
  instructions: string;
}

export type FaceEnrollmentStatusValue = 'none' | 'enrolled' | 'reset' | 'deleted';

/** `GET /face-recognition/enrollment` (student's own enrolment state). */
export interface FaceEnrollmentStatus {
  status: FaceEnrollmentStatusValue;
  can_enroll: boolean;
  registered_at: string | null;
  model: string | null;
  template_count: number;
  consent_at: string | null;
  message?: string | null;
}

export interface FaceEnrollResult {
  success: boolean;
  message: string;
  details?: {
    images_processed?: number;
    valid_images?: number;
    poses?: { front?: number; left?: number; right?: number };
    template_count?: number;
    model?: string;
    image_results?: Array<Record<string, unknown>>;
  };
}

/** `GET /attendance/sessions/{id}/presence-code` (teacher of the session / admin). */
export interface PresenceCodeInfo {
  session_id: number;
  code: string;
  digits: number;
  period_seconds: number;
  expires_in_seconds: number;
  server_time: string;
  /** Whether check-in currently requires the code (policy). */
  required: boolean;
  /** Relative deep link; the QR encodes `window.location.origin + checkin_path`. */
  checkin_path: string;
  window: { opens_at: string | null; closes_at: string | null; state: CheckinWindowState | string | null };
  subject_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface FaceAttempt {
  id: number;
  student_id: number;
  student_name: string | null;
  roll_number: string | null;
  outcome: string;
  counts_as_failure: boolean;
  similarity: number | null;
  liveness_score: number | null;
  created_at: string;
}

export interface FaceAttemptsResponse {
  session_id: number;
  attempts: FaceAttempt[];
  summary: { total: number; successes: number; failures: number; by_outcome: Record<string, number> };
}

/** `GET /students/{id}/face` (admin). */
export interface StudentFaceInfo {
  student_id: number;
  status: FaceEnrollmentStatusValue;
  registered_at: string | null;
  model: string | null;
  consent_at: string | null;
  template_count: number;
  poses: string[];
  events: Array<{
    id: number;
    action: 'enrolled' | 'reset' | 'deleted' | 'duplicate_blocked' | 'spoof_blocked' | string;
    actor_name: string | null;
    reason: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
}

export interface FaceCheckinResult {
  success: boolean;
  message: string;
  code?: CheckinRejectionCode | string;
  current_status?: RecordStatus | null;
  status?: 'present' | 'late' | null;
  session_id?: number | null;
  subject_id?: number | null;
  window_state?: CheckinWindowState | null;
  opens_at?: string | null;
  closes_at?: string | null;
  attendanceMarked: boolean;
  studentId?: string;
  confidenceScore?: number;
  /** With `low_quality`: what to fix. */
  quality_issues?: FaceQualityIssue[] | null;
  /** With `too_many_attempts`: seconds until check-in unlocks. */
  retry_after_seconds?: number | null;
}

export interface TeacherRosterStudent {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  year?: number;
  faculty_id?: number;
  /** `null` = not marked. Legacy servers may still send `no_data`/`system_inactive`. */
  attendance_status: RecordStatus | 'no_data' | 'system_inactive' | string | null;
  source?: AttendanceSource | null;
  record_id?: number | null;
  excluded_from_metrics?: boolean;
  enrolled?: boolean;
}

export interface TeacherRosterSession extends Partial<ClassSessionInfo> {
  id: number;
  status: SessionStatus;
  start_time: string;
  end_time: string;
}

export interface TeacherRosterResponse {
  students: TeacherRosterStudent[];
  date: string;
  semester: number;
  subject_id: number;
  total_students?: number;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  session?: TeacherRosterSession | null;
  sessions?: TeacherRosterSession[];
  /** False when the server will reject edits (future class, outside edit window, cancelled...). */
  can_edit?: boolean;
  edit_block_reason?: string | null;
  late_count?: number;
  excused_count?: number;
  unmarked_count?: number;
  term_state?: TermState;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export interface ApiEntryError {
  student_id?: number;
  code: string;
  message: string;
}

export interface ApiErrorInfo {
  status?: number;
  /** Structured error code, e.g. `invalid_entries`, `confirm_held`, `session_cancelled`. */
  code?: string;
  message: string;
  /** The raw `detail` value (string, object or FastAPI validation array). */
  detail: unknown;
  /** The whole error response body. */
  data?: unknown;
  errors?: ApiEntryError[];
}

const messageFromDetail = (detail: unknown, fallback: string): string => {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : ''))
      .filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message) return d.message;
    if (typeof d.detail === 'string' && d.detail) return d.detail;
    if (typeof d.code === 'string' && d.code) return d.code.replace(/_/g, ' ');
  }
  return fallback;
};

/** Normalises any error thrown by `apiRequest` (or elsewhere) into a structured shape. */
export const parseApiError = (err: unknown): ApiErrorInfo => {
  const e = (err ?? {}) as { status?: number; message?: string; response?: { status?: number; data?: unknown } };
  const status = e.status ?? e.response?.status;
  const data = e.response?.data as Record<string, unknown> | null | undefined;
  const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : data;
  let code: string | undefined;
  let errors: ApiEntryError[] | undefined;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>;
    const nested = d.details && typeof d.details === 'object' ? (d.details as Record<string, unknown>) : null;
    if (typeof d.code === 'string') code = d.code;
    if (Array.isArray(d.errors)) errors = d.errors as ApiEntryError[];
    else if (nested && Array.isArray(nested.errors)) errors = nested.errors as ApiEntryError[];
  } else if (data && typeof data === 'object' && typeof data.code === 'string') {
    code = data.code as string;
  }
  const fallback = e.message && e.message !== '[object Object]' ? e.message : 'Request failed';
  return { status, code, message: messageFromDetail(detail, fallback), detail, data, errors };
};

/** Reads a field from a structured error `detail` object (e.g. `students_without_record`). */
export const getErrorDetailField = <T = unknown>(info: ApiErrorInfo, key: string): T | undefined => {
  const pick = (obj: unknown): unknown =>
    obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>)[key] : undefined;
  // detail.key → detail.details.key → body.key (e.g. 404 `{detail, term_state}`)
  const fromDetail = pick(info.detail);
  if (fromDetail !== undefined) return fromDetail as T;
  const details =
    info.detail && typeof info.detail === 'object' && !Array.isArray(info.detail)
      ? (info.detail as Record<string, unknown>).details
      : undefined;
  const nested = pick(details);
  if (nested !== undefined) return nested as T;
  return pick(info.data) as T | undefined;
};

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

const toNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const normalizeBands = (raw: unknown): AttendanceBand[] => {
  if (!Array.isArray(raw)) return [];
  const bands = raw
    .map((b): AttendanceBand | null => {
      if (!b || typeof b !== 'object') return null;
      const r = b as Record<string, unknown>;
      const min = toNum(r.min ?? r.min_percentage, NaN);
      if (!Number.isFinite(min)) return null;
      const maxRaw = r.max ?? r.max_percentage_exclusive ?? r.max_percentage;
      const max = maxRaw === null || maxRaw === undefined ? null : toNum(maxRaw, NaN);
      const name = String(r.name ?? r.label ?? '');
      return {
        name,
        label: String(r.label ?? (name ? name.charAt(0).toUpperCase() + name.slice(1) : '')),
        min,
        max: max === null || !Number.isFinite(max) ? null : max,
        color: typeof r.color === 'string' ? r.color : undefined,
      };
    })
    .filter((b): b is AttendanceBand => b !== null);
  return bands.sort((a, b) => b.min - a.min);
};

const normalizePolicy = (raw: Record<string, unknown>): AttendancePolicy => ({
  minimum_percentage: toNum(raw.minimum_percentage, 75),
  late_counts_as_attended: raw.late_counts_as_attended !== false,
  checkin_opens_minutes_before: toNum(raw.checkin_opens_minutes_before, 10),
  late_after_minutes: toNum(raw.late_after_minutes, 10),
  checkin_closes_after_minutes: toNum(raw.checkin_closes_after_minutes, 20),
  finalize_grace_minutes: toNum(raw.finalize_grace_minutes, 15),
  teacher_edit_window_days: toNum(raw.teacher_edit_window_days, 7),
  weekly_off_days: Array.isArray(raw.weekly_off_days)
    ? (raw.weekly_off_days as unknown[]).map(String)
    : Array.isArray(raw.weekly_off_day_names)
      ? (raw.weekly_off_day_names as unknown[]).map(String)
      : [],
  bands: normalizeBands(raw.bands),
  term_state: (raw.term_state as TermState) || 'active',
  current_term: (raw.current_term as TermSummary | null) ?? null,
});

const POLICY_TTL_MS = 5 * 60 * 1000;
let policyCache: { value: AttendancePolicy; at: number } | null = null;
let policyInflight: Promise<AttendancePolicy> | null = null;

const normalizeStudentToday = (raw: unknown): StudentTodaySchedule => {
  if (Array.isArray(raw)) {
    return { classes: raw as StudentTodayClass[], term_state: null, day_status: null };
  }
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = r.classes ?? r.schedules ?? r.sessions ?? r.items ?? r.data;
  const dayStatusRaw = r.day_status;
  const dayStatus =
    dayStatusRaw && typeof dayStatusRaw === 'object'
      ? ((dayStatusRaw as Record<string, unknown>).instructional
          ? 'instructional'
          : ((dayStatusRaw as Record<string, unknown>).reason as DayStatus | null) ?? null)
      : ((dayStatusRaw as DayStatus | null | undefined) ?? null);
  return {
    classes: Array.isArray(list) ? (list as StudentTodayClass[]) : [],
    term_state: (r.term_state as TermState | undefined) ?? null,
    day_status: dayStatus,
    date: typeof r.date === 'string' ? r.date : null,
  };
};

const appendIfDefined = (params: URLSearchParams, key: string, value: unknown) => {
  if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
};

const withQuery = (path: string, params: URLSearchParams) => {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

/** Drops `undefined` keys so optional contract fields are omitted rather than sent as null. */
const compact = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

// Core fetch wrapper that injects Authorization header and parses JSON
const apiRequest = async <T = any>(
  path: string,
  options: (RequestInit & { skipAuth?: boolean; _retry?: boolean }) = {}
): Promise<T> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  
  // Always include Authorization header if token exists and skipAuth is not true
  if (!options.skipAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    // Ensure credentials are included for CORS
    credentials: 'include',
  });

  // Handle authentication errors
  if (res.status === 401 || res.status === 403) {
    const errorText = await res.text().catch(() => '');
    console.warn(`[API] Authentication error ${res.status}:`, errorText || res.statusText);

    // Try to parse error details
    let errorDetails: any;
    try {
      errorDetails = errorText ? JSON.parse(errorText) : null;
    } catch {
      errorDetails = { detail: errorText || 'Authentication failed' };
    }

    // Attempt a one-time token refresh on 401/403 if not already retried
    const shouldAttemptRefresh = !options.skipAuth && !options._retry && (res.status === 401 || res.status === 403);
    if (shouldAttemptRefresh) {
      try {
        // Lazy import via existing api reference below
        const refreshed = await api.auth.refreshToken();
        if (refreshed?.token) {
          // Retry original request with _retry flag to avoid loops
          return await apiRequest<T>(path, { ...options, _retry: true });
        }
      } catch (refreshErr) {
        console.warn('[API] Token refresh failed:', refreshErr);
        // fall through to throw original auth error
      }
    }

    // If it's a 401, the token might be expired - clear it
    if (res.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        console.warn('[API] Token expired, clearing localStorage');
      }
    }

    const error = new Error(messageFromDetail(errorDetails?.detail, 'Not authenticated'));
    (error as any).status = res.status;
    (error as any).response = { status: res.status, data: errorDetails };
    throw error;
  }

  // Handle other HTTP errors
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errorDetails;
    try {
      errorDetails = errorText ? JSON.parse(errorText) : null;
    } catch {
      errorDetails = { detail: errorText || `Request failed: ${res.status}` };
    }
    
    // `detail` may be a string, a structured object ({code, message, errors}) or a
    // FastAPI validation array — never surface "[object Object]".
    const error = new Error(messageFromDetail(errorDetails?.detail, `Request failed: ${res.status}`));
    (error as any).status = res.status;
    (error as any).response = { status: res.status, data: errorDetails };
    throw error;
  }

  // Gracefully handle empty responses (e.g., 204 No Content)
  const contentType = res.headers.get('content-type') || '';
  const contentLength = res.headers.get('content-length');
  const isNoContent = res.status === 204 || contentLength === '0';

  if (isNoContent) {
    // Return undefined for no-content responses
    return undefined as unknown as T;
  }

  // If server claims JSON but returns empty body, avoid JSON parse error
  if (contentType.includes('application/json')) {
    const raw = await res.text();
    if (!raw || raw.trim() === '') {
      return undefined as unknown as T;
    }
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn('[API] Failed to parse JSON; returning raw text', err);
      return raw as unknown as T;
    }
  }

  // Fallback to text for non-JSON responses
  const text = await res.text();
  return text as unknown as T;
};

// Helpers for token validation (best-effort checks)
const base64UrlDecode = (input: string): string => {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad !== 0) base64 += '===';
  return atob(base64);
};

const isValidTokenFormat = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
};

const isTokenLikelyExpired = (token: string): boolean => {
  try {
    if (!isValidTokenFormat(token)) return true;
    const parts = token.split('.');
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    return !!(payload.exp && payload.exp < now);
  } catch {
    return true;
  }
};

// API client methods
export const api = {
  // Auth methods
  auth: {
    login: async (email: string, password: string): Promise<AuthResponse> => {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true, // Don't include auth header for login
      });

      // Validate response structure
      if (!response || !response.access_token) {
        throw new Error('Invalid login response: missing access token');
      }

      // Store token in localStorage
      setAuthToken(response.access_token);
      
      // Log successful login (remove in production)
      console.log('[AUTH] Login successful for:', response.user?.email);

      return {
        user: {
          id: response.user.id.toString(),
          name: response.user.full_name,
          email: response.user.email,
          role: response.user.role,
        },
        token: response.access_token,
      };
    },

    register: async (userData: RegisterData): Promise<AuthResponse> => {
      try {
        const response = await apiRequest('/auth/register-student', {
          method: 'POST',
          body: JSON.stringify({
            user: {
              email: userData.email,
              full_name: userData.name,
              password: userData.password,
            },
            student_id: `STU${Date.now()}`,
            class_name: 'General',
            year: new Date().getFullYear(),
            phone_number: '',
            emergency_contact: '',
          }),
        });

        return {
          user: {
            id: response.user_id?.toString() || '',
            name: response.user?.full_name || userData.name,
            email: response.user?.email || userData.email,
            role: 'student',
          },
          token: '', // No token returned from registration
        };
      } catch (error) {
        throw new Error('Registration failed');
      }
    },

    logout: (): Promise<void> => {
      clearAuthToken();
      return Promise.resolve();
    },

    getUser: async (): Promise<User> => {
      try {
        const response = await apiRequest('/auth/me');
        return {
          id: response.id.toString(),
          name: response.full_name,
          email: response.email,
          role: response.role,
        };
      } catch (error) {
        throw new Error('Failed to get user');
      }
    },

    refreshToken: async (): Promise<AuthResponse> => {
      try {
        const response = await apiRequest('/auth/refresh-token', {
          method: 'POST',
          skipAuth: false, // Include auth header but prevent retry
          _retry: true, // Prevent infinite loop by marking as retry
        });

        setAuthToken(response.access_token);

        return {
          user: {
            id: response.user.id.toString(),
            name: response.user.full_name,
            email: response.user.email,
            role: response.user.role,
          },
          token: response.access_token,
        };
      } catch (error) {
        clearAuthToken();
        throw new Error('Failed to refresh token');
      }
    },

    checkAuthStatus: async (): Promise<boolean> => {
      try {
        const token = getAuthToken();
        if (!token || isTokenLikelyExpired(token)) return false;
        await api.auth.getUser();
        return true;
      } catch {
        return false;
      }
    },
  },

  // Students methods
  students: {
    getAll: async (): Promise<Student[]> => {
      const response = await apiRequest('/students/?limit=1000');
      if (!response || !Array.isArray(response)) return [];
      return response.map((student: Record<string, unknown>) => {
        const user = (student.user as Record<string, unknown>) || {};
        const fullName = user?.full_name ? String(user.full_name) : '';
        const email = user?.email ? String(user.email) : '';
        const studentId = student.student_id ? String(student.student_id) : '';
        const faculty = student.faculty ? String(student.faculty) : 'Unknown Faculty';
        return {
          id: student.id?.toString() || '',
          name: fullName,
          email,
          rollNo: `R-${studentId}`,
          studentId,
          faculty,
          faculty_id: student.faculty_id ? Number(student.faculty_id) : 0,
          semester: student.semester ? Number(student.semester) : 1,
          year: student.year ? Number(student.year) : 1,
          batch: student.batch ? Number(student.batch) : new Date().getFullYear(),
          phone_number: student.phone_number?.toString() || '',
          emergency_contact: student.emergency_contact?.toString() || '',
          profileImage: student.profile_image_url?.toString() || '',
          face_encoding: null,
          face_registered: !!student.face_registered,
          face_registered_at: (student.face_registered_at as string | null | undefined) ?? null,
          face_enrollment_status: (student.face_enrollment_status as FaceEnrollmentStatusValue | undefined) ?? 'none',
        } as Student;
      });
    },

    getById: async (id: string): Promise<Student> => {
      const response = await apiRequest(`/students/${id}`);
      return {
        id: response.id.toString(),
        name: response.user ? response.user.full_name : '',
        email: response.user ? response.user.email : '',
        rollNo: `R-${response.student_id}`,
        studentId: response.student_id,
        faculty: response.faculty || 'Unknown Faculty',
        semester: response.semester || 1,
        year: response.year || 1,
        batch: response.batch || new Date().getFullYear(),
        phone_number: response.phone_number || '',
        emergency_contact: response.emergency_contact || '',
        profileImage: response.profile_image_url || '',
        face_encoding: null,
        face_registered: !!response.face_registered,
        face_registered_at: response.face_registered_at ?? null,
        face_enrollment_status: (response.face_enrollment_status as FaceEnrollmentStatusValue | undefined) ?? 'none',
      } as Student;
    },

    /** Admin: face enrolment status, templates and audit events. */
    getFace: async (id: string | number): Promise<StudentFaceInfo> => {
      return apiRequest(`/students/${id}/face`);
    },

    /** Admin: delete a student's face templates so they can enrol again (reason required). */
    resetFace: async (id: string | number, reason: string): Promise<{ success: boolean; message: string }> => {
      const response = await apiRequest(`/students/${id}/face/reset`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      return { success: !!response?.success, message: response?.message || '' };
    },

    create: async (studentData: StudentCreateData): Promise<Student> => {
      const response = await apiRequest('/students/', {
        method: 'POST',
        body: JSON.stringify({
          user: {
            email: studentData.email,
            full_name: studentData.name,
            password: studentData.password,
          },
          student_id: studentData.studentId,
          faculty_id: studentData.faculty_id,
          semester: studentData.semester || 1,
          year: studentData.year || 1,
          batch: studentData.batch || new Date().getFullYear(),
          phone_number: studentData.phone_number || null,
          emergency_contact: studentData.emergency_contact || null,
        }),
      });

      return {
        id: response.id.toString(),
        name: response.user ? response.user.full_name : studentData.name,
        email: response.user ? response.user.email : studentData.email,
        rollNo: `R-${response.student_id}`,
        studentId: response.student_id,
        faculty: response.faculty || 'Unknown',
        semester: response.semester || studentData.semester,
        year: response.year || studentData.year,
        batch: response.batch || studentData.batch,
        profileImage: response.profile_image_url || '',
      } as Student;
    },

    update: async (id: string, updateData: Record<string, unknown>) => {
      const response = await apiRequest(`/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      return {
        id: response.id.toString(),
        name: response.user ? response.user.full_name : '',
        email: response.user ? response.user.email : '',
        rollNo: `R-${response.student_id}`,
        studentId: response.student_id,
        faculty: response.faculty || 'Unknown Faculty',
        semester: response.semester || 1,
        year: response.year || 1,
        batch: response.batch || new Date().getFullYear(),
        profileImage: response.profile_image_url || '',
      } as Student;
    },

    delete: async (id: string): Promise<void> => {
      if (!id || id.trim() === '') throw new Error(`Invalid student ID: ${id}`);
      await apiRequest(`/students/${id}`, { method: 'DELETE' });
    },
  },

  // Attendance methods (unified, snake_case params, no trailing slash)
  attendance: {
    getAll: async (filters: AttendanceFilters = {}): Promise<{ records: Attendance[]; total: number; hasMore: boolean }> => {
      const params = new URLSearchParams();
      if (filters.studentId) params.append('student_id', filters.studentId);
      if (filters.subjectId) params.append('subject_id', filters.subjectId);
      if (filters.status) params.append('status', filters.status);
      if (filters.date) params.append('date', filters.date);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.search) params.append('search', filters.search);
      if (filters.faculty_id) params.append('faculty_id', filters.faculty_id.toString());
      if (filters.semester) params.append('semester', filters.semester.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.skip !== undefined) params.append('skip', filters.skip.toString());
      const endpoint = params.toString() ? `/attendance?${params}` : '/attendance';
      const response = await apiRequest(endpoint);
      
      // Handle both old array response and new paginated response
      if (Array.isArray(response)) {
        // Old format - return as-is with default metadata
        const records = response.map((record: Record<string, unknown>) => ({
          id: record?.id?.toString?.() || '',
          studentId: record?.student_id?.toString?.() || record?.studentId?.toString?.() || '',
          studentName: (record as any)?.studentName || (record as any)?.student_name || 'Unknown Student',
          studentNumber: (record as any)?.studentNumber || (record as any)?.student_number || 'N/A',
          subjectId: record?.subjectId?.toString?.() || record?.subject_id?.toString?.() || record?.class_id?.toString?.() || '',
          subjectName: (record as any)?.subjectName?.toString?.() || (record as any)?.subject_name?.toString?.(),
          subjectCode: (record as any)?.subjectCode?.toString?.() || (record as any)?.subject_code?.toString?.(),
          date: (record?.date ?? '').toString(),
          status: (record?.status ?? 'absent') as Attendance['status'],
          timeIn: (record as any)?.timeIn?.toString?.() || (record as any)?.time_in?.toString?.(),
          timeOut: (record as any)?.timeOut?.toString?.() || (record as any)?.time_out?.toString?.(),
          createdAt: (record as any)?.createdAt?.toString?.() || (record as any)?.created_at?.toString?.(),
          is_cancelled: (record as any)?.is_cancelled || false,
          cancellation_reason: (record as any)?.cancellation_reason,
        }));
        return { records, total: records.length, hasMore: false };
      }
      
      // New paginated format
      const recordsList = Array.isArray(response.records) ? response.records : [];
      const records = recordsList.map((record: Record<string, unknown>) => ({
        id: record?.id?.toString?.() || '',
        studentId: record?.student_id?.toString?.() || record?.studentId?.toString?.() || '',
        studentName: (record as any)?.studentName || (record as any)?.student_name || 'Unknown Student',
        studentNumber: (record as any)?.studentNumber || (record as any)?.student_number || 'N/A',
        subjectId: record?.subjectId?.toString?.() || record?.subject_id?.toString?.() || record?.class_id?.toString?.() || '',
        subjectName: (record as any)?.subjectName?.toString?.() || (record as any)?.subject_name?.toString?.(),
        subjectCode: (record as any)?.subjectCode?.toString?.() || (record as any)?.subject_code?.toString?.(),
        date: (record?.date ?? '').toString(),
        status: (record?.status ?? 'absent') as Attendance['status'],
        timeIn: (record as any)?.timeIn?.toString?.() || (record as any)?.time_in?.toString?.(),
        timeOut: (record as any)?.timeOut?.toString?.() || (record as any)?.time_out?.toString?.(),
        createdAt: (record as any)?.createdAt?.toString?.() || (record as any)?.created_at?.toString?.(),
        is_cancelled: (record as any)?.is_cancelled || false,
        cancellation_reason: (record as any)?.cancellation_reason,
      }));
      
      return {
        records,
        total: response.total || records.length,
        hasMore: response.hasMore || false
      };
    },

    getById: async (id: string): Promise<Attendance> => {
      const response = await apiRequest(`/attendance/${id}`);
      return {
        id: response.id.toString(),
        studentId: response.student_id?.toString() || response.studentId?.toString(),
        subjectId: response.subject_id?.toString() || response.class_id?.toString() || '',
        date: response.date,
        status: response.status,
        timeIn: (response as any)?.timeIn || (response as any)?.time_in,
        timeOut: (response as any)?.timeOut || (response as any)?.time_out,
        createdAt: (response as any)?.createdAt || (response as any)?.created_at,
      } as Attendance;
    },

    create: async (attendance: Omit<Attendance, 'id'>) => {
      const response = await apiRequest('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          student_id: parseInt(attendance.studentId),
          subject_id: parseInt(attendance.subjectId),
          date: attendance.date,
          status: attendance.status,
        }),
      });
      return {
        id: response.id.toString(),
        studentId: response.student_id?.toString() || '',
        subjectId: (response.subject_id ?? response.class_id)?.toString?.() || '',
        date: response.date,
        status: response.status,
        timeIn: (response as any)?.timeIn || (response as any)?.time_in,
        timeOut: (response as any)?.timeOut || (response as any)?.time_out,
        createdAt: (response as any)?.createdAt || (response as any)?.created_at,
      } as Attendance;
    },

    getSummary: async (filters: AttendanceFilters = {}): Promise<AttendanceSummary> => {
      const params = new URLSearchParams();
      if (filters.studentId) params.append('student_id', filters.studentId);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      const endpoint = params.toString()
        ? `/attendance/summary?${params}`
        : '/attendance/summary';
      const response = await apiRequest(endpoint);
      // Keep every server field (percentage, has_data, eligible, band, term_state, …) and
      // add the legacy camelCase shape older screens read.
      return {
        ...response,
        present: response.present || 0,
        absent: response.absent || 0,
        late: response.late || 0,
        excused: response.excused || 0,
        total: response.total || 0,
        percentagePresent: response.percentage_present ?? response.percentagePresent ?? 0,
      } as AttendanceSummary;
    },

    getCalendar: async (year: number, month: number) => {
      console.log('API: Calling attendance calendar with:', { year, month });
      try {
        const response = await apiRequest(`/attendance/calendar?year=${year}&month=${month}`);
        console.log('API: Calendar response received:', response);
        
        // The backend returns { calendar_data: [...], month: X, year: Y }
        // We need to extract calendar_data
        return {
          calendar_data: response.calendar_data || response || []
        };
      } catch (error) {
        console.error('API: Calendar request failed:', error);
        return {
          calendar_data: []
        };
      }
    },

    /**
     * Admin register view. Per student: `attendance_status` (null when unmarked),
     * `record_id`, `source`, `excluded_from_metrics`; top level `session`, `sessions`,
     * `session_id`. Pass `sessionId`/`startTime` to pick a slot when there are several.
     */
    getStudentsBySubject: async (
      facultyId: number,
      semester: number,
      subjectId: number,
      date?: string,
      slot: { sessionId?: number | null; startTime?: string | null } = {}
    ) => {
      const params = new URLSearchParams({
        faculty_id: facultyId.toString(),
        semester: semester.toString(),
        subject_id: subjectId.toString(),
      });
      if (date) params.append('date', date);
      appendIfDefined(params, 'session_id', slot.sessionId);
      appendIfDefined(params, 'start_time', slot.startTime);
      return apiRequest(`/attendance/students-by-subject?${params}`);
    },

    /**
     * Admin single-record write (`POST /attendance`). Errors: 409 `confirm_held`
     * (detail.students_without_record) unless `confirm_held: true`; 400 for reason /
     * validation problems; 409 `session_cancelled`.
     */
    recordSingle: async (body: SingleRecordInput): Promise<Record<string, any>> =>
      apiRequest('/attendance', { method: 'POST', body: JSON.stringify(compact({ ...body })) }),

    /**
     * Admin register submission for the resolved session (subject + date, optionally
     * `session_id`/`start_time`/`faculty_id`/`semester`). Send only changed rows.
     * Returns `session_id`, `results`, `unchanged_records`, `session_status`, `submitted`.
     * Errors: 400 `invalid_entries` (detail.errors), 404 `session_not_found`,
     * 409 `ambiguous_session` / `session_cancelled` / `confirm_held` (see `parseApiError`).
     */
    markBulk: async (attendanceData: {
      subject_id: number;
      date?: string;
      session_id?: number;
      start_time?: string;
      faculty_id?: number;
      semester?: number;
      students: Array<{ student_id: number; status: string; reason?: string }>;
    } & RegisterSubmitOptions): Promise<RegisterResult> => {
      return apiRequest('/attendance/mark-bulk', {
        method: 'POST',
        body: JSON.stringify(compact(attendanceData)),
      });
    },

    getStudentSubjectBreakdown: async (studentId: number) => {
      return apiRequest(`/attendance/student-subject-breakdown/${studentId}`);
    },

    getStudentCalendar: async (studentId: number, year: number, month: number) => {
      return apiRequest(`/student-calendar/${studentId}?year=${year}&month=${month}`);
    },

    getMyCalendar: async (year: number, month: number) => {
      return apiRequest(`/student-calendar/me?year=${year}&month=${month}`);
    },
  },



  // Classes methods (legacy wrapper around subjects)
  classes: {
    getAll: async (): Promise<Subject[]> => {
      const response = await apiRequest('/classes');
      return (response as unknown[]).map((cls: Record<string, unknown>) => ({
        id: cls.id?.toString() || '',
        name: cls.name?.toString() || '',
        code: cls.code?.toString() || '',
        description: cls.description?.toString(),
        credits: cls.credits ? Number(cls.credits) : undefined,
        faculty_id: cls.faculty_id !== undefined ? Number(cls.faculty_id) : undefined,
      }));
    },

    getById: async (id: string): Promise<Subject> => {
      const response = await apiRequest(`/classes/${id}`);
      return {
        id: response.id.toString(),
        name: response.name,
        code: response.code || '',
        description: response.description,
        credits: response.credits ? Number(response.credits) : undefined,
        faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined,
      } as Subject;
    },

    create: async (classData: Omit<Subject, 'id'>) => {
      const response = await apiRequest('/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: classData.name,
          code: classData.code,
          description: classData.description,
          credits: classData.credits,
          faculty_id: classData.faculty_id,
        }),
      });
      return {
        id: response.id.toString(),
        name: response.name,
        code: response.code || '',
        description: response.description,
        credits: response.credits ? Number(response.credits) : undefined,
        faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined,
      } as Subject;
    },

    update: async (id: string, classData: Partial<Subject>) => {
      const updateData: Record<string, unknown> = {};
      if (classData.name) updateData.name = classData.name;
      if (classData.code) updateData.code = classData.code;
      if (classData.description) updateData.description = classData.description;
      if (classData.credits !== undefined) updateData.credits = classData.credits;
      if (classData.faculty_id !== undefined) updateData.faculty_id = classData.faculty_id;

      const response = await apiRequest(`/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      return {
        id: response.id.toString(),
        name: response.name,
        code: response.code || '',
        description: response.description,
        credits: response.credits ? Number(response.credits) : undefined,
        faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined,
      } as Subject;
    },

    delete: async (id: string): Promise<void> => {
      await apiRequest(`/classes/${id}`, { method: 'DELETE' });
    },
  },

  // Face Recognition methods (docs/system/face-verification.md)
  faceRecognition: {
    /** Public face policy (what the check-in / enrolment UI must collect). */
    getPolicy: async (): Promise<FacePublicPolicy> => {
      return apiRequest('/face-recognition/policy');
    },

    /** Single-use liveness challenge. Create it right before capturing. */
    createChallenge: async (opts: {
      purpose: FaceChallengePurpose;
      sessionId?: number | null;
      subjectId?: number | string | null;
      scheduleId?: number | null;
    }): Promise<FaceChallenge> => {
      const subjectId = opts.subjectId !== undefined && opts.subjectId !== null && opts.subjectId !== '' ? Number(opts.subjectId) : undefined;
      return apiRequest('/face-recognition/challenge', {
        method: 'POST',
        body: JSON.stringify(
          compact({
            purpose: opts.purpose,
            session_id: opts.sessionId ?? undefined,
            subject_id: Number.isFinite(subjectId) ? subjectId : undefined,
            schedule_id: opts.scheduleId ?? undefined,
          })
        ),
      });
    },

    /**
     * Student self check-in. Send the captured burst (`frames`, unmirrored JPEG base64) with the
     * challenge id and presence code. The server picks the open session and computes the status;
     * business rejections come back as HTTP 200 + `success:false` + `code`.
     * Second argument: a subject id (legacy) or the target/extras object.
     */
    markAttendance: async (
      frames: string | string[],
      target:
        | string
        | {
            subjectId?: string | number;
            sessionId?: number | null;
            scheduleId?: number | null;
            challengeId?: string | null;
            presenceCode?: string | null;
          }
    ): Promise<FaceCheckinResult> => {
      const t = typeof target === 'string' ? { subjectId: target } : target;
      const subjectId = t.subjectId !== undefined && t.subjectId !== '' ? Number(t.subjectId) : undefined;
      const frameList = Array.isArray(frames) ? frames : [frames];
      const challengeId = 'challengeId' in t ? t.challengeId : undefined;
      const presenceCode = 'presenceCode' in t ? t.presenceCode : undefined;
      const response = await apiRequest('/face-recognition/mark-attendance', {
        method: 'POST',
        body: JSON.stringify(
          compact({
            frames: frameList,
            subject_id: Number.isFinite(subjectId) ? subjectId : undefined,
            session_id: t.sessionId ?? undefined,
            schedule_id: t.scheduleId ?? undefined,
            challenge_id: challengeId || undefined,
            presence_code: presenceCode ? presenceCode.trim() : undefined,
          })
        ),
      });
      const success = !!response?.success;
      return {
        success,
        message: response?.message || '',
        code: response?.code,
        current_status: response?.current_status ?? null,
        status: response?.status ?? null,
        session_id: response?.session_id ?? null,
        subject_id: response?.subject_id ?? null,
        window_state: response?.window_state ?? null,
        opens_at: response?.opens_at ?? null,
        closes_at: response?.closes_at ?? null,
        attendanceMarked: success && response?.attendance_marked !== false,
        studentId: response?.student_id?.toString(),
        confidenceScore: response?.confidence_score,
        quality_issues: Array.isArray(response?.quality_issues) ? response.quality_issues : null,
        retry_after_seconds: typeof response?.retry_after_seconds === 'number' ? response.retry_after_seconds : null,
      };
    },

    /** The logged-in student's enrolment state. */
    getEnrollment: async (): Promise<FaceEnrollmentStatus> => {
      return apiRequest('/face-recognition/enrollment');
    },

    /**
     * Enrol the logged-in student's face (front/left/right frames + consent + enrolment
     * challenge). Throws on rejection; read `parseApiError(err).code` (`already_enrolled`,
     * `enrolment_locked`, `consent_required`, `challenge_invalid`, `low_quality`,
     * `pose_coverage`, `spoof_suspected`, `duplicate_face`, `liveness_unavailable`, ...).
     */
    enroll: async (images: string[], opts: { consent: boolean; challengeId?: string | null }): Promise<FaceEnrollResult> => {
      const response = await apiRequest('/face-recognition/register-face-multi', {
        method: 'POST',
        body: JSON.stringify(compact({ images, consent: opts.consent, challenge_id: opts.challengeId || undefined })),
      });
      return { success: !!response?.success, message: response?.message || '', details: response?.details };
    },

    /** Delete the logged-in student's face data (re-enrolling then needs an admin reset). */
    deleteMyFace: async (): Promise<{ success: boolean; message: string }> => {
      const response = await apiRequest('/face-recognition/my-face', { method: 'DELETE' });
      return { success: !!response?.success, message: response?.message || '' };
    },

    /** Verifies the captured face against the logged-in user's saved embedding. */
    verifyIdentity: async (imageData: string): Promise<{ matched: boolean; message?: string; [key: string]: unknown }> => {
      const response = await apiRequest('/face-recognition/verify-identity', {
        method: 'POST',
        body: JSON.stringify({ image_data: imageData }),
      });
      return { ...(response || {}), matched: !!response?.matched, message: response?.message };
    },

    registerFace: async (imageData: string | string[] | { image_data: string | string[] }) => {
      let requestBody: Record<string, unknown>;
      if (typeof imageData === 'string') {
        requestBody = { image_data: imageData };
      } else if (Array.isArray(imageData)) {
        requestBody = { image_data: imageData };
      } else {
        requestBody = imageData;
      }
      const response = await apiRequest('/face-recognition/register-face', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      return {
        success: response.success,
        message: response.message,
        details: response.details,
      };
    },

    registerFaceMulti: async (images: string[], opts: { consent?: boolean; challengeId?: string | null } = {}) => {
      const response = await apiRequest('/face-recognition/register-face-multi', {
        method: 'POST',
        body: JSON.stringify(compact({ images, consent: opts.consent, challenge_id: opts.challengeId || undefined })),
      });
      return {
        success: response.success,
        message: response.message,
        details: response.details,
      };
    },

    verifyFace: async (imageData: string) => {
      const response = await apiRequest('/face-recognition/verify-face', {
        method: 'POST',
        body: JSON.stringify({ image_data: imageData }),
      });
      return {
        valid: response.valid,
        message: response.message,
      };
    },

    getMyAttendance: async () => {
      const response = await apiRequest('/face-recognition/my-attendance');
      return (response as unknown[]).map((record: Record<string, unknown>) => ({
        id: record.id?.toString() || '',
        studentId: record.student_id?.toString() || '',
        subjectId: record.subject_id?.toString() || '',
        date: record.date?.toString() || '',
        status: (record.status?.toString() || 'absent') as Attendance['status'],
        confidenceScore: (record.confidence_score as number) || 0,
        markedBy: record.marked_by?.toString() || '',
      }));
    },

    detectFaces: async (imageData: string) => {
      const response = await apiRequest('/face-recognition/detect-faces', {
        method: 'POST',
        body: JSON.stringify({ image_data: imageData }),
      });
      return {
        success: response.success,
        message: response.message,
        faces_detected: response.faces_detected,
        faces: response.faces,
        feedback: response.feedback,
        ready_for_capture: response.ready_for_capture,
      };
    },
  },

  // Subjects methods
  subjects: {
    getAll: async (facultyId?: number) => {
      // Use trailing slash to avoid 307 redirect (which can drop Authorization header across proxy)
      const params = facultyId ? `?faculty_id=${facultyId}` : '';
      return apiRequest(`/subjects/${params}`);
    },

    getByFaculty: async (facultyId: number) => {
      return apiRequest(`/subjects/by-faculty?faculty_id=${facultyId}`);
    },

    getByFacultySemester: async (facultyId: number, semester?: number) => {
      const params = new URLSearchParams({ faculty_id: facultyId.toString() });
      if (semester) params.append('semester', semester.toString());
      return apiRequest(`/subjects/by-faculty-semester?${params}`);
    },

    create: async (subjectData: {
      name: string;
      code: string;
      description?: string;
      credits?: number;
      faculty_id?: number;
      class_schedule?: Record<string, unknown>;
    }) => {
      return apiRequest('/subjects/', {
        method: 'POST',
        body: JSON.stringify(subjectData),
      });
    },

    getById: async (subjectId: number) => {
      return apiRequest(`/subjects/${subjectId}`);
    },

    delete: async (subjectId: number) => {
      return apiRequest(`/subjects/${subjectId}`, { method: 'DELETE' });
    },
  },

  // Enhanced attendance methods for admins
  attendanceAdmin: {
    /** Same contract as `api.attendance.getStudentsBySubject`. */
    getStudentsBySubject: async (
      facultyId: number,
      semester: number,
      subjectId: number,
      date?: string,
      slot: { sessionId?: number | null; startTime?: string | null } = {}
    ) => {
      const params = new URLSearchParams({
        faculty_id: facultyId.toString(),
        semester: semester.toString(),
        subject_id: subjectId.toString(),
      });
      if (date) params.append('date', date);
      appendIfDefined(params, 'session_id', slot.sessionId);
      appendIfDefined(params, 'start_time', slot.startTime);
      return apiRequest(`/attendance/students-by-subject?${params}`);
    },

    /** Same contract as `api.attendance.markBulk`. */
    markBulkAttendance: async (attendanceData: {
      subject_id: number;
      date?: string;
      session_id?: number;
      start_time?: string;
      faculty_id?: number;
      semester?: number;
      students: Array<{ student_id: number; status: string; reason?: string }>;
    } & RegisterSubmitOptions): Promise<RegisterResult> => {
      return apiRequest('/attendance/mark-bulk', {
        method: 'POST',
        body: JSON.stringify(compact(attendanceData)),
      });
    },
  },

  // Faculties methods
  faculties: {
    getAll: async () => apiRequest('/faculties/'),
    create: async (facultyData: { name: string; code: string; description?: string }) =>
      apiRequest('/faculties/', { method: 'POST', body: JSON.stringify(facultyData) }),
    getCascadePreview: async (facultyId: number) => 
      apiRequest(`/faculties/${facultyId}/cascade-preview`),
    delete: async (facultyId: number, force: boolean = false) => 
      apiRequest(`/faculties/${facultyId}?force=${force}`, { method: 'DELETE' }),
  },

  // Schedules methods
  schedules: {
    /**
     * Today's classes for the logged-in student (server clock decides "today").
     * Returns just the class list; use `getStudentTodayContext` for `term_state`/`day_status`.
     */
    getStudentToday: async (): Promise<StudentTodayClass[]> => {
      const raw = await apiRequest('/schedules/student/today?envelope=true');
      return normalizeStudentToday(raw).classes;
    },

    /** Today's classes plus `term_state` and `day_status` (accepts list or object responses). */
    getStudentTodayContext: async (): Promise<StudentTodaySchedule> => {
      const raw = await apiRequest('/schedules/student/today?envelope=true');
      return normalizeStudentToday(raw);
    },

    getByFacultyAndSemester: async (facultyId: number, semester: number, dayOfWeek?: string) => {
      const params = new URLSearchParams({
        faculty_id: facultyId.toString(),
        semester: semester.toString(),
      });
      if (dayOfWeek) params.append('day_of_week', dayOfWeek);
      return apiRequest(`/schedules?${params}`);
    },

    getAll: async (filters: {
      faculty_id?: number | string;
      semester?: number | string;
      day_of_week?: string;
      academic_year?: number | string;
      is_active?: boolean | string;
      skip?: number;
      limit?: number;
    } = {}) => {
      const params = new URLSearchParams();
      if (filters.faculty_id !== undefined && filters.faculty_id !== 'all') params.append('faculty_id', String(filters.faculty_id));
      if (filters.semester !== undefined && filters.semester !== 'all') params.append('semester', String(filters.semester));
      if (filters.day_of_week && filters.day_of_week !== 'all') params.append('day_of_week', filters.day_of_week);
      if (filters.academic_year) params.append('academic_year', String(filters.academic_year));
      if (filters.is_active !== undefined && filters.is_active !== 'all') params.append('is_active', String(filters.is_active));
      if (typeof filters.skip === 'number') params.append('skip', String(filters.skip));
      if (typeof filters.limit === 'number') params.append('limit', String(filters.limit));
      const endpoint = params.toString() ? `/schedules?${params}` : '/schedules';
      return apiRequest(endpoint);
    },

    create: async (data: {
      subject_id: number;
      faculty_id: number;
      day_of_week: string;
      start_time: string;
      end_time: string;
      semester: number;
      academic_year: number;
      classroom?: string;
      instructor_name?: string;
      notes?: string;
    }) => {
      return apiRequest('/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: async (id: number, data: Partial<{
      subject_id: number;
      faculty_id: number;
      day_of_week: string;
      start_time: string;
      end_time: string;
      semester: number;
      academic_year: number;
      classroom?: string;
      instructor_name?: string;
      is_active?: boolean;
      notes?: string;
    }>) => {
      return apiRequest(`/schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: number) => {
      return apiRequest(`/schedules/${id}`, {
        method: 'DELETE',
      });
    },

    toggle: async (id: number) => {
      return apiRequest(`/schedules/${id}/toggle`, {
        method: 'POST',
      });
    },
  },

  // Dashboard and sidebar statistics
  dashboard: {
    getSidebarStats: async () => apiRequest('/sidebar/stats'),
    getDashboardStats: async () => apiRequest('/dashboard/stats'),
    getSystemHealth: async () => apiRequest('/system/health'),
    getStudentPerformance: async () => apiRequest('/student-performance/'),
    getRealtimeMetrics: async () => apiRequest('/realtime/metrics'),
  },



  // Student Attendance methods (comprehensive)
  studentAttendance: {
    /** §13.12 metrics (legacy fields + `percentage`/`has_data`/`eligible`/`band`/...). */
    getSummary: async (termId?: number): Promise<MetricsBlock & Record<string, any>> => {
      const params = new URLSearchParams();
      appendIfDefined(params, 'term_id', termId);
      return apiRequest(withQuery('/student-attendance/summary', params));
    },

    getRecords: async (filters: {
      startDate?: string;
      endDate?: string;
      subjectId?: number;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}) => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.subjectId) params.append('subject_id', filters.subjectId.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const endpoint = params.toString() ? `/student-attendance/records?${params}` : '/student-attendance/records';
      return apiRequest(endpoint);
    },

    /** Bare list by default; `envelope: true` → `{subjects, total_subjects, ...metric fields}`. */
    getSubjectBreakdown: async (termId?: number, options: { envelope?: boolean } = {}) => {
      const params = new URLSearchParams();
      appendIfDefined(params, 'term_id', termId);
      if (options.envelope) params.append('envelope', 'true');
      return apiRequest(withQuery('/student-attendance/subject-breakdown', params));
    },

    getAnalytics: async (period: string = 'semester', termId?: number) => {
      const params = new URLSearchParams({ period });
      appendIfDefined(params, 'term_id', termId);
      return apiRequest(withQuery('/student-attendance/analytics', params));
    },

    getGoals: async (termId?: number) => {
      const params = new URLSearchParams();
      appendIfDefined(params, 'term_id', termId);
      return apiRequest(withQuery('/student-attendance/goals', params));
    },
  },

  // Streaks & badges (metrics service backed)
  streaks: {
    getMyStreaks: async (periodDays: number = 180) =>
      apiRequest(`/streaks-badges/my-streaks?period_days=${periodDays}`),
    getMyBadges: async () => apiRequest('/streaks-badges/my-badges'),
  },

  // Academic Metrics methods
  academicMetrics: {
    getCurrentSemester: async () => {
      const response = await apiRequest('/academic-metrics/current-semester');
      // Handle wrapped response format: { success: true, data: {...}, semester_info: {...} }
      return response.data || response;
    },

    getSummary: async (startDate: string, endDate: string, semester?: number, academicYear?: number) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (semester) params.append('semester', semester.toString());
      if (academicYear) params.append('academic_year', academicYear.toString());
      return apiRequest(`/academic-metrics/summary?${params}`);
    },

    calculate: async (startDate: string, endDate: string, semester?: number, academicYear?: number) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (semester) params.append('semester', semester.toString());
      if (academicYear) params.append('academic_year', academicYear.toString());
      const response = await apiRequest(`/academic-metrics/calculate?${params}`);
      // Handle wrapped response format: { success: true, data: {...} }
      return response.data || response;
    },

    getDetailedBreakdown: async (startDate: string, endDate: string, semester?: number, academicYear?: number) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (semester) params.append('semester', semester.toString());
      if (academicYear) params.append('academic_year', academicYear.toString());
      const response = await apiRequest(`/academic-metrics/detailed-breakdown?${params}`);
      // Handle wrapped response format: { success: true, data: {...} }
      return response.data || response;
    },

    validateData: async (startDate: string, endDate: string) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      const response = await apiRequest(`/academic-metrics/validate-data?${params}`);
      // Handle wrapped response format: { success: true, validation: {...} }
      return response.validation || response;
    },
  },

  // Semester Configuration methods
  semesterConfiguration: {
    getAll: async () => {
      return apiRequest('/admin/semester-config/');
    },

    create: async (data: {
      semester_number: number;
      academic_year: number;
      semester_name: string;
      start_date: string;
      end_date: string;
      total_weeks?: number;
      exam_week_start?: string;
      exam_week_end?: string;
      is_current?: boolean;
      is_active?: boolean;
    }) => {
      return apiRequest('/admin/semester-config/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: async (id: number, data: {
      semester_number?: number;
      academic_year?: number;
      semester_name?: string;
      start_date?: string;
      end_date?: string;
      total_weeks?: number;
      exam_week_start?: string;
      exam_week_end?: string;
      is_current?: boolean;
      is_active?: boolean;
    }) => {
      return apiRequest(`/admin/semester-config/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: number) => {
      return apiRequest(`/admin/semester-config/${id}`, {
        method: 'DELETE',
      });
    },

    setCurrent: async (id: number) => {
      return apiRequest(`/admin/semester-config/${id}/set-current`, {
        method: 'POST',
      });
    },
  },

  /**
   * Terms (academic periods) CRUD — contract v1 (admin). `is_current`/`state` are
   * computed from dates by the server. Validation errors → 400 `{detail}`,
   * overlaps → 409; use `parseApiError(err).message` to display them.
   */
  semesterConfig: {
    list: async (): Promise<SemesterConfig[]> => {
      const res = await apiRequest('/admin/semester-config/');
      if (Array.isArray(res)) return res as SemesterConfig[];
      const items = res?.items ?? res?.terms ?? res?.data;
      return Array.isArray(items) ? (items as SemesterConfig[]) : [];
    },

    /** Current term, or `{term: null, term_state}` when between terms (server answers 404). */
    getCurrent: async (): Promise<CurrentTermResult> => {
      try {
        const res = await apiRequest('/admin/semester-config/current');
        if (!res) return { term: null, term_state: 'between_terms' };
        const term = (res.term ?? res) as SemesterConfig;
        return { term: term?.id ? term : null, term_state: (res.term_state as TermState) || (term?.id ? 'active' : 'between_terms') };
      } catch (err) {
        const info = parseApiError(err);
        if (info.status === 404) {
          const state = getErrorDetailField<TermState>(info, 'term_state') ?? 'between_terms';
          return { term: null, term_state: state };
        }
        throw err;
      }
    },

    get: async (id: number): Promise<SemesterConfig> => apiRequest(`/admin/semester-config/${id}`),

    create: async (data: SemesterConfigInput): Promise<SemesterConfig> =>
      apiRequest('/admin/semester-config/', { method: 'POST', body: JSON.stringify(compact({ ...data })) }),

    update: async (id: number, data: SemesterConfigUpdate): Promise<SemesterConfig> =>
      apiRequest(`/admin/semester-config/${id}`, { method: 'PUT', body: JSON.stringify(compact({ ...data })) }),

    /** Soft-deactivates the term (`DELETE`); terms are never hard-deleted. */
    deactivate: async (id: number): Promise<void> => {
      await apiRequest(`/admin/semester-config/${id}`, { method: 'DELETE' });
    },
  },

  /** Attendance policy (any authenticated user). Cached in memory for 5 minutes. */
  attendancePolicy: {
    get: async (options: { force?: boolean } = {}): Promise<AttendancePolicy> => {
      if (!options.force && policyCache && Date.now() - policyCache.at < POLICY_TTL_MS) {
        return policyCache.value;
      }
      if (!options.force && policyInflight) return policyInflight;
      policyInflight = (async () => {
        try {
          const raw = await apiRequest('/system-settings/attendance-policy');
          const value = normalizePolicy((raw ?? {}) as Record<string, unknown>);
          policyCache = { value, at: Date.now() };
          return value;
        } finally {
          policyInflight = null;
        }
      })();
      return policyInflight;
    },

    /** Drops the cached policy (call after an admin edits settings/thresholds/terms). */
    invalidate: (): void => {
      policyCache = null;
    },
  },

  /** Class sessions — contract v1 (`/attendance/sessions*`). */
  sessions: {
    /** Current rotating check-in code for a session (teacher of the session / admin). */
    getPresenceCode: async (sessionId: number): Promise<PresenceCodeInfo> => {
      return apiRequest(`/attendance/sessions/${sessionId}/presence-code`);
    },

    /** Face check-in attempts for a session, newest first (teacher of the session / admin). */
    getFaceAttempts: async (sessionId: number): Promise<FaceAttemptsResponse> => {
      const res = await apiRequest(`/attendance/sessions/${sessionId}/face-attempts`);
      return {
        session_id: res?.session_id ?? sessionId,
        attempts: Array.isArray(res?.attempts) ? (res.attempts as FaceAttempt[]) : [],
        summary: res?.summary ?? { total: 0, successes: 0, failures: 0, by_outcome: {} },
      };
    },

    /** Past sessions nobody recorded + sessions flagged for review (admin: all; teacher: own). */
    listUnrecorded: async (
      range: { from?: string; to?: string; limit?: number; offset?: number } = {}
    ): Promise<UnrecordedSessionsResponse> => {
      const params = new URLSearchParams();
      appendIfDefined(params, 'from', range.from);
      appendIfDefined(params, 'to', range.to);
      appendIfDefined(params, 'limit', range.limit);
      appendIfDefined(params, 'offset', range.offset);
      const res = await apiRequest(withQuery('/attendance/sessions/unrecorded', params));
      const sessions = Array.isArray(res?.sessions) ? (res.sessions as UnrecordedSession[]) : Array.isArray(res) ? (res as UnrecordedSession[]) : [];
      return {
        sessions,
        schedules_without_teacher: toNum(res?.schedules_without_teacher, 0),
        total: toNum(res?.total, sessions.length),
        limit: toNum(res?.limit, sessions.length),
        offset: toNum(res?.offset, 0),
        has_more: Boolean(res?.has_more),
      };
    },

    /** Sessions for a date (materialized on demand) with status + counts. */
    list: async (filters: SessionListFilters = {}): Promise<ClassSessionInfo[]> => {
      const params = new URLSearchParams();
      appendIfDefined(params, 'date', filters.date);
      appendIfDefined(params, 'faculty_id', filters.faculty_id);
      appendIfDefined(params, 'semester', filters.semester);
      appendIfDefined(params, 'subject_id', filters.subject_id);
      const res = await apiRequest(withQuery('/attendance/sessions', params));
      if (Array.isArray(res)) return res as ClassSessionInfo[];
      return Array.isArray(res?.sessions) ? (res.sessions as ClassSessionInfo[]) : [];
    },

    /** Register for one session; unmarked students have `status: null`. */
    getRegister: async (sessionId: number): Promise<SessionRegister> =>
      apiRequest(`/attendance/sessions/${sessionId}/register`),

    /**
     * Register submission (send only changed rows). Errors: 400 `invalid_entries`
     * (per-row `errors`), 409 `confirm_held` / `session_cancelled`.
     */
    submitRegister: async (sessionId: number, body: RegisterSubmission): Promise<RegisterResult> =>
      apiRequest(`/attendance/sessions/${sessionId}/register`, {
        method: 'POST',
        body: JSON.stringify(compact({ ...body })),
      }),

    cancel: async (sessionId: number, reason: string): Promise<ClassSessionInfo & Record<string, unknown>> =>
      apiRequest(`/attendance/sessions/${sessionId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

    uncancel: async (sessionId: number, reason: string): Promise<ClassSessionInfo & Record<string, unknown>> =>
      apiRequest(`/attendance/sessions/${sessionId}/uncancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

    /** Admin: keep a session flagged `review_required` by a calendar change (reason required, audited). */
    clearReview: async (sessionId: number, reason: string): Promise<{ success: boolean; session: ClassSessionInfo }> =>
      apiRequest(`/attendance/sessions/${sessionId}/clear-review`, { method: 'POST', body: JSON.stringify({ reason }) }),

    createMakeup: async (input: MakeupSessionInput): Promise<ClassSessionInfo & Record<string, unknown>> =>
      apiRequest('/attendance/sessions/makeup', { method: 'POST', body: JSON.stringify(compact({ ...input })) }),
  },

  /** Individual attendance records (admin tooling). */
  records: {
    /** Include/exclude a record from metrics (admin; reason required, audited). */
    setMetricsExclusion: async (recordId: number, excluded: boolean, reason: string) =>
      apiRequest(`/attendance/records/${recordId}/metrics-exclusion`, {
        method: 'PATCH',
        body: JSON.stringify({ excluded, reason }),
      }),

    getAudit: async (recordId: number): Promise<AttendanceAuditEntry[]> => {
      const res = await apiRequest(`/attendance/records/${recordId}/audit`);
      if (Array.isArray(res)) return res as AttendanceAuditEntry[];
      return Array.isArray(res?.entries) ? (res.entries as AttendanceAuditEntry[]) : [];
    },
  },

  /** Automatic absence finalization (admin). */
  autoAbsent: {
    /** Runs the finalizer now; optional `date` (YYYY-MM-DD, within the active term, ≤30 days back). */
    trigger: async (date?: string): Promise<AutoAbsentTriggerResult> =>
      apiRequest('/auto-absent/trigger', {
        method: 'POST',
        body: JSON.stringify(date ? { date } : {}),
      }),

    status: async (): Promise<AutoAbsentStatus> => apiRequest('/auto-absent/status'),

    runs: async (limit: number = 20): Promise<JobRun[]> => {
      const res = await apiRequest(`/auto-absent/runs?limit=${limit}`);
      if (Array.isArray(res)) return res as JobRun[];
      const runs = res?.runs ?? res?.items ?? res?.job_runs;
      return Array.isArray(runs) ? (runs as JobRun[]) : [];
    },
  },

  // Analytics methods
  analytics: {
    getStudentInsights: async (studentId: number) => {
      return apiRequest(`/analytics/student-insights/${studentId}`);
    },

    getAttendanceTrends: async (studentId?: number, days: number = 30) => {
      const params = new URLSearchParams();
      if (studentId) params.append('student_id', studentId.toString());
      if (days !== 30) params.append('days', days.toString());
      const endpoint = params.toString() ? `/analytics/attendance-trends?${params}` : '/analytics/attendance-trends';
      return apiRequest(endpoint);
    },

    getClassAverages: async (classId?: number) => {
      const params = new URLSearchParams();
      if (classId) params.append('class_id', classId.toString());
      const endpoint = params.toString() ? `/analytics/class-averages?${params}` : '/analytics/class-averages';
      return apiRequest(endpoint);
    },
  },

  // System Settings methods
  systemSettings: {
    getAttendanceThresholds: async (activeOnly: boolean = true) => {
      const params = activeOnly ? '?active_only=true' : '';
      return apiRequest(`/system-settings/attendance-thresholds${params}`);
    },

    getAttendanceThreshold: async (id: number) => {
      return apiRequest(`/system-settings/attendance-thresholds/${id}`);
    },

    updateAttendanceThreshold: async (id: number, data: any) => {
      return apiRequest(`/system-settings/attendance-thresholds/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    createAttendanceThreshold: async (data: any) => {
      return apiRequest(`/system-settings/attendance-thresholds`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    deleteAttendanceThreshold: async (id: number) => {
      return apiRequest(`/system-settings/attendance-thresholds/${id}`, {
        method: 'DELETE',
      });
    },

    resetAttendanceThresholds: async () => {
      return apiRequest(`/system-settings/attendance-thresholds/reset`, {
        method: 'POST',
      });
    },

    getSettings: async (category?: string) => {
      const params = category ? `?category=${category}` : '';
      return apiRequest(`/system-settings/settings${params}`);
    },

    getSetting: async (key: string) => {
      return apiRequest(`/system-settings/settings/${key}`);
    },

    /** Admin: the full face verification policy (`face_verification` setting). */
    getFacePolicy: async (): Promise<Partial<FacePolicySettings>> => {
      try {
        const res = await apiRequest('/system-settings/settings/face_verification');
        return (res?.value ?? {}) as Partial<FacePolicySettings>;
      } catch (err) {
        if (parseApiError(err).status === 404) return {};
        throw err;
      }
    },

    /** Admin: partial update, merged server-side; 400 with a message for invalid values. */
    updateFacePolicy: async (value: Partial<FacePolicySettings>): Promise<Partial<FacePolicySettings>> => {
      const res = await apiRequest('/system-settings/settings/face_verification', {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
      return (res?.value ?? {}) as Partial<FacePolicySettings>;
    },
  },

  // Teacher Dashboard methods
  teacher: {
    getDashboard: async () => {
      return apiRequest('/teacher/dashboard');
    },

    getSchedule: async (dayOfWeek?: string) => {
      const params = dayOfWeek ? `?day_of_week=${dayOfWeek}` : '';
      return apiRequest(`/teacher/schedule${params}`);
    },

    getSubjectStudents: async (subjectId: number, semester: number, facultyId?: number) => {
      const params = new URLSearchParams();
      params.append('semester', semester.toString());
      if (facultyId) params.append('faculty_id', facultyId.toString());
      return apiRequest(`/teacher/subjects/${subjectId}/students?${params}`);
    },

    /**
     * Register view for a subject/date. Unmarked students have `attendance_status: null`.
     * Includes `session` (+ `sessions` when the subject has several slots that day —
     * pass `sessionId` to pick one).
     */
    getSubjectStudentsWithAttendance: async (
      subjectId: number,
      semester: number,
      date?: string,
      sessionId?: number | null
    ): Promise<TeacherRosterResponse> => {
      const params = new URLSearchParams();
      params.append('semester', semester.toString());
      if (date) params.append('date', date);
      appendIfDefined(params, 'session_id', sessionId);
      return apiRequest(`/teacher/subjects/${subjectId}/students-with-attendance?${params}`);
    },

    getSubjectAttendance: async (subjectId: number, startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const query = params.toString() ? `?${params}` : '';
      return apiRequest(`/teacher/subjects/${subjectId}/attendance${query}`);
    },

    getSubjectAnalytics: async (subjectId: number, semester: number, termId?: number) => {
      const params = new URLSearchParams({ semester: String(semester) });
      appendIfDefined(params, 'term_id', termId);
      return apiRequest(`/teacher/subjects/${subjectId}/analytics?${params}`);
    },

    getProfile: async () => {
      return apiRequest('/teachers/me');
    },

    updateProfile: async (data: any) => {
      return apiRequest('/teachers/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    // Attendance marking endpoints
    getMyClasses: async () => {
      return apiRequest('/teacher/attendance/my-classes');
    },

    /** Single-record write; may answer 409 `confirm_held` (resend with `confirm_held: true`). */
    markAttendance: async (data: {
      student_id: number;
      subject_id: number;
      date: string;
      status: string;
      period?: number;
      time_slot?: string;
      notes?: string;
      session_id?: number;
      reason?: string;
      confirm_held?: boolean;
    }) => {
      return apiRequest('/teacher/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(compact({ ...data })),
      });
    },

    /**
     * Register submission (send only changed rows). Errors: 400 `invalid_entries`
     * (per-row `errors`), 409 `confirm_held` (`students_without_record`) or
     * `session_cancelled`. Use `parseApiError` to read them.
     */
    bulkMarkAttendance: async (data: {
      subject_id: number;
      semester: number;
      faculty_id: number;
      date: string;
      period?: number;
      time_slot?: string;
      session_id?: number;
      attendance_records: Array<{ student_id: number; status: string; reason?: string }>;
    } & RegisterSubmitOptions): Promise<RegisterResult> => {
      return apiRequest('/teacher/attendance/bulk-mark', {
        method: 'POST',
        body: JSON.stringify(compact({ ...data })),
      });
    },

    // Calendar endpoints (view-only)
    getCalendar: async (startDate: string, endDate: string) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      return apiRequest(`/teacher/calendar?${params}`);
    },

    // Notification endpoints
    sendNotification: async (data: {
      title: string;
      message: string;
      subject_id: number;
      semester: number;
      priority?: string;
      type?: string;
    }) => {
      return apiRequest('/teacher/notifications/send', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getNotifications: async (skip: number = 0, limit: number = 50) => {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      return apiRequest(`/teacher/notifications?${params}`);
    },

    // Inbox endpoints (per-user)
    getInbox: async (onlyUnread: boolean = true, skip: number = 0, limit: number = 20) => {
      const params = new URLSearchParams({
        only_unread: String(onlyUnread),
        skip: String(skip),
        limit: String(limit),
      });
      return apiRequest(`/teacher/notifications/inbox?${params}`);
    },

    markRead: async (notificationId: number) => {
      return apiRequest(`/teacher/notifications/${notificationId}/read`, {
        method: 'POST',
      });
    },

    clearOne: async (notificationId: number) => {
      return apiRequest(`/teacher/notifications/${notificationId}/clear`, {
        method: 'POST',
      });
    },

    clearAll: async () => {
      return apiRequest(`/teacher/notifications/clear`, {
        method: 'POST',
      });
    },

    // Class cancellation (session-level; pass session_id when known)
    cancelClass: async (data: {
      schedule_id?: number;
      session_id?: number;
      date: string;
      reason?: string;
      notify_students?: boolean;
    }) => {
      return apiRequest('/teacher/classes/cancel', {
        method: 'POST',
        body: JSON.stringify(
          compact({
            schedule_id: data.schedule_id,
            session_id: data.session_id,
            date: data.date,
            reason: data.reason?.trim() || 'Teacher unavailable',
            notify_students: data.notify_students !== false, // Default true
          })
        ),
      });
    },

    /** Restores a cancelled session (`session_id`, or `subject_id` + `date`); reason required. */
    uncancelClass: async (data: {
      session_id?: number;
      schedule_id?: number;
      subject_id?: number;
      date?: string;
      reason: string;
    }) => {
      return apiRequest('/teacher/classes/uncancel', {
        method: 'POST',
        body: JSON.stringify(compact({ ...data })),
      });
    },
  },

  // Teachers Admin methods (for admin panel teacher management)
  teachers: {
    getAll: async (facultyId?: number) => {
      const params = facultyId ? `?faculty_id=${facultyId}` : '';
      return apiRequest(`/teachers/${params}`);
    },

    getById: async (id: number) => {
      return apiRequest(`/teachers/${id}`);
    },

    create: async (data: {
      user: { email: string; full_name: string; password: string };
      teacher_id?: string; // optional: server will auto-generate when omitted
      name: string;
      faculty_id?: number;
      department?: string;
      phone_number?: string;
      office_location?: string;
    }) => {
      // Omit undefined to keep payload clean
      const payload: any = { ...data };
      if (!payload.teacher_id) delete payload.teacher_id;
      return apiRequest('/teachers/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    update: async (id: number, data: {
      /** Display name; also updates the login's full name. */
      name?: string;
      faculty_id?: number;
      department?: string;
      phone_number?: string;
      office_location?: string;
    }) => {
      return apiRequest(`/teachers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: number) => {
      return apiRequest(`/teachers/${id}`, {
        method: 'DELETE',
      });
    },

    // Subject assignment management
    getAssignments: async (teacherId: number) => {
      return apiRequest(`/teachers/${teacherId}/assignments`);
    },

    addAssignment: async (teacherId: number, scheduleId: number) => {
      return apiRequest(`/teachers/${teacherId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ schedule_id: scheduleId }),
      });
    },

    removeAssignment: async (teacherId: number, scheduleId: number) => {
      return apiRequest(`/teachers/${teacherId}/assignments/${scheduleId}`, {
        method: 'DELETE',
      });
    },

    getUnassignedSchedules: async (facultyId?: number, semester?: number) => {
      const params = new URLSearchParams();
      if (facultyId) params.append('faculty_id', facultyId.toString());
      if (semester) params.append('semester', semester.toString());
      const query = params.toString() ? `?${params}` : '';
      return apiRequest(`/teachers/schedules/unassigned${query}`);
    },

    getCount: async (facultyId?: number) => {
      const params = facultyId ? `?faculty_id=${facultyId}` : '';
      return apiRequest(`/teachers/stats/count${params}`);
    },
  },
};

// Helper client for services that need axios-like interface
export const apiClient = {
  get: async <T = any>(path: string): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path);
    return { data };
  },
  post: async <T = any>(path: string, body?: any): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  put: async <T = any>(path: string, body?: any): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  delete: async <T = any>(path: string): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, { method: 'DELETE' });
    return { data };
  },
};

// Local type to satisfy register function without importing from elsewhere
// RegisterData imported from './types'
