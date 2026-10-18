import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowCounterclockwise16Regular,
  Camera20Regular,
  CheckmarkCircle16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  ErrorCircle16Regular,
  LockClosed20Regular,
  PersonArrowRight20Regular,
  QrCode20Regular,
  Save16Regular,
  ScanPerson20Regular,
  ShieldCheckmark20Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { MessageBar } from '@/components/attendance-admin/shared';
import { api, parseApiError, type FacePolicySettings } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FACE_POLICY_DEFAULTS } from './faceLabels';

/* -------------------------------------------------------------------------- */
/* Field definitions (docs/system/face-verification.md §4)                     */
/* -------------------------------------------------------------------------- */

type PolicyKey = keyof FacePolicySettings;
type BoolKey = { [K in PolicyKey]: FacePolicySettings[K] extends boolean ? K : never }[PolicyKey];

interface NumberField {
  kind: 'number';
  key: PolicyKey;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  unit?: string;
}

interface ToggleField {
  kind: 'toggle';
  key: BoolKey;
  label: string;
  help: string;
  /** Shown while the toggle is off. */
  offWarning?: string;
}

type FieldDef = NumberField | ToggleField;

interface GroupDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: FieldDef[];
}

const GROUPS: GroupDef[] = [
  {
    id: 'liveness',
    title: 'Liveness',
    description: 'Passive anti-spoofing that rejects photos and screens held up to the camera.',
    icon: <ShieldCheckmark20Regular />,
    fields: [
      {
        kind: 'toggle',
        key: 'require_liveness',
        label: 'Require liveness check',
        help: 'Runs the anti-spoofing model on every check-in and enrolment.',
        offWarning: 'With liveness off, a printed photo or a phone screen showing the student can pass face check-in.',
      },
      {
        kind: 'number',
        key: 'antispoof_threshold',
        label: 'Anti-spoof threshold',
        help: 'Minimum "real face" score (0–1). Higher = stricter, more false rejections.',
        min: 0,
        max: 1,
        step: 0.01,
      },
    ],
  },
  {
    id: 'head-turn',
    title: 'Head turn',
    description: 'An active challenge: students turn their head left or right when asked.',
    icon: <PersonArrowRight20Regular />,
    fields: [
      {
        kind: 'toggle',
        key: 'require_head_turn',
        label: 'Require head turn',
        help: 'Applies to check-in (random left/right) and enrolment (front, left and right).',
        offWarning: 'Without the head turn, a still photo or a looped video is easier to pass off as the student.',
      },
      {
        kind: 'number',
        key: 'head_turn_min_yaw',
        label: 'Minimum turn',
        help: 'How far the head must turn. Higher = a bigger turn is needed.',
        min: 0.05,
        max: 1,
        step: 0.01,
      },
      {
        kind: 'number',
        key: 'frontal_max_yaw',
        label: 'Maximum turn for "looking straight"',
        help: 'Frames turned less than this count as frontal. Must be lower than the minimum turn.',
        min: 0.01,
        max: 0.5,
        step: 0.01,
      },
    ],
  },
  {
    id: 'presence',
    title: 'Proof of presence',
    description: 'A rotating code shown in the classroom proves the student is in the room.',
    icon: <QrCode20Regular />,
    fields: [
      {
        kind: 'toggle',
        key: 'require_presence_code',
        label: 'Require the classroom code',
        help: 'Students scan the QR code or type the 6-digit code shown by the teacher.',
        offWarning: 'Without the code, a student can check in from anywhere while the window is open (for example, from home).',
      },
      {
        kind: 'number',
        key: 'presence_code_period_seconds',
        label: 'Code rotation period',
        help: 'How often the code changes. Each code is accepted for up to two periods.',
        min: 10,
        max: 300,
        step: 1,
        integer: true,
        unit: 's',
      },
    ],
  },
  {
    id: 'matching',
    title: 'Matching',
    description: "How closely the captured face must match the student's registered face.",
    icon: <ScanPerson20Regular />,
    fields: [
      {
        kind: 'number',
        key: 'match_threshold',
        label: 'Match threshold',
        help: 'Minimum similarity of the best frontal frame. Higher = stricter, more false rejections.',
        min: 0.1,
        max: 0.95,
        step: 0.01,
      },
      {
        kind: 'number',
        key: 'consistency_threshold',
        label: 'Consistency threshold',
        help: 'Minimum similarity of every other frame, so the same person is on camera throughout.',
        min: 0,
        max: 0.95,
        step: 0.01,
      },
      {
        kind: 'number',
        key: 'duplicate_threshold',
        label: 'Duplicate threshold',
        help: 'Enrolment is blocked when the face matches another student this closely. Lower = more blocks.',
        min: 0.1,
        max: 0.99,
        step: 0.01,
      },
    ],
  },
  {
    id: 'lockout',
    title: 'Lock-out',
    description: 'Temporarily blocks face check-in after repeated failures.',
    icon: <LockClosed20Regular />,
    fields: [
      {
        kind: 'number',
        key: 'max_failed_attempts',
        label: 'Failed attempts allowed',
        help: 'Failures (mismatch, spoof, wrong code…) allowed in the window before check-in locks.',
        min: 1,
        max: 100,
        step: 1,
        integer: true,
      },
      {
        kind: 'number',
        key: 'failed_attempt_window_minutes',
        label: 'Lock-out window',
        help: 'Rolling window for counting failures; the lock lifts as old failures age out.',
        min: 1,
        max: 1440,
        step: 1,
        integer: true,
        unit: 'min',
      },
    ],
  },
];

