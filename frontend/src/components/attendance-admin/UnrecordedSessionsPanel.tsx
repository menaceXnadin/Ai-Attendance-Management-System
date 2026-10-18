import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowSync16Regular,
  CalendarCancel16Regular,
  CheckmarkCircle16Regular,
  ChevronDown16Regular,
  ClipboardTaskListLtr20Regular,
  ErrorCircle16Regular,
  PersonDelete16Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { api, parseApiError, type UnrecordedSession } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import SessionRegister from './SessionRegister';
import SessionStatusDialog from './SessionStatusDialog';
import { entryErrors, legacyFailure } from './errors';
import { MessageBar, formatDateLabel, formatTimeRange } from './shared';

type RangeKey = '7' | '14' | '30' | 'all';

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const ageLabel = (days?: number | null) => {
  if (typeof days !== 'number' || !Number.isFinite(days)) return '';
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

/* -------------------------------------------------------------------------- */
/* Quick resolve: confirm held + mark everyone unmarked absent                  */
/* -------------------------------------------------------------------------- */

const QuickHeldDialog: React.FC<{
  session: UnrecordedSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}> = ({ session, open, onOpenChange, onDone }) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.sessions.submitRegister(session.id, {
        entries: [],
        mark_remaining_absent: true,
        confirm_held: true,
        reason: reason.trim() || undefined,
      });
      const legacy = legacyFailure(res);
      if (legacy) throw Object.assign(new Error(legacy.message), { response: { status: 200, data: { detail: legacy.detail } } });
      return res;
    },
    onSuccess: (res) => {
      const created = Array.isArray(res?.results) ? res.results.filter((r) => r.outcome === 'created').length : null;
      toast({
        title: 'Session resolved as held',
        description:
          created !== null ? `${created} student${created === 1 ? '' : 's'} marked absent.` : 'The register was submitted.',
      });
      onOpenChange(false);
      onDone();
    },
    onError: (err) => {
      const info = parseApiError(err);
      const first = entryErrors(info)[0];
      setError(first ? `${info.message} (${first.message})` : info.message);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setReason('');
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">Resolve as held — everyone unmarked absent</DialogTitle>
          <DialogDescription className="text-body text-text-muted">
            {session.subject_name} · {formatDateLabel(session.session_date)} · {formatTimeRange(session.start_time, session.end_time)}
          </DialogDescription>
        </DialogHeader>
        <MessageBar tone="warning" icon={<Warning16Regular />}>
          The session is recorded as held and every enrolled student without a record is marked{' '}
          <strong className="font-semibold">absent</strong> by you (an admin write, audited). Use this only when you know
          the class took place and nobody attended or checked in. Otherwise open the register and mark students
          individually.
        </MessageBar>
        <div className="flex flex-col gap-1">
          <label htmlFor="quick-held-reason" className="text-body-strong text-text-primary">
            Reason <span className="font-normal text-text-muted">(recommended)</span>
          </label>
          <Textarea
            id="quick-held-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Teacher confirmed the class was held; register was not submitted"
          />
        </div>
        {error && (
          <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
            {error}
          </MessageBar>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Back
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Confirm held & mark absent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------------------------------------------------------------- */
/* Panel                                                                       */
/* -------------------------------------------------------------------------- */

export interface UnrecordedSessionsPanelProps {
  className?: string;
  /** Called after any resolution so parents can refresh counters. */
  onResolved?: () => void;
}

/**
 * "Unrecorded & review" (DOMAIN_RULES §13.4): past sessions nobody recorded and
 * sessions flagged for review by a calendar change. Resolution is explicit —
 * Held (register submission) or Not held (cancel with reason). Unrecorded
 * sessions are never converted into absences automatically.
 */
/** Rows per page of the unrecorded list (server max is 1000). */
const PAGE_SIZE = 50;

const UnrecordedSessionsPanel: React.FC<UnrecordedSessionsPanelProps> = ({ className, onResolved }) => {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeKey>('14');
  const [registerFor, setRegisterFor] = useState<UnrecordedSession | null>(null);
  const [quickFor, setQuickFor] = useState<UnrecordedSession | null>(null);
  const [cancelFor, setCancelFor] = useState<UnrecordedSession | null>(null);
  const [keepFor, setKeepFor] = useState<UnrecordedSession | null>(null);

  const [page, setPage] = useState(0);
  const params = useMemo(
    () => ({
      ...(range === 'all' ? {} : { from: daysAgo(Number(range)) }),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [range, page]
  );

  const query = useQuery({
    queryKey: ['unrecorded-sessions', params],
    queryFn: () => api.sessions.listUnrecorded(params),
    refetchInterval: 60_000,
  });

  const sessions = query.data?.sessions ?? [];
  const withoutTeacher = query.data?.schedules_without_teacher ?? 0;
  const reviewCount = sessions.filter((s) => s.review_required).length;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['unrecorded-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['auto-absent-status'] });
    onResolved?.();
  };

  return (
    <section className={`overflow-hidden rounded-lg bg-surface-default shadow ${className ?? ''}`}>
      <header className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-subheading text-text-primary">
            <ClipboardTaskListLtr20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Unrecorded &amp; review
            {query.data && (
              <Badge variant={sessions.length ? 'warning' : 'secondary'} shape="pill" className="tabular-nums">
                {query.data.total}
              </Badge>
            )}
          </h2>
          <p className="mt-0.5 text-caption text-text-muted">
            Past sessions where nobody took attendance, plus sessions a calendar change flagged for review. They are
            excluded from metrics until resolved — never auto-absented.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={range}
            onValueChange={(v) => {
              setRange(v as RangeKey);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-[140px]" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <ArrowSync16Regular className={query.isFetching ? 'animate-spin' : ''} aria-hidden />
            Refresh
          </Button>
        </div>
      </header>

      {(withoutTeacher > 0 || reviewCount > 0) && (
        <div className="space-y-2 px-5 pt-4">
          {withoutTeacher > 0 && (
            <MessageBar
              tone="warning"
              icon={<PersonDelete16Regular />}
              actions={
                <Link to="/app/schedules" className="text-body-strong text-brand-foreground underline-offset-4 hover:underline">
                  Open timetable
                </Link>
              }
            >
              <strong className="font-semibold tabular-nums">{withoutTeacher}</strong> active timetable entr
              {withoutTeacher === 1 ? 'y has' : 'ies have'} no teacher assigned. Nobody can take attendance for those
              classes except an admin, so they will keep appearing here.
            </MessageBar>
          )}
          {reviewCount > 0 && (
            <MessageBar tone="info" icon={<Warning16Regular />}>
              <strong className="font-semibold tabular-nums">{reviewCount}</strong> session
              {reviewCount === 1 ? '' : 's'} with existing attendance now fall on a holiday, exam or cancellation. Decide
              whether each was held.
            </MessageBar>
          )}
        </div>
      )}

      <div className="pt-4">
        {query.isLoading ? (
          <LoadingState rows={4} columns={6} className="rounded-none border-x-0 border-b-0" />
        ) : query.isError ? (
          <ErrorState
            className="rounded-none border-x-0 border-b-0"
            title="Couldn't load unrecorded sessions"
            message={parseApiError(query.error).message}
            onRetry={() => void query.refetch()}
          />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<CheckmarkCircle16Regular aria-hidden />}
            title="Nothing to follow up"
            description="Every past session in this range was recorded or cancelled."
          />
        ) : (
          <div className="overflow-x-auto border-t border-border-subtle">
            <Table>
              <TableHeader className="bg-surface-subtle">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Date</TableHead>
                  <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Subject</TableHead>
                  <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Cohort</TableHead>
                  <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Teacher</TableHead>
                  <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Needs</TableHead>
                  <TableHead className="px-4 text-right text-caption-strong normal-case tracking-normal text-text-secondary">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id} className="border-b border-border-subtle hover:bg-surface-hover">
                    <TableCell className="px-4 py-2.5">
                      <p className="text-body-strong text-text-primary">{formatDateLabel(s.session_date)}</p>
                      <p className="text-caption tabular-nums text-text-muted">
                        {formatTimeRange(s.start_time, s.end_time)} · {ageLabel(s.age_days)}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <p className="text-body text-text-primary">{s.subject_name ?? `Subject #${s.subject_id}`}</p>
                      <p className="font-mono text-caption text-text-muted">
                        {s.subject_code}
                        {s.kind === 'makeup' ? ' · Make-up' : ''}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-body text-text-secondary">
                      {s.faculty_name ?? `Faculty #${s.faculty_id}`}
                      {s.semester ? <span className="block text-caption text-text-muted">Semester {s.semester}</span> : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {s.teacher_name ? (
                        <span className="text-body text-text-primary">{s.teacher_name}</span>
                      ) : s.teacher_id ? (
                        <span className="text-body text-text-secondary">Teacher #{s.teacher_id}</span>
                      ) : (
                        <Badge variant="warning" shape="pill">No teacher</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {s.review_required ? (
                        <div className="space-y-0.5">
                          <Badge variant="info" shape="pill">Review</Badge>
                          {s.review_reason && <p className="max-w-[240px] text-caption text-text-muted">{s.review_reason}</p>}
                        </div>
                      ) : (
                        <Badge variant="warning" shape="pill">Unrecorded</Badge>
                      )}
                      {typeof s.recorded_count === 'number' && typeof s.roster_size === 'number' && (
                        <p className="mt-0.5 text-caption tabular-nums text-text-muted">
                          {s.recorded_count}/{s.roster_size} recorded
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm">
                              Resolve as held
                              <ChevronDown16Regular aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setRegisterFor(s)}>Open register…</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setQuickFor(s)}>Held — mark everyone unmarked absent…</DropdownMenuItem>
                            {s.review_required && (
                              <DropdownMenuItem onSelect={() => setKeepFor(s)}>Keep as recorded (clear review)…</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" onClick={() => setCancelFor(s)}>
                          <CalendarCancel16Regular aria-hidden />
                          Not held
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {query.data && (query.data.has_more || page > 0) && (
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <p className="text-caption tabular-nums text-text-muted">
              {query.data.offset + 1}–{query.data.offset + sessions.length} of {query.data.total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!query.data.has_more} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Register dialog */}
      <Dialog open={registerFor !== null} onOpenChange={(open) => !open && setRegisterFor(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-section-title">Resolve as held</DialogTitle>
            <DialogDescription className="text-body text-text-muted">
              Mark the students who attended. Submitting confirms the class was held.
            </DialogDescription>
          </DialogHeader>
          {registerFor && (
            <div className="px-6 pb-6">
              <SessionRegister
                key={registerFor.id}
                sessionId={registerFor.id}
                preconfirmedHeld
                onChanged={() => {
                  refresh();
                  setRegisterFor(null);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {quickFor && (
        <QuickHeldDialog
          session={quickFor}
          open={quickFor !== null}
          onOpenChange={(open) => !open && setQuickFor(null)}
          onDone={refresh}
        />
      )}

      {cancelFor && (
        <SessionStatusDialog
          mode="cancel"
          session={cancelFor}
          open={cancelFor !== null}
          onOpenChange={(open) => !open && setCancelFor(null)}
          onDone={refresh}
        />
      )}
      {keepFor && (
        <SessionStatusDialog
          mode="keep"
          session={keepFor}
          open={keepFor !== null}
          onOpenChange={(open) => !open && setKeepFor(null)}
          onDone={refresh}
        />
      )}
    </section>
  );
};

export default UnrecordedSessionsPanel;
