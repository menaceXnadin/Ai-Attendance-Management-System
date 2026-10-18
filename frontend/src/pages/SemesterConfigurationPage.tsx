import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Add16Regular,
  CalendarLtr20Regular,
  CalendarLtr24Regular,
  Delete16Regular,
  Edit16Regular,
  ErrorCircle16Regular,
  History20Regular,
  Info16Regular,
  ArrowUndo16Regular,
} from '@fluentui/react-icons';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useToast } from '@/hooks/use-toast';
import {
  api,
  parseApiError,
  type SemesterConfig,
  type SemesterConfigInput,
  type TermLifecycleState,
} from '@/integrations/api/client';
import { errorField } from '@/components/attendance-admin/errors';
import { MessageBar, formatDateLabel } from '@/components/attendance-admin/shared';
import AcademicCalendarSettings from './AcademicCalendarSettings';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const STATE_META: Record<TermLifecycleState, { label: string; variant: 'success' | 'brand' | 'secondary' | 'outline' }> = {
  current: { label: 'Current', variant: 'success' },
  upcoming: { label: 'Upcoming', variant: 'brand' },
  past: { label: 'Past', variant: 'secondary' },
  inactive: { label: 'Inactive', variant: 'outline' },
};

/**
 * The server computes `state` from dates. Older servers may omit it; in that case
 * only the server's `is_current`/`is_active` flags are used (no client clock).
 */
const stateOf = (t: SemesterConfig): TermLifecycleState | null => {
  if (t.state) return t.state;
  if (!t.is_active) return 'inactive';
  if (t.is_current) return 'current';
  return null;
};

/** Display name (`semester_name`, or the server's `name` alias). */
const termName = (t: SemesterConfig): string =>
  t.semester_name || (t as SemesterConfig & { name?: string }).name || `Term #${t.id}`;

const shortDate = (value?: string | null) =>
  value ? formatDateLabel(value, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

type FormState = {
  semester_name: string;
  academic_year: string;
  semester_number: string;
  start_date: string;
  end_date: string;
  exam_week_start: string;
  exam_week_end: string;
  total_weeks: string;
  is_active: boolean;
};

type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY_FORM: FormState = {
  semester_name: '',
  academic_year: '',
  semester_number: '',
  start_date: '',
  end_date: '',
  exam_week_start: '',
  exam_week_end: '',
  total_weeks: '',
  is_active: true,
};

const toForm = (t: SemesterConfig): FormState => ({
  semester_name: termName(t),
  academic_year: t.academic_year !== undefined && t.academic_year !== null ? String(t.academic_year) : '',
  semester_number: t.semester_number ? String(t.semester_number) : '',
  start_date: t.start_date?.slice(0, 10) ?? '',
  end_date: t.end_date?.slice(0, 10) ?? '',
  exam_week_start: t.exam_week_start?.slice(0, 10) ?? '',
  exam_week_end: t.exam_week_end?.slice(0, 10) ?? '',
  total_weeks: t.total_weeks ? String(t.total_weeks) : '',
  is_active: t.is_active !== false,
});

const FIELD_KEYS: FieldKey[] = [
  'semester_name',
  'academic_year',
  'semester_number',
  'start_date',
  'end_date',
  'exam_week_start',
  'exam_week_end',
  'total_weeks',
  'is_active',
];

/** Maps 400/409/422 bodies onto form fields; returns the general message. */
const mapServerErrors = (err: unknown): { fields: FieldErrors; message: string } => {
  const info = parseApiError(err);
  const fields: FieldErrors = {};
  // FastAPI/Pydantic 422: detail = [{loc: [..., field], msg}]
  if (Array.isArray(info.detail)) {
    (info.detail as Array<{ loc?: unknown[]; msg?: string }>).forEach((d) => {
      const field = Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1]) : '';
      if ((FIELD_KEYS as string[]).includes(field) && d.msg) fields[field as FieldKey] = d.msg.replace(/^Value error, /, '');
    });
  }
  // Contract / term_service: errors = [{field, code, message}]
  const list = errorField<Array<{ field?: string; message?: string }>>(info, 'errors');
  if (Array.isArray(list)) {
    list.forEach((e) => {
      if (e.field && (FIELD_KEYS as string[]).includes(e.field) && e.message) fields[e.field as FieldKey] = e.message;
    });
  }
  const single = errorField<string>(info, 'field');
  if (single && (FIELD_KEYS as string[]).includes(single)) fields[single as FieldKey] = info.message;

  let message = info.message;
  if (info.status === 409) {
    const conflicts = errorField<Array<{ semester_name?: string; name?: string }>>(info, 'conflicts');
    const names = Array.isArray(conflicts) ? conflicts.map((c) => c.semester_name ?? c.name).filter(Boolean) : [];
    if (names.length) message = `${info.message} (overlaps: ${names.join(', ')})`;
  }
  return { fields, message };
};

