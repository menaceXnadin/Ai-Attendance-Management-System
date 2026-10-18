import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarLtr24Regular } from '@fluentui/react-icons';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { api, parseApiError } from '@/integrations/api/client';
import SessionRegister from './SessionRegister';
import { SessionStatusBadge, formatDateLabel, formatTimeRange } from './shared';

export interface DateSessionRegisterProps {
  facultyId: number;
  semester: number;
  subjectId: number;
  /** `YYYY-MM-DD` */
  date: string;
  onChanged?: () => void;
}

/**
 * Resolves the class session(s) of a subject+cohort on a date
 * (`GET /attendance/sessions`, materialized on demand) and shows the register
 * for the selected one. Never guesses between multiple slots.
 */
const DateSessionRegister: React.FC<DateSessionRegisterProps> = ({ facultyId, semester, subjectId, date, onChanged }) => {
  const query = useQuery({
    queryKey: ['class-sessions', { date, facultyId, semester, subjectId }],
    queryFn: () => api.sessions.list({ date, faculty_id: facultyId, semester, subject_id: subjectId }),
    enabled: Boolean(date && facultyId && semester && subjectId),
  });

  const sessions = useMemo(() => query.data ?? [], [query.data]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!sessions.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !sessions.some((s) => s.id === selectedId)) {
      setSelectedId(sessions[0].id);
    }
  }, [sessions, selectedId]);

  if (query.isLoading) return <LoadingState rows={5} columns={4} />;
  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load class sessions"
        message={parseApiError(query.error).message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (sessions.length === 0) {
    return (
      <EmptyState
        className="shadow"
        icon={<CalendarLtr24Regular aria-hidden />}
        title={`No class session on ${formatDateLabel(date)}`}
        description="This subject has no session for the cohort on that date — it may be a weekly off day, a holiday or exam day, outside the active term, or not on the timetable."
      />
    );
  }

  return (
    <div className="space-y-3">
      {sessions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-default px-4 py-3 shadow">
          <span className="text-body-strong text-text-primary">Session</span>
          <div className="inline-flex flex-wrap gap-1" role="radiogroup" aria-label="Choose class session">
            {sessions.map((s) => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedId(s.id)}
                  className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-body transition-colors duration-150 ease-fluent-standard ${
                    active
                      ? 'border-brand-stroke bg-brand-subtle font-semibold text-brand-foreground'
                      : 'border-border-default bg-surface-default text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <span className="tabular-nums">{formatTimeRange(s.start_time, s.end_time)}</span>
                  <SessionStatusBadge session={s} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {selectedId !== null && <SessionRegister key={selectedId} sessionId={selectedId} onChanged={onChanged} />}
    </div>
  );
};

export default DateSessionRegister;
