/**
 * Null-safe metric display helpers (DOMAIN_RULES §8, §13.12).
 *
 * The server is authoritative for every percentage, band and eligibility value.
 * These helpers only *read* what the server sent (preferring the §13.12 fields
 * `percentage` / `has_data` / `band` / `eligible`) and format it. They never
 * compute a percentage or subtract excused classes on the client.
 */
import type { AttendanceBand, AttendancePolicy } from '@/integrations/api/client';
import { useAttendancePolicy as useBaseAttendancePolicy } from '@/hooks/useAttendancePolicy';

export const NO_DATA = '—';

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** "82.5%" or "—" (never `toFixed` on null/undefined/NaN). */
export const formatPercent = (value: unknown, digits = 1): string =>
  isFiniteNumber(value) ? `${value.toFixed(digits)}%` : NO_DATA;

/** Plain count or "—". */
export const formatCount = (value: unknown): string => (isFiniteNumber(value) ? String(value) : NO_DATA);

/** Any metrics-like object (interfaces included); read defensively. */
type Loose = object | null | undefined;

const asRecord = (block: Loose): Record<string, unknown> | null =>
  block && typeof block === 'object' ? (block as Record<string, unknown>) : null;

const firstNumber = (obj: Record<string, unknown>, keys: readonly string[]): number | undefined => {
  for (const key of keys) {
    const v = obj[key];
    if (isFiniteNumber(v)) return v;
  }
  return undefined;
};

const LEGACY_PERCENT_KEYS = ['percentage_present', 'attendance_percentage', 'attendance_rate', 'rate'] as const;
const TOTAL_KEYS = ['considered', 'total_classes', 'totalClasses', 'total_records', 'total'] as const;

/**
 * Reads the display percentage from a metrics block.
 * - `has_data === false` or `percentage === null` → `null` ("—").
 * - `has_data === true` → `percentage` (falls back to legacy fields).
 * - Legacy-only payloads: a zero denominator means "no data" (legacy fields
 *   report 0 there, which must not render as 0% / critical).
 */
export const resolvePercentage = (input: Loose, extraLegacyKeys: readonly string[] = []): number | null => {
  const block = asRecord(input);
  if (!block) return null;
  if (block.has_data === false) return null;
  if ('percentage' in block && block.percentage === null) return null;
  const legacyKeys = [...extraLegacyKeys, ...LEGACY_PERCENT_KEYS];
  if (block.has_data === true) {
    if (isFiniteNumber(block.percentage)) return block.percentage;
    return firstNumber(block, legacyKeys) ?? null;
  }
  const total = firstNumber(block, TOTAL_KEYS);
  if (total === 0) return null;
  if (isFiniteNumber(block.percentage)) return block.percentage;
  return firstNumber(block, legacyKeys) ?? null;
};

/** True when the server says (or the legacy payload implies) there is nothing to count. */
export const hasNoData = (block: Loose): boolean => resolvePercentage(block) === null;

/* -------------------------------------------------------------------------- */
/* Policy                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Display fallback used only until the policy endpoint answers (or if it is
 * unreachable). Mirrors the documented server defaults (DOMAIN_RULES §2).
 */
export const FALLBACK_POLICY_BANDS: AttendanceBand[] = [
  { name: 'excellent', label: 'Excellent', min: 90, max: null },
  { name: 'good', label: 'Good', min: 85, max: 90 },
  { name: 'warning', label: 'At risk', min: 75, max: 85 },
  { name: 'critical', label: 'Critical', min: 0, max: 75 },
];

export interface PolicyView {
  policy: AttendancePolicy | null;
  minimum: number;
  bands: AttendanceBand[];
  isLoading: boolean;
  isFallback: boolean;
}

/** Attendance policy (minimum %, bands, term state) from `GET /system-settings/attendance-policy`. */
export const useAttendancePolicy = (): PolicyView => {
  const query = useBaseAttendancePolicy();
  const policy = query.data ?? null;
  const bands = policy?.bands?.length ? policy.bands : FALLBACK_POLICY_BANDS;
  const minimum = isFiniteNumber(policy?.minimum_percentage) ? policy!.minimum_percentage : 75;
  return { policy, minimum, bands, isLoading: query.isLoading, isFallback: !policy };
};

