import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowClockwise16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  ErrorCircle16Regular,
  Info16Regular,
  ScanPerson20Regular,
} from '@fluentui/react-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/LoadingState';
import { MessageBar } from '@/components/attendance-admin/shared';
import { api, parseApiError, type FaceAttempt } from '@/integrations/api/client';
import { cn } from '@/lib/utils';
import { OutcomeBadge, ToneDot } from './FaceBadges';
import { formatClock, outcomeLabel, outcomeTone } from './faceLabels';

const AUTO_REFRESH_MS = 20_000;

export interface FaceAttemptsPanelProps {
  sessionId: number;
  /** Auto-refresh only makes sense while the class is happening. */
  isToday: boolean;
  /** `card` = standalone surface; `embedded` = bordered well inside another card. */
  variant?: 'card' | 'embedded';
  defaultOpen?: boolean;
  className?: string;
}

const score = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : null;

/**
 * Collapsible "Face check-in attempts" list for one class session
 * (`GET /attendance/sessions/{id}/face-attempts`, docs/system/face-verification.md §9).
 * Fetches only while expanded; refreshes every 20 s for today's sessions.
 */
const FaceAttemptsPanel: React.FC<FaceAttemptsPanelProps> = ({
  sessionId,
  isToday,
  variant = 'card',
  defaultOpen = false,
  className,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [failuresOnly, setFailuresOnly] = useState(false);

  const query = useQuery({
    queryKey: ['face-attempts', sessionId],
    queryFn: () => api.sessions.getFaceAttempts(sessionId),
    enabled: open,
    staleTime: 10_000,
    refetchInterval: open && isToday ? AUTO_REFRESH_MS : false,
    retry: (count, err) => {
      const { status } = parseApiError(err);
      return status !== 403 && status !== 404 && count < 2;
    },
  });

  const summary = query.data?.summary;
  const attempts = useMemo<FaceAttempt[]>(() => query.data?.attempts ?? [], [query.data]);
  const visible = useMemo(
    () => (failuresOnly ? attempts.filter((a) => a.outcome !== 'success') : attempts),
    [attempts, failuresOnly]
  );
  const outcomeChips = useMemo(
    () =>
      Object.entries(summary?.by_outcome ?? {})
        .filter(([outcome, count]) => outcome !== 'success' && count > 0)
        .sort((a, b) => b[1] - a[1]),
    [summary]
  );

  const errorInfo = query.isError ? parseApiError(query.error) : null;
  const forbidden = errorInfo?.status === 403;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        variant === 'card'
          ? 'rounded-lg bg-surface-default shadow'
          : 'rounded-md border border-border-subtle bg-surface-subtle',
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-text-primary"
          >
            {open ? (
              <ChevronDown16Regular className="shrink-0 text-text-muted" aria-hidden />
            ) : (
              <ChevronRight16Regular className="shrink-0 text-text-muted" aria-hidden />
            )}
            <ScanPerson20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            <span className="text-body-strong text-text-primary">Face check-in attempts</span>
            {summary && (
              <span className="truncate text-caption tabular-nums text-text-muted">
                {summary.total} total · {summary.successes} checked in · {summary.failures} failed
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        {open && (
          <div className="flex shrink-0 items-center gap-2">
            {isToday && (
              <span className="hidden text-caption text-text-muted sm:inline">Auto-refreshes every 20 s</span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              aria-label="Refresh face check-in attempts"
              title="Refresh"
            >
              <ArrowClockwise16Regular className={cn(query.isFetching && 'animate-spin')} aria-hidden />
            </Button>
          </div>
        )}
      </div>

      <CollapsibleContent className="border-t border-border-subtle">
        {query.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" label="Loading attempts…" labelPosition="after" />
          </div>
        ) : forbidden ? (
          <div className="p-4">
            <MessageBar tone="info" icon={<Info16Regular />}>
              Only the session's teacher or an administrator can see face check-in attempts.
            </MessageBar>
          </div>
        ) : errorInfo && !query.data ? (
          <div className="p-4">
            <MessageBar
              tone="error"
              role="alert"
              icon={<ErrorCircle16Regular />}
              actions={
                <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                  Retry
                </Button>
              }
            >
              Couldn't load face check-in attempts. {errorInfo.message}
            </MessageBar>
          </div>
        ) : attempts.length === 0 ? (
          <p className="px-4 py-5 text-center text-body text-text-muted">
            No face check-in attempts for this session yet.
          </p>
        ) : (
          <div className="space-y-3 px-4 py-3">
            {/* Summary chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="success" shape="pill">
                Checked in {summary?.successes ?? 0}
              </Badge>
              <Badge variant={summary && summary.failures > 0 ? 'destructive' : 'secondary'} shape="pill">
                Failed {summary?.failures ?? 0}
              </Badge>
              {outcomeChips.map(([outcome, count]) => (
                <span
                  key={outcome}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-default px-2 py-0.5 text-caption text-text-secondary"
                >
                  <ToneDot tone={outcomeTone(outcome)} />
                  {outcomeLabel(outcome)}
                  <span className="font-semibold tabular-nums text-text-primary">{count}</span>
                </span>
              ))}
              <div
                className="ml-auto inline-flex overflow-hidden rounded-md border border-border-default"
                role="group"
                aria-label="Filter attempts"
              >
                {[
                  { value: false, label: 'All' },
                  { value: true, label: 'Unsuccessful' },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={failuresOnly === opt.value}
                    onClick={() => setFailuresOnly(opt.value)}
                    className={cn(
                      'h-6 border-r border-border-default px-2 text-caption-strong transition-colors duration-150 last:border-r-0',
                      failuresOnly === opt.value
                        ? 'bg-brand-subtle text-brand-foreground'
                        : 'bg-surface-default text-text-secondary hover:bg-surface-hover'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {errorInfo && (
              <MessageBar tone="warning" icon={<ErrorCircle16Regular />}>
                Couldn't refresh — showing the last loaded list.
              </MessageBar>
            )}

            {/* Attempt list (newest first) */}
            {visible.length === 0 ? (
              <p className="py-3 text-center text-body text-text-muted">Every attempt so far was a successful check-in.</p>
            ) : (
              <ul
                className="max-h-80 divide-y divide-border-subtle overflow-y-auto rounded-md border border-border-subtle bg-surface-default"
                aria-label="Face check-in attempts, newest first"
              >
                {visible.map((a) => {
                  const similarity = score(a.similarity);
                  const liveness = score(a.liveness_score);
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-strong text-text-primary">
                          {a.student_name || `Student #${a.student_id}`}
                        </p>
                        <p className="truncate text-caption text-text-muted">
                          {a.roll_number && <span className="font-mono">{a.roll_number}</span>}
                          {(similarity || liveness) && (
                            <span className="font-mono" title="Staff only: best face similarity and liveness score">
                              {a.roll_number ? ' · ' : ''}
                              {similarity ? `match ${similarity}` : ''}
                              {similarity && liveness ? ' · ' : ''}
                              {liveness ? `live ${liveness}` : ''}
                            </span>
                          )}
                        </p>
                      </div>
                      <OutcomeBadge outcome={a.outcome} countsAsFailure={a.counts_as_failure} className="shrink-0" />
                      <time
                        dateTime={a.created_at}
                        className="w-[4.75rem] shrink-0 text-right text-caption tabular-nums text-text-muted"
                      >
                        {formatClock(a.created_at, true)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
            {attempts.length >= 200 && (
              <p className="text-caption text-text-muted">Showing the latest 200 attempts.</p>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default FaceAttemptsPanel;
