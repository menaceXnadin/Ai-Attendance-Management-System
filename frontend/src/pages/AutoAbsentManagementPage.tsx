import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Play20Regular,
  Play20Filled,
  ArrowSync20Regular,
  CheckmarkCircle20Filled,
  CheckmarkCircle16Filled,
  DismissCircle20Filled,
  ErrorCircle16Filled,
  Clock20Regular,
  People20Regular,
  Book20Regular,
  Info16Regular,
  Pulse20Regular,
  CalendarLtr20Regular,
  ShieldCheckmark20Regular,
  History20Regular,
  ClipboardTaskListLtr20Regular,
} from '@fluentui/react-icons';
import {
  api,
  parseApiError,
  type AutoAbsentStatus,
  type AutoAbsentTriggerResult,
  type JobRun,
  type TermState,
} from '@/integrations/api/client';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import TermStateBanner from '@/components/layout/TermStateBanner';
import UnrecordedSessionsPanel from '@/components/attendance-admin/UnrecordedSessionsPanel';
import { MessageBar, formatDateTime } from '@/components/attendance-admin/shared';

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const RUN_STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'secondary' | 'info'> = {
  success: 'success',
  failed: 'destructive',
  skipped: 'secondary',
  running: 'info',
};

const durationLabel = (run: JobRun) => {
  if (!run.started_at || !run.finished_at) return run.status === 'running' ? 'Running…' : '—';
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};