const ADVANCED_GROUP: GroupDef = {
  id: 'capture',
  title: 'Capture & quality',
  description: 'Burst size and the quality gate applied before matching. Change only if students get many quality rejections.',
  icon: <Camera20Regular />,
  fields: [
    { kind: 'number', key: 'frames_min', label: 'Frames per check-in (min)', help: 'Burst size when a head turn is required.', min: 1, max: 8, step: 1, integer: true },
    { kind: 'number', key: 'frames_max', label: 'Frames per check-in (max)', help: 'Upper limit for the burst. Must be at least the minimum.', min: 1, max: 12, step: 1, integer: true },
    { kind: 'number', key: 'enrolment_min_images', label: 'Images needed to enrol', help: 'Valid frames required to register a face.', min: 1, max: 8, step: 1, integer: true },
    { kind: 'number', key: 'challenge_ttl_seconds', label: 'Challenge lifetime', help: 'How long a head-turn challenge stays valid.', min: 15, max: 600, step: 1, integer: true, unit: 's' },
    { kind: 'number', key: 'min_detection_score', label: 'Detection score (check-in)', help: 'Face detector confidence needed on check-in frames. Higher = stricter.', min: 0, max: 1, step: 0.01 },
    { kind: 'number', key: 'enrolment_min_detection_score', label: 'Detection score (enrolment)', help: 'Face detector confidence needed on enrolment frames.', min: 0, max: 1, step: 0.01 },
    { kind: 'number', key: 'min_face_size_px', label: 'Minimum face size', help: 'Smallest face width and height accepted.', min: 16, max: 1000, step: 1, integer: true, unit: 'px' },
    { kind: 'number', key: 'min_sharpness', label: 'Minimum sharpness', help: 'Blur filter. Higher = rejects more blurry frames.', min: 0, max: 10000, step: 1 },
    { kind: 'number', key: 'min_brightness', label: 'Minimum brightness', help: 'Darkest face accepted (0–255).', min: 0, max: 255, step: 1 },
    { kind: 'number', key: 'max_brightness', label: 'Maximum brightness', help: 'Brightest face accepted (0–255). Must be above the minimum.', min: 0, max: 255, step: 1 },
  ],
};

const ALL_FIELDS: FieldDef[] = [...GROUPS, ADVANCED_GROUP].flatMap((g) => g.fields);
const SECURITY_TOGGLES: BoolKey[] = ['require_liveness', 'require_head_turn', 'require_presence_code'];
const TOGGLE_LABEL: Record<BoolKey, string> = {
  require_liveness: 'Liveness check',
  require_head_turn: 'Head turn',
  require_presence_code: 'Classroom code',
};

/* -------------------------------------------------------------------------- */
/* Draft helpers                                                               */
/* -------------------------------------------------------------------------- */

type Draft = Record<PolicyKey, string | boolean>;

const toDraft = (policy: FacePolicySettings): Draft =>
  Object.fromEntries(
    ALL_FIELDS.map((f) => [f.key, f.kind === 'toggle' ? Boolean(policy[f.key]) : String(policy[f.key])])
  ) as Draft;

const parseNumber = (field: NumberField, raw: string | boolean): { value?: number; error?: string } => {
  const text = String(raw).trim();
  if (text === '') return { error: 'Enter a value.' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: 'Enter a number.' };
  if (field.integer && !Number.isInteger(n)) return { error: 'Enter a whole number.' };
  if (n < field.min || n > field.max) return { error: `Must be between ${field.min} and ${field.max}.` };
  return { value: n };
};