/** Band containing `pct` (half-open `[min, max)`), or null when there is no data. */
export const bandForPercentage = (pct: number | null | undefined, bands: AttendanceBand[]): AttendanceBand | null => {
  if (!isFiniteNumber(pct)) return null;
  return (
    bands.find((b) => pct >= b.min && (b.max === null || b.max === undefined || pct < b.max)) ??
    null
  );
};

export interface BandView {
  name: string;
  label: string;
  tone: 'success' | 'brand' | 'warning' | 'destructive' | 'secondary';
}

const toneForBand = (band: AttendanceBand, bands: AttendanceBand[], minimum: number): BandView['tone'] => {
  const n = band.name.toLowerCase();
  if (n === 'critical' || n === 'danger') return 'destructive';
  if (n === 'warning' || n === 'at_risk' || n === 'at-risk' || n === 'atrisk') return 'warning';
  if (n === 'excellent') return 'brand';
  if (n === 'good') return 'success';
  if (band.min < minimum) return 'destructive';
  if (band.min === minimum) return 'warning';
  const top = bands.reduce<AttendanceBand | null>((acc, b) => (acc === null || b.min > acc.min ? b : acc), null);
  return top && top.name === band.name ? 'brand' : 'success';
};

/**
 * Band for a metrics block: the server's `band` name when present, otherwise the
 * policy band containing the server percentage. `null` when there is no data.
 */
export const resolveBand = (
  input: Loose,
  policyView: Pick<PolicyView, 'bands' | 'minimum'>,
  pct: number | null = resolvePercentage(input)
): BandView | null => {
  const block = asRecord(input);
  const { bands, minimum } = policyView;
  const serverName = block && typeof block.band === 'string' && block.band ? block.band : null;
  if (pct === null && !serverName) return null;
  if (block && block.has_data === false) return null;
  const band =
    (serverName && bands.find((b) => b.name.toLowerCase() === serverName.toLowerCase())) ||
    bandForPercentage(pct, bands);
  if (!band) {
    if (!serverName) return null;
    const label =
      (block && typeof block.band_label === 'string' && block.band_label) ||
      serverName.charAt(0).toUpperCase() + serverName.slice(1).replace(/_/g, ' ');
    return { name: serverName, label, tone: 'secondary' };
  }
  const label = (block && typeof block.band_label === 'string' && block.band_label) || band.label || band.name;
  return { name: band.name, label, tone: toneForBand(band, bands, minimum) };
};

/** Tailwind token classes for a band tone (bars, chips). */
export const toneClasses: Record<BandView['tone'], { text: string; bar: string; chip: string; pill: string }> = {
  success: {
    text: 'text-status-success',
    bar: 'bg-status-success',
    chip: 'bg-status-success-subtle text-status-success',
    pill: 'border-status-success-border bg-status-success-subtle text-status-success',
  },
  brand: {
    text: 'text-brand-foreground',
    bar: 'bg-brand',
    chip: 'bg-brand-subtle text-brand-foreground',
    pill: 'border-brand-stroke bg-brand-subtle text-brand-foreground',
  },
  warning: {
    text: 'text-status-warning',
    bar: 'bg-status-warning',
    chip: 'bg-status-warning-subtle text-status-warning',
    pill: 'border-status-warning-border bg-status-warning-subtle text-status-warning',
  },
  destructive: {
    text: 'text-status-error',
    bar: 'bg-status-error',
    chip: 'bg-status-error-subtle text-status-error',
    pill: 'border-status-error-border bg-status-error-subtle text-status-error',
  },
  secondary: {
    text: 'text-text-muted',
    bar: 'bg-border-strong',
    chip: 'bg-surface-subtle text-text-muted',
    pill: 'border-border-default bg-surface-subtle text-text-secondary',
  },
};

/** Eligibility as reported by the server (`eligible` true/false/null + provisional flag). */
export const describeEligibility = (input: Loose): { label: string; tone: BandView['tone'] } | null => {
  const block = asRecord(input);
  if (!block || !('eligible' in block)) return null;
  const provisional = block.eligibility_provisional === true;
  if (block.eligible === true) return { label: provisional ? 'Eligible (provisional)' : 'Eligible', tone: 'success' };
  if (block.eligible === false) return { label: provisional ? 'Not eligible (provisional)' : 'Not eligible', tone: 'destructive' };
  return { label: 'No data yet', tone: 'secondary' };
};