/* -------------------------------------------------------------------------- */
/* Term dialog                                                                 */
/* -------------------------------------------------------------------------- */

const TermDialog: React.FC<{
  open: boolean;
  term: SemesterConfig | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}> = ({ open, term, onOpenChange, onSaved }) => {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(term ? toForm(term) : EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = term !== null;

  const set = <K extends FieldKey>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const mutation = useMutation({
    mutationFn: async (payload: SemesterConfigInput) =>
      isEdit ? api.semesterConfig.update(term!.id, payload) : api.semesterConfig.create(payload),
    onSuccess: () => {
      toast({ title: isEdit ? 'Term updated' : 'Term created', description: form.semester_name });
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => {
      const { fields, message } = mapServerErrors(err);
      setFieldErrors(fields);
      setFormError(message);
    },
  });

  const submit = () => {
    const errs: FieldErrors = {};
    if (!form.semester_name.trim()) errs.semester_name = 'Name is required.';
    if (!form.start_date) errs.start_date = 'Start date is required.';
    if (!form.end_date) errs.end_date = 'End date is required.';
    if (Boolean(form.exam_week_start) !== Boolean(form.exam_week_end)) {
      errs[form.exam_week_start ? 'exam_week_end' : 'exam_week_start'] = 'Set both exam dates or neither.';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setFormError(null);
      return;
    }
    setFormError(null);
    // Date ordering, exam-window containment and overlaps are validated by the server.
    const payload = {
      semester_name: form.semester_name.trim(),
      ...(form.academic_year.trim() ? { academic_year: Number(form.academic_year) } : {}),
      ...(form.semester_number ? { semester_number: Number(form.semester_number) } : {}),
      start_date: form.start_date,
      end_date: form.end_date,
      exam_week_start: form.exam_week_start || null,
      exam_week_end: form.exam_week_end || null,
      total_weeks: form.total_weeks ? Number(form.total_weeks) : null,
      is_active: form.is_active,
    };
    mutation.mutate(payload as SemesterConfigInput);
  };

  const field = (
    key: FieldKey,
    label: string,
    input: React.ReactNode,
    help?: React.ReactNode,
    required = false
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`term-${key}`} className="text-body-strong text-text-primary">
        {label}
        {required && <span className="text-status-error"> *</span>}
      </label>
      {input}
      {fieldErrors[key] ? (
        <p className="text-caption text-status-error" role="alert">
          {fieldErrors[key]}
        </p>
      ) : help ? (
        <p className="text-caption text-text-muted">{help}</p>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-section-title">{isEdit ? 'Edit term' : 'New term'}</DialogTitle>
          <DialogDescription className="text-body text-text-muted">
            Terms are university-wide. Regular classes run on every instructional day between the start and end
            dates, except the exam window.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {field(
              'semester_name',
              'Name',
              <Input
                id="term-semester_name"
                value={form.semester_name}
                onChange={(e) => set('semester_name', e.target.value)}
                placeholder="e.g. Fall 2026"
                maxLength={100}
                aria-invalid={Boolean(fieldErrors.semester_name)}
              />,
              undefined,
              true
            )}
          </div>
          {field(
            'academic_year',
            'Academic year label',
            <Input
              id="term-academic_year"
              type="number"
              inputMode="numeric"
              value={form.academic_year}
              onChange={(e) => set('academic_year', e.target.value)}
              placeholder="Optional, e.g. 2026"
              aria-invalid={Boolean(fieldErrors.academic_year)}
            />,
            'A label only (e.g. 2026 for 2026/27). It is never compared with the calendar year.'
          )}
          {field(
            'semester_number',
            'Semester number',
            <Input
              id="term-semester_number"
              type="number"
              min={1}
              max={8}
              value={form.semester_number}
              onChange={(e) => set('semester_number', e.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(fieldErrors.semester_number)}
            />,
            'Optional, for sorting and display.'
          )}
          {field(
            'start_date',
            'Start date',
            <Input
              id="term-start_date"
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              aria-invalid={Boolean(fieldErrors.start_date)}
            />,
            undefined,
            true
          )}
          {field(
            'end_date',
            'End date',
            <Input
              id="term-end_date"
              type="date"
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
              aria-invalid={Boolean(fieldErrors.end_date)}
            />,
            undefined,
            true
          )}
          {field(
            'exam_week_start',
            'Exam window start',
            <Input
              id="term-exam_week_start"
              type="date"
              value={form.exam_week_start}
              onChange={(e) => set('exam_week_start', e.target.value)}
              aria-invalid={Boolean(fieldErrors.exam_week_start)}
            />,
            'Optional. Must fall inside the term.'
          )}
          {field(
            'exam_week_end',
            'Exam window end',
            <Input
              id="term-exam_week_end"
              type="date"
              value={form.exam_week_end}
              onChange={(e) => set('exam_week_end', e.target.value)}
              aria-invalid={Boolean(fieldErrors.exam_week_end)}
            />,
            'Regular classes are suspended during the exam window.'
          )}
          {field(
            'total_weeks',
            'Duration (weeks)',
            <Input
              id="term-total_weeks"
              type="number"
              min={1}
              max={52}
              value={form.total_weeks}
              onChange={(e) => set('total_weeks', e.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(fieldErrors.total_weeks)}
            />,
            'Informational.'
          )}
          <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2 sm:col-span-2">
            <div>
              <label htmlFor="term-is_active" className="text-body-strong text-text-primary">
                Active
              </label>
              <p className="text-caption text-text-muted">
                Only active terms define academic periods. Active terms may not overlap.
              </p>
            </div>
            <Switch id="term-is_active" checked={form.is_active} onCheckedChange={(v) => set('is_active', v === true)} />
          </div>
        </div>

        {formError && (
          <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
            {formError}
          </MessageBar>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create term'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

const SemesterConfigurationPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ term: SemesterConfig | null; key: number } | null>(null);
  const [deactivating, setDeactivating] = useState<SemesterConfig | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const termsQuery = useQuery({
    queryKey: ['semester-config'],
    queryFn: () => api.semesterConfig.list(),
  });
  const currentQuery = useQuery({
    queryKey: ['semester-config', 'current'],
    queryFn: () => api.semesterConfig.getCurrent(),
  });

  const terms = useMemo(
    () =>
      [...(termsQuery.data ?? [])].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '')),
    [termsQuery.data]
  );

  const current = currentQuery.data?.term ?? terms.find((t) => stateOf(t) === 'current') ?? null;
  const hasActiveTerms = terms.some((t) => t.is_active);
  const termState = current
    ? 'active'
    : termsQuery.isSuccess && !hasActiveTerms
      ? 'no_terms'
      : currentQuery.data?.term_state ?? 'between_terms';
  const upcoming = useMemo(
    () =>
      terms
        .filter((t) => stateOf(t) === 'upcoming')
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null,
    [terms]
  );
  const lastPast = useMemo(() => terms.find((t) => stateOf(t) === 'past') ?? null, [terms]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['semester-config'] });
    void queryClient.invalidateQueries({ queryKey: ['attendance-policy'] });
    api.attendancePolicy.invalidate();
  };

  const deactivateMutation = useMutation({
    mutationFn: (t: SemesterConfig) => api.semesterConfig.deactivate(t.id),
    onSuccess: (_d, t) => {
      toast({ title: 'Term deactivated', description: `${termName(t)} no longer defines an academic period.` });
      setDeactivating(null);
      refresh();
    },
    onError: (err) => {
      setActionError(parseApiError(err).message);
      setDeactivating(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (t: SemesterConfig) => api.semesterConfig.update(t.id, { is_active: true }),
    onSuccess: (_d, t) => {
      toast({ title: 'Term reactivated', description: termName(t) });
      refresh();
    },
    onError: (err) => setActionError(mapServerErrors(err).message),
  });

  return (
    <div className="space-y-6">
      <div className="page-header !mb-0">
        <div>
          <h1 className="text-page-title text-text-primary">Semester Setup</h1>
          <p className="mt-1 text-body text-text-muted">
            Academic terms drive class sessions, automatic absence finalization and every attendance percentage.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDialog({ term: null, key: Date.now() })}>
            <Add16Regular aria-hidden />
            New term
          </Button>
        </div>
      </div>

      <Tabs defaultValue="terms" className="w-full">
        <TabsList>
          <TabsTrigger value="terms">
            <CalendarLtr20Regular aria-hidden />
            Terms
          </TabsTrigger>
          <TabsTrigger value="legacy">
            <History20Regular aria-hidden />
            Legacy calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terms" className="mt-6 space-y-4">
          {/* Current / between-terms indicator (from the server) */}
          <Card className="overflow-hidden border-0 bg-surface-default shadow">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <span
                  className={`h-2 w-2 rounded-full ${current ? 'bg-presence-available' : 'bg-presence-offline'}`}
                  aria-hidden
                />
                {currentQuery.isLoading && termsQuery.isLoading
                  ? 'Checking current term…'
                  : current
                    ? `Current term: ${termName(current)}`
                    : termState === 'no_terms'
                      ? 'No active terms'
                      : 'Between terms'}
              </CardTitle>
              <Badge variant={current ? 'success' : termState === 'no_terms' ? 'warning' : 'info'} shape="pill">
                {current ? 'In session' : termState === 'no_terms' ? 'Not configured' : 'Between terms'}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 divide-y divide-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-4">
                  <span className="block text-caption text-text-muted">{current ? 'Term dates' : 'Most recent term'}</span>
                  {current || lastPast ? (
                    <>
                      <span className="mt-1 block text-body-strong text-text-primary">
                        {termName((current ?? lastPast)!)}
                      </span>
                      <span className="block text-caption tabular-nums text-text-muted">
                        {shortDate((current ?? lastPast)!.start_date)} – {shortDate((current ?? lastPast)!.end_date)}
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 block text-body text-text-muted">—</span>
                  )}
                </div>
                <div className="px-5 py-4">
                  <span className="block text-caption text-text-muted">Exam window</span>
                  <span className="mt-1 block text-body-strong tabular-nums text-text-primary">
                    {current?.exam_week_start && current?.exam_week_end
                      ? `${shortDate(current.exam_week_start)} – ${shortDate(current.exam_week_end)}`
                      : '—'}
                  </span>
                </div>
                <div className="px-5 py-4">
                  <span className="block text-caption text-text-muted">Next term</span>
                  {upcoming ? (
                    <>
                      <span className="mt-1 block text-body-strong text-text-primary">{termName(upcoming)}</span>
                      <span className="block text-caption tabular-nums text-text-muted">
                        {shortDate(upcoming.start_date)} – {shortDate(upcoming.end_date)}
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 block text-body text-text-muted">None scheduled</span>
                  )}
                </div>
              </div>
              {!current && termState !== 'active' && (
                <div className="border-t border-border-subtle px-5 py-3">
                  <MessageBar tone="info" icon={<Info16Regular />}>
                    {termState === 'no_terms'
                      ? 'Create a term to start generating class sessions. Until then no attendance is expected.'
                      : 'No term contains today: no class sessions are generated, auto-absent does nothing, and metrics report on the most recent term.'}
                  </MessageBar>
                </div>
              )}
            </CardContent>
          </Card>

          <MessageBar tone="info" icon={<Info16Regular />}>
            The current term is worked out from the dates — there is no manual “set current” switch. The academic year is
            a label for display; it is never compared with the calendar year. Terms are never deleted: deactivating keeps
            every session and attendance record.
          </MessageBar>

          {actionError && (
            <MessageBar
              tone="error"
              role="alert"
              icon={<ErrorCircle16Regular />}
              actions={
                <Button variant="ghost" size="sm" onClick={() => setActionError(null)}>
                  Dismiss
                </Button>
              }
            >
              {actionError}
            </MessageBar>
          )}

          {/* Terms list */}
          <Card className="overflow-hidden border-0 bg-surface-default shadow">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="text-subheading text-text-primary">All terms</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {termsQuery.isLoading ? (
                <LoadingState rows={4} columns={6} className="rounded-none border-0" />
              ) : termsQuery.isError ? (
                <ErrorState
                  className="rounded-none border-0"
                  title="Couldn't load terms"
                  message={parseApiError(termsQuery.error).message}
                  onRetry={() => void termsQuery.refetch()}
                />
              ) : terms.length === 0 ? (
                <EmptyState
                  icon={<CalendarLtr24Regular aria-hidden />}
                  title="No terms yet"
                  description="Create the first academic term to start scheduling class sessions."
                  actionLabel="New term"
                  onAction={() => setDialog({ term: null, key: Date.now() })}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-subtle text-caption-strong text-text-secondary">
                        <th scope="col" className="px-5 py-2.5 font-semibold">Term</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Dates</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Exam window</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Year label</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                        <th scope="col" className="px-5 py-2.5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terms.map((t) => {
                        const state = stateOf(t);
                        const meta = state ? STATE_META[state] : null;
                        return (
                          <tr
                            key={t.id}
                            className={`border-b border-border-subtle text-body transition-colors duration-150 last:border-b-0 hover:bg-surface-hover ${
                              t.is_active ? '' : 'text-text-muted'
                            }`}
                          >
                            <td className="px-5 py-3">
                              <span className="block text-body-strong text-text-primary">{termName(t)}</span>
                              {t.semester_number ? (
                                <span className="block text-caption text-text-muted">Semester {t.semester_number}</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-text-primary">
                              {shortDate(t.start_date)} – {shortDate(t.end_date)}
                              {t.total_weeks ? <span className="block text-caption text-text-muted">{t.total_weeks} weeks</span> : null}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-text-secondary">
                              {t.exam_week_start && t.exam_week_end
                                ? `${shortDate(t.exam_week_start)} – ${shortDate(t.exam_week_end)}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-text-secondary">{t.academic_year ?? '—'}</td>
                            <td className="px-4 py-3">
                              {meta ? (
                                <Badge variant={meta.variant} shape="pill">
                                  {meta.label}
                                </Badge>
                              ) : (
                                <Badge variant="outline" shape="pill">
                                  Active
                                </Badge>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDialog({ term: t, key: Date.now() })}
                                  aria-label={`Edit ${termName(t)}`}
                                >
                                  <Edit16Regular aria-hidden />
                                  Edit
                                </Button>
                                {t.is_active ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setActionError(null);
                                      setDeactivating(t);
                                    }}
                                    aria-label={`Deactivate ${termName(t)}`}
                                  >
                                    <Delete16Regular aria-hidden />
                                    Deactivate
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={reactivateMutation.isPending}
                                    onClick={() => {
                                      setActionError(null);
                                      reactivateMutation.mutate(t);
                                    }}
                                    aria-label={`Reactivate ${termName(t)}`}
                                  >
                                    <ArrowUndo16Regular aria-hidden />
                                    Reactivate
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legacy" className="mt-6">
          <AcademicCalendarSettings embedded />
        </TabsContent>
      </Tabs>

      {dialog && (
        <TermDialog
          key={dialog.key}
          open
          term={dialog.term}
          onOpenChange={(open) => !open && setDialog(null)}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={deactivating !== null} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-section-title">Deactivate {deactivating ? termName(deactivating) : ""}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-body text-text-secondary">
              <span className="block">
                The term stops defining an academic period: no new class sessions are generated for its dates and it is
                no longer used for reporting.
              </span>
              <span className="block">
                Nothing is deleted — existing sessions and attendance records are kept, and you can reactivate the term
                later.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deactivating) deactivateMutation.mutate(deactivating);
              }}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate term'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SemesterConfigurationPage;
