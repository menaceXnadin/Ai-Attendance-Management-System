/**
 * Null-safe display helpers for attendance metrics (DOMAIN_RULES §8 / §13.12).
 *
 * The server is the only place percentages, eligibility and bands are computed.
 * These helpers only *read* what the server sent (preferring the §13.12 fields
 * `percentage` / `has_data` / `eligible` / `band` and falling back to legacy
 * numeric fields) and map it to text / design-token classes. They never divide.
 */
import type { AttendanceBand, AttendancePolicy, TermState } from '@/integrations/api/client';

export type MetricTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface DisplayMetrics {
  /** `null` = no countable classes yet (render "—" / "No classes yet", never 0%). */
  percentage: number | null;
  hasData: boolean;
  considered: number | null;
  attended: number | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unrecorded: number;
  /** Server eligibility; `null` when unknown/no data. */
  eligible: boolean | null;
  provisional: boolean;
  band: string | null;
  bandLabel: string | null;
  termState: TermState | null;
}

type Raw = object | null | undefined;

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const count = (v: unknown): number => num(v) ?? 0;

/**
 * Reads a metrics block. `legacyPercentKeys` lists legacy numeric percentage
 * fields to try (in order) when the server did not send `percentage`.
 */
export const readMetrics = (
  raw: Raw,
  legacyPercentKeys: string[] = ['percentage_present', 'attendance_rate', 'attendance_percentage']
): DisplayMetrics => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const present = count(r.present ?? r.present_classes ?? r.present_count);
  const late = count(r.late ?? r.late_classes ?? r.late_count);
  const absent = count(r.absent ?? r.absent_classes ?? r.absent_count);
  const considered = num(r.considered);

  let percentage: number | null;
  let hasData: boolean;
  if ('percentage' in r) {
    percentage = num(r.percentage);
    hasData = typeof r.has_data === 'boolean' ? r.has_data : percentage !== null;
    if (!hasData) percentage = null;
  } else {
    // Legacy response: legacy numeric fields are 0 when there is no data, so only
    // trust them when the server reports at least one counted class.
    const legacyPct = legacyPercentKeys.map((k) => num(r[k])).find((v) => v !== null) ?? null;
    const total = considered ?? num(r.total_classes) ?? num(r.total) ?? present + late + absent;
    hasData = typeof r.has_data === 'boolean' ? r.has_data : total > 0;
    percentage = hasData ? legacyPct : null;
  }

  return {
    percentage,
    hasData,
    considered,
    attended: num(r.attended),
    present,
    late,
    absent,
    excused: count(r.excused),
    unrecorded: count(r.unrecorded),
    eligible: typeof r.eligible === 'boolean' ? r.eligible : null,
    provisional: r.eligibility_provisional === true,
    band: typeof r.band === 'string' ? r.band : null,
    bandLabel: typeof r.band_label === 'string' ? r.band_label : null,
    termState: (r.term_state as TermState | undefined) ?? null,
  };
};

/** "86.5%" or "—" for null/NaN. Never calls `.toFixed` on null. */
export const formatPercent = (pct: number | null | undefined, digits = 1): string => {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  const fixed = pct.toFixed(digits);
  return `${digits > 0 ? fixed.replace(/\.0+$/, '') : fixed}%`;
};

/** Clamp for progress bars; null → 0 width. */
export const barWidth = (pct: number | null | undefined): number =>
  pct === null || pct === undefined || !Number.isFinite(pct) ? 0 : Math.min(100, Math.max(0, pct));

/** Band containing `pct` from policy bands (sorted best-first, half-open `[min, max)`). */
export const bandFor = (pct: number | null | undefined, bands: AttendanceBand[] | undefined): AttendanceBand | null => {
  if (pct === null || pct === undefined || !Number.isFinite(pct) || !bands?.length) return null;
  return bands.find((b) => pct >= b.min) ?? bands[bands.length - 1];
};

const KNOWN_BAND_TONES: Record<string, MetricTone> = {
  excellent: 'success',
  good: 'success',
  warning: 'warning',
  at_risk: 'warning',
  'at-risk': 'warning',
  critical: 'error',
};

/**
 * Tone for a band: bands at/above the top band boundary → success; the band whose
 * lower bound equals the policy minimum ("at risk") → warning; below minimum → error.
 */
export const toneForBand = (band: AttendanceBand | null, policy: AttendancePolicy | undefined): MetricTone => {
  if (!band) return 'neutral';
  if (policy) {
    if (band.min < policy.minimum_percentage) return 'error';
    const aboveMin = policy.bands.filter((b) => b.min >= policy.minimum_percentage);
    const lowestAboveMin = aboveMin[aboveMin.length - 1];
    if (lowestAboveMin && lowestAboveMin.name === band.name && aboveMin.length > 1) return 'warning';
    return 'success';
  }
  return KNOWN_BAND_TONES[band.name.toLowerCase()] ?? 'neutral';
};

/** Resolves the band for a metrics block: server `band` first, else classify the server percentage. */
export const resolveBand = (m: DisplayMetrics, policy: AttendancePolicy | undefined): AttendanceBand | null => {
  if (!m.hasData) return null;
  if (m.band) {
    const fromPolicy = policy?.bands.find((b) => b.name === m.band);
    if (fromPolicy) return fromPolicy;
    return { name: m.band, label: m.bandLabel || m.band, min: Number.NaN, max: null };
  }
  return bandFor(m.percentage, policy?.bands);
};

/** Tone for a metrics block (neutral when there is no data). */
export const metricTone = (m: DisplayMetrics, policy: AttendancePolicy | undefined): MetricTone => {
  if (!m.hasData) return 'neutral';
  const band = resolveBand(m, policy);
  if (band && Number.isNaN(band.min)) return KNOWN_BAND_TONES[band.name.toLowerCase()] ?? 'neutral';
  return toneForBand(band, policy);
};

/** Tone for a bare server percentage (legacy rows without `band`). */
export const percentTone = (pct: number | null | undefined, policy: AttendancePolicy | undefined): MetricTone =>
  toneForBand(bandFor(pct, policy?.bands), policy);

/** Eligibility: server value, else (legacy) server percentage vs policy minimum. */
export const meetsMinimum = (m: DisplayMetrics, policy: AttendancePolicy | undefined): boolean | null => {
  if (m.eligible !== null) return m.eligible;
  if (!m.hasData || m.percentage === null || !policy) return null;
  return m.percentage >= policy.minimum_percentage;
};

export const TONE_TEXT: Record<MetricTone, string> = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  error: 'text-status-error',
  info: 'text-status-info',
  neutral: 'text-text-muted',
};

export const TONE_FILL: Record<MetricTone, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  error: 'bg-status-error',
  info: 'bg-status-info',
  neutral: 'bg-border-default',
};

export const TONE_CSS_VAR: Record<MetricTone, string> = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)',
  info: 'var(--status-info)',
  neutral: 'var(--border-default)',
};

export const TONE_BADGE: Record<MetricTone, 'success' | 'warning' | 'destructive' | 'info' | 'secondary'> = {
  success: 'success',
  warning: 'warning',
  error: 'destructive',
  info: 'info',
  neutral: 'secondary',
};

/** Local calendar date as YYYY-MM-DD (never `toISOString()`, which is UTC). */
export const localDateString = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Parses YYYY-MM-DD as a *local* date (avoids the UTC shift of `new Date('YYYY-MM-DD')`). */
export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