const formatDefault = (field: FieldDef) => {
  const v = FACE_POLICY_DEFAULTS[field.key];
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  return `${v}${field.kind === 'number' && field.unit ? ` ${field.unit}` : ''}`;
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

const FACE_POLICY_QUERY_KEY = ['face-policy'] as const;

/**
 * Admin editor for the `face_verification` system setting. Missing keys show the
 * spec defaults; Save sends only the changed keys (the server merges and validates).
 */
const FacePolicySettingsCard: React.FC<{ className?: string }> = ({ className }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(FACE_POLICY_DEFAULTS));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({
    queryKey: FACE_POLICY_QUERY_KEY,
    queryFn: () => api.systemSettings.getFacePolicy(),
    staleTime: 0,
  });

  const stored = query.data;
  const baseline = useMemo<FacePolicySettings>(() => ({ ...FACE_POLICY_DEFAULTS, ...(stored ?? {}) }), [stored]);

  useEffect(() => {
    setDraft(toDraft(baseline));
  }, [baseline]);

  /* Per-field validation and change detection */
  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<PolicyKey, string>> = {};
    ALL_FIELDS.forEach((f) => {
      if (f.kind === 'number') {
        const { error } = parseNumber(f, draft[f.key]);
        if (error) errors[f.key] = error;
      }
    });
    const num = (k: PolicyKey) => Number(draft[k]);
    if (!errors.frames_min && !errors.frames_max && num('frames_max') < num('frames_min')) {
      errors.frames_max = 'Must be at least the minimum frames.';
    }
    if (!errors.min_brightness && !errors.max_brightness && num('max_brightness') <= num('min_brightness')) {
      errors.max_brightness = 'Must be above the minimum brightness.';
    }
    if (!errors.frontal_max_yaw && !errors.head_turn_min_yaw && num('frontal_max_yaw') >= num('head_turn_min_yaw')) {
      errors.frontal_max_yaw = 'Must be lower than the minimum turn.';
    }
    return errors;
  }, [draft]);

  const changes = useMemo<Partial<FacePolicySettings>>(() => {
    const out: Partial<Record<PolicyKey, number | boolean>> = {};
    ALL_FIELDS.forEach((f) => {
      if (f.kind === 'toggle') {
        if (draft[f.key] !== baseline[f.key]) out[f.key] = draft[f.key] as boolean;
      } else {
        const { value } = parseNumber(f, draft[f.key]);
        if (value !== undefined && value !== baseline[f.key]) out[f.key] = value;
      }
    });
    return out as Partial<FacePolicySettings>;
  }, [draft, baseline]);

  const invalidCount = Object.keys(fieldErrors).length;
  const isDirty =
    Object.keys(changes).length > 0 ||
    ALL_FIELDS.some((f) => f.kind === 'number' && String(draft[f.key]).trim() !== String(baseline[f.key]));
  const changedCount = Object.keys(changes).length;
  const turningOff = SECURITY_TOGGLES.filter((k) => changes[k] === false);
  const advancedErrors = ADVANCED_GROUP.fields.some((f) => fieldErrors[f.key]);

  const mutation = useMutation({
    mutationFn: (value: Partial<FacePolicySettings>) => api.systemSettings.updateFacePolicy(value),
    onSuccess: (value) => {
      queryClient.setQueryData(FACE_POLICY_QUERY_KEY, value);
      void queryClient.invalidateQueries({ queryKey: FACE_POLICY_QUERY_KEY });
      setServerError(null);
      toast({ title: 'Face verification settings saved', description: 'New check-ins use the updated policy.' });
    },
    onError: (err) => setServerError(parseApiError(err).message),
  });

  const save = () => {
    if (invalidCount > 0) {
      if (advancedErrors) setAdvancedOpen(true);
      setServerError(null);
      return;
    }
    if (changedCount === 0) return;
    if (turningOff.length > 0 && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }
    setConfirmOpen(false);
    mutation.mutate(changes);
  };

  const setField = (key: PolicyKey, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }));

  const renderField = (field: FieldDef) => {
    const id = `face-policy-${field.key}`;
    const usingDefault = !!stored && !(field.key in stored);
    const changed = field.key in changes;
    const error = fieldErrors[field.key];
    const meta = (
      <span className="text-caption text-text-muted">
        Default {formatDefault(field)}
        {usingDefault && ' · using default'}
        {changed && <span className="text-brand-foreground"> · changed</span>}
      </span>
    );

    if (field.kind === 'toggle') {
      const on = draft[field.key] === true;
      return (
        <div key={field.key} className="space-y-2 sm:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <label htmlFor={id} className="cursor-pointer text-body-strong text-text-primary">
                {field.label}
              </label>
              <p id={`${id}-help`} className="mt-0.5 text-caption text-text-muted">
                {field.help}
              </p>
              {meta}
            </div>
            <Switch
              id={id}
              checked={on}
              onCheckedChange={(v) => setField(field.key, v === true)}
              aria-describedby={`${id}-help`}
            />
          </div>
          {!on && field.offWarning && (
            <MessageBar tone="warning" icon={<Warning16Regular />}>
              {field.offWarning}
            </MessageBar>
          )}
        </div>
      );
    }

    return (
      <div key={field.key} className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="text-body-strong text-text-primary">
          {field.label}
        </label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode={field.integer ? 'numeric' : 'decimal'}
            min={field.min}
            max={field.max}
            step={field.step}
            value={String(draft[field.key])}
            onChange={(e) => setField(field.key, e.target.value)}
            aria-invalid={!!error}
            aria-describedby={`${id}-help`}
            className="w-32 tabular-nums"
          />
          {field.unit && <span className="text-caption text-text-muted">{field.unit}</span>}
        </div>
        <p id={`${id}-help`} className={cn('text-caption', error ? 'text-status-error' : 'text-text-muted')}>
          {error ?? field.help}
        </p>
        {meta}
      </div>
    );
  };

  const renderGroup = (group: GroupDef) => (
    <section key={group.id} aria-labelledby={`face-group-${group.id}`} className="px-5 py-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-text-muted [&_svg]:size-5" aria-hidden>
          {group.icon}
        </span>
        <div className="min-w-0">
          <h3 id={`face-group-${group.id}`} className="text-body-strong text-text-primary">
            {group.title}
          </h3>
          <p className="text-caption text-text-muted">{group.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 sm:pl-8">{group.fields.map(renderField)}</div>
    </section>
  );

  return (
    <Card className={cn('overflow-hidden border-0 shadow', className)}>
      <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
          <ScanPerson20Regular aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-subheading text-text-primary">Face verification</h2>
          <p className="mt-0.5 text-caption text-text-muted">
            Liveness, proof of presence, matching thresholds and lock-out for face check-in. The server enforces these
            on every check-in and enrolment.
          </p>
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState rows={6} className="p-5" />
      ) : query.isError ? (
        <ErrorState
          className="m-5"
          title="Couldn't load face verification settings"
          message={parseApiError(query.error).message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          {stored && Object.keys(stored).length === 0 && (
            <div className="px-5 pt-4">
              <MessageBar tone="info" icon={<CheckmarkCircle16Regular />}>
                No custom settings saved yet — the recommended defaults are in effect.
              </MessageBar>
            </div>
          )}

          <div className="divide-y divide-border-subtle">
            {GROUPS.map(renderGroup)}

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-5 py-3 text-left text-body-strong text-text-primary transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text-primary"
                >
                  {advancedOpen ? (
                    <ChevronDown16Regular className="text-text-muted" aria-hidden />
                  ) : (
                    <ChevronRight16Regular className="text-text-muted" aria-hidden />
                  )}
                  Advanced: capture &amp; quality
                  {advancedErrors && (
                    <span className="inline-flex items-center gap-1 text-caption text-status-error">
                      <ErrorCircle16Regular className="size-3.5" aria-hidden />
                      Needs attention
                    </span>
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border-subtle">{renderGroup(ADVANCED_GROUP)}</CollapsibleContent>
            </Collapsible>
          </div>

          {/* Save bar */}
          <div className="space-y-3 border-t border-border-subtle bg-surface-subtle px-5 py-3">
            {serverError && (
              <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
                {serverError}
              </MessageBar>
            )}
            {invalidCount > 0 && (
              <MessageBar tone="error" icon={<ErrorCircle16Regular />}>
                Fix {invalidCount} highlighted value{invalidCount === 1 ? '' : 's'} before saving.
              </MessageBar>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption tabular-nums text-text-muted">
                {changedCount > 0
                  ? `${changedCount} unsaved change${changedCount === 1 ? '' : 's'} — only these keys are sent.`
                  : 'No unsaved changes.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setDraft(toDraft(FACE_POLICY_DEFAULTS))}
                  disabled={mutation.isPending}
                  title="Fill in the recommended defaults (not saved until you click Save)"
                >
                  Use recommended defaults
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft(toDraft(baseline));
                    setServerError(null);
                  }}
                  disabled={!isDirty || mutation.isPending}
                >
                  <ArrowCounterclockwise16Regular aria-hidden />
                  Discard
                </Button>
                <Button size="sm" onClick={save} disabled={changedCount === 0 || mutation.isPending}>
                  <Save16Regular aria-hidden />
                  {mutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off {turningOff.map((k) => TOGGLE_LABEL[k].toLowerCase()).join(' and ')}?</AlertDialogTitle>
            <AlertDialogDescription>
              This weakens face check-in for every student. Attendance could be marked by someone who isn't in the room
              or isn't the student. You can turn it back on at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it on</AlertDialogCancel>
            <Button variant="destructive" onClick={save}>
              Turn off and save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default FacePolicySettingsCard;