const runSummary = (run: JobRun): string => {
  const r = (run.result ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  const finalized = num(r.sessions_finalized);
  const created = num(r.new_records_created ?? r.records_created);
  const materialized = num(r.sessions_materialized);
  const unrecorded = num(r.unrecorded_sessions);
  if (finalized !== null) parts.push(`${finalized} finalized`);
  if (created !== null) parts.push(`${created} absent${created === 1 ? '' : 's'}`);
  if (materialized) parts.push(`${materialized} materialized`);
  if (unrecorded) parts.push(`${unrecorded} unrecorded`);
  return parts.join(' · ') || (run.error ? '' : '—');
};

const triggeredByLabel = (run: JobRun) =>
  run.triggered_by_name || (run.triggered_by ? `Admin #${run.triggered_by}` : 'Scheduler');

const KpiTile: React.FC<{
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon: React.ReactNode;
  chip: string;
}> = ({ label, value, caption, icon, chip }) => (
  <Card className="border-0 shadow">
    <CardContent className="flex items-start gap-3 p-4">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${chip}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-caption text-text-muted">{label}</p>
        <div className="mt-0.5">{value}</div>
        {caption && <p className="truncate text-caption text-text-muted">{caption}</p>}
      </div>
    </CardContent>
  </Card>
);

const AutoAbsentManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [targetDate, setTargetDate] = useState('');
  const [lastTrigger, setLastTrigger] = useState<AutoAbsentTriggerResult | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['auto-absent-status'],
    queryFn: () => api.autoAbsent.status(),
    refetchInterval: 30_000,
  });
  const runsQuery = useQuery({
    queryKey: ['auto-absent-runs'],
    queryFn: () => api.autoAbsent.runs(20),
    refetchInterval: 60_000,
  });

  const status: AutoAbsentStatus | undefined = statusQuery.data;
  const lastRun = status?.last_run ?? runsQuery.data?.[0] ?? null;
  const termState = (status?.term_state as TermState | undefined) ?? null;
  const unrecorded = num(status?.unrecorded_sessions);
  const ready = num(status?.expired_classes_ready_to_process);
  const rawNotes = status?.notes;
  const notes = Array.isArray(rawNotes) ? rawNotes.join(' ') : rawNotes;

  const refreshAll = () => {
    void statusQuery.refetch();
    void runsQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['unrecorded-sessions'] });
  };

  // The manual trigger is independent of the scheduler flag (DOMAIN_RULES §7):
  // an admin can always run the idempotent finalizer.
  const trigger = useMutation({
    mutationFn: () => api.autoAbsent.trigger(targetDate || undefined),
    onMutate: () => {
      setTriggerError(null);
      setLastTrigger(null);
    },
    onSuccess: (data) => {
      setLastTrigger(data);
      refreshAll();
    },
    onError: (err) => setTriggerError(parseApiError(err).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-page-title text-text-primary">
            <Pulse20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Auto-Absent Automation
          </h1>
          <p className="mt-1 text-body text-text-muted">
            Finalizes held class sessions and lists sessions nobody recorded for follow-up
          </p>
        </div>
        <Button onClick={refreshAll} variant="outline" disabled={statusQuery.isFetching}>
          <ArrowSync20Regular className={statusQuery.isFetching ? 'animate-spin' : ''} aria-hidden />
          <span>Refresh Status</span>
        </Button>
      </div>

      <TermStateBanner
        termState={termState}
        showSetupLink
        context="Manual runs outside a term finalize nothing."
      />

      {statusQuery.isError && (
        <MessageBar tone="error" role="alert" icon={<ErrorCircle16Filled />}>
          {parseApiError(statusQuery.error).message}
        </MessageBar>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Scheduler"
          chip={
            status?.auto_absent_enabled
              ? 'bg-status-success-subtle text-status-success'
              : 'bg-surface-subtle text-text-muted'
          }
          icon={status?.auto_absent_enabled ? <CheckmarkCircle20Filled aria-hidden /> : <DismissCircle20Filled aria-hidden />}
          value={
            <p className="text-subheading text-text-primary">
              {status ? (status.auto_absent_enabled ? 'Enabled' : 'Disabled') : '—'}
            </p>
          }
          caption={
            status
              ? status.scheduler_running === false && status.auto_absent_enabled
                ? 'Not running in this process'
                : status.schedule_window || 'Manual runs always allowed'
              : undefined
          }
        />
        <KpiTile
          label="Ready to finalize"
          chip="bg-brand-subtle text-brand-foreground"
          icon={<Book20Regular aria-hidden />}
          value={<p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{ready ?? '—'}</p>}
          caption="Held sessions past the grace period"
        />
        <KpiTile
          label="Unrecorded sessions"
          chip={unrecorded ? 'bg-status-warning-subtle text-status-warning' : 'bg-surface-subtle text-text-muted'}
          icon={<ClipboardTaskListLtr20Regular aria-hidden />}
          value={<p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{unrecorded ?? '—'}</p>}
          caption="Need a decision — never auto-absented"
        />
        <KpiTile
          label="Last run"
          chip={
            lastRun?.status === 'failed'
              ? 'bg-status-error-subtle text-status-error'
              : 'bg-surface-subtle text-text-muted'
          }
          icon={<History20Regular aria-hidden />}
          value={
            lastRun ? (
              <Badge variant={RUN_STATUS_VARIANT[lastRun.status] ?? 'secondary'} shape="pill" className="capitalize">
                {lastRun.status}
              </Badge>
            ) : (
              <p className="text-subheading text-text-primary">Never</p>
            )
          }
          caption={lastRun ? `${formatDateTime(lastRun.started_at)} · ${triggeredByLabel(lastRun)}` : 'No runs recorded yet'}
        />
      </div>

      {/* Unrecorded & review */}
      <UnrecordedSessionsPanel onResolved={() => void statusQuery.refetch()} />

      {/* Manual trigger */}
      <Card className="overflow-hidden border-0 shadow">
        <CardHeader className="space-y-0.5 border-b border-border-subtle px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <Play20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Run now
          </CardTitle>
          <CardDescription className="text-caption text-text-muted">
            Runs the finalizer immediately, whether or not the background scheduler is enabled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <MessageBar tone="info" icon={<Info16Regular />}>
            Only sessions where attendance was taken (held) are finalized: enrolled students without a record are marked
            absent{typeof status?.finalize_grace_minutes === 'number' ? ` ${status.finalize_grace_minutes} minutes` : ''}{' '}
            after the class ends. Sessions nobody recorded stay unrecorded. Holidays, exam days and cancelled sessions are
            skipped. Running again is safe — nothing is written twice.
          </MessageBar>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <label htmlFor="auto-absent-date" className="text-body-strong text-text-primary">
                Materialize sessions for date <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <Input
                id="auto-absent-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="sm:w-56"
              />
              <p className="text-caption text-text-muted">Within the active term, up to 30 days back. Leave empty for today.</p>
            </div>
            <Button onClick={() => trigger.mutate()} disabled={trigger.isPending} className="shrink-0">
              {trigger.isPending ? (
                <>
                  <ArrowSync20Regular className="animate-spin" aria-hidden />
                  <span>Running…</span>
                </>
              ) : (
                <>
                  <Play20Filled aria-hidden />
                  <span>Run finalizer</span>
                </>
              )}
            </Button>
          </div>

          {triggerError && (
            <MessageBar tone="error" role="alert" icon={<ErrorCircle16Filled />}>
              {triggerError}
            </MessageBar>
          )}

          {lastTrigger && (
            <div className="space-y-3 rounded-md border border-border-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-body-strong text-text-primary">
                  {lastTrigger.success && !lastTrigger.skipped ? (
                    <CheckmarkCircle16Filled className="text-status-success" aria-hidden />
                  ) : (
                    <ErrorCircle16Filled className={lastTrigger.skipped ? 'text-text-muted' : 'text-status-error'} aria-hidden />
                  )}
                  {lastTrigger.skipped ? `Skipped — ${String(lastTrigger.skipped)}` : lastTrigger.message}
                </span>
                <span className="font-mono text-caption text-text-muted">
                  {formatDateTime(lastTrigger.timestamp)}
                  {lastTrigger.job_run_id ? ` · run #${lastTrigger.job_run_id}` : ''}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { label: 'Sessions finalized', value: num(lastTrigger.sessions_finalized) ?? num(lastTrigger.expired_classes_processed) },
                  { label: 'Absents created', value: num(lastTrigger.records_created) },
                  { label: 'Already recorded', value: num(lastTrigger.students_already_marked) },
                  { label: 'Sessions materialized', value: num(lastTrigger.sessions_materialized) },
                  { label: 'Unrecorded', value: num(lastTrigger.unrecorded_sessions) },
                ].map((item) => (
                  <div key={item.label} className="rounded-md bg-surface-subtle p-3">
                    <dt className="text-caption text-text-muted">{item.label}</dt>
                    <dd className="text-section-title tabular-nums text-text-primary">{item.value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run history */}
      <Card className="overflow-hidden border-0 shadow">
        <CardHeader className="space-y-0.5 border-b border-border-subtle px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <History20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Run history
          </CardTitle>
          <CardDescription className="text-caption text-text-muted">
            Every scheduled or manual run (most recent first){status?.current_time ? ` · server time ${status.current_time}` : ''}
            {status?.next_scheduled_run ? ` · next: ${status.next_scheduled_run}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {runsQuery.isLoading ? (
            <LoadingState rows={4} columns={5} className="rounded-none border-0" />
          ) : runsQuery.isError ? (
            <ErrorState
              className="rounded-none border-0"
              title="Couldn't load run history"
              message={parseApiError(runsQuery.error).message}
              onRetry={() => void runsQuery.refetch()}
            />
          ) : (runsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={<History20Regular aria-hidden />}
              title="No runs yet"
              description="Runs appear here once the scheduler or an admin starts the finalizer."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-subtle text-caption-strong text-text-secondary">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Started</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Triggered by</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Result</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(runsQuery.data ?? []).map((run) => (
                    <tr key={run.id} className="border-b border-border-subtle text-body last:border-b-0 hover:bg-surface-hover">
                      <td className="px-5 py-2.5 tabular-nums text-text-primary">{formatDateTime(run.started_at)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={RUN_STATUS_VARIANT[run.status] ?? 'secondary'} shape="pill" className="capitalize">
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{triggeredByLabel(run)}</td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {runSummary(run)}
                        {run.error && <span className="block max-w-md truncate text-caption text-status-error" title={run.error}>{run.error}</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-text-muted">{durationLabel(run)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card className="overflow-hidden border-0 shadow">
        <CardHeader className="border-b border-border-subtle px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <ShieldCheckmark20Regular className="shrink-0 text-text-muted" aria-hidden />
            Automation Rules & Safeguards
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {notes && <p className="mb-4 text-caption text-text-muted">{notes}</p>}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[
              {
                icon: <Clock20Regular aria-hidden />,
                title: 'Held sessions only',
                text: 'Absences are only added to sessions where attendance was actually taken, after the class ends plus the grace period.',
              },
              {
                icon: <ClipboardTaskListLtr20Regular aria-hidden />,
                title: 'Unrecorded is not absent',
                text: 'If nobody took attendance, the session is listed above for a decision (held or not held) and excluded from metrics meanwhile.',
              },
              {
                icon: <CalendarLtr20Regular aria-hidden />,
                title: 'Academic calendar aware',
                text: 'Holidays, exam days, weekly off days, cancelled sessions and dates outside the active term are skipped.',
              },
              {
                icon: <People20Regular aria-hidden />,
                title: 'Idempotent and audited',
                text: 'Only students with no record receive an absent; existing records are never overwritten. Every run is logged.',
              },
            ].map((rule) => (
              <div key={rule.title} className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                  {rule.icon}
                </div>
                <div>
                  <h2 className="text-body-strong text-text-primary">{rule.title}</h2>
                  <p className="mt-0.5 text-caption text-text-muted">{rule.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoAbsentManagementPage;
