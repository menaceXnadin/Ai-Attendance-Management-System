import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowSync16Regular,
  Book16Regular,
  CalendarLtr20Regular,
  CalendarLtr24Regular,
  CheckmarkCircle16Filled,
  Clock16Regular,
  DismissCircle16Regular,
  ErrorCircle20Regular,
  Info16Regular,
  LockClosed16Regular,
  LockClosed20Regular,
  Location16Regular,
  Person16Regular,
  ScanPerson16Regular,
  ShieldCheckmark20Regular,
  Timer16Regular,
  Timer20Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { useQueryClient } from '@tanstack/react-query';
import type { Attendance } from '@/integrations/api/types';
import type { RecordStatus, StudentTodayClass } from '@/integrations/api/client';
import FaceRecognition from '@/components/FaceRecognition';
import TermStateBanner from '@/components/TermStateBanner';
import { invalidateAfterCheckin } from '@/components/face/faceQueries';
import { useTimeRestrictions } from '@/hooks/useTimeRestrictions';
import {
  formatClock,
  getTimeRemainingInWindow,
  isClassCancelled,
  myStatusOf,
  parseServerTime,
} from '@/utils/timeRestrictions';

interface StudentData {
  id?: string;
  name?: string;
  email?: string;
  studentId?: string;
  faculty?: string;
  faculty_id?: number;
  semester?: number;
  year?: number;
  batch?: number;
  /** From the student payload; `face_encoding` is always null (embeddings never leave the server). */
  face_registered?: boolean;
  face_enrollment_status?: 'none' | 'enrolled' | 'reset' | 'deleted';
}

interface TodayClassScheduleProps {
  studentData: StudentData | null;
  /** Legacy fallback only: used when the server does not send `my_status`. */
  todayAttendance?: Attendance[];
  onAttendanceMarked?: () => void;
}

type CardStatus = 'checkin_open' | 'upcoming' | 'closed' | 'cancelled' | RecordStatus;

const STATUS_META: Record<
  CardStatus,
  { label: string; pill: string; accent: string; icon: React.ReactNode }
> = {
  checkin_open: {
    label: 'Check-in open',
    pill: 'bg-brand-subtle text-brand-foreground border-brand-stroke/50',
    accent: 'bg-brand',
    icon: <span className="h-2 w-2 rounded-full bg-brand animate-pulse" aria-hidden />,
  },
  upcoming: {
    label: 'Upcoming',
    pill: 'bg-status-info-subtle text-status-info border-status-info-border',
    accent: 'bg-status-info',
    icon: <Timer16Regular className="shrink-0" aria-hidden />,
  },
  closed: {
    label: 'Check-in closed',
    pill: 'bg-surface-subtle text-text-secondary border-border-subtle',
    accent: 'bg-border-default',
    icon: <LockClosed16Regular className="shrink-0" aria-hidden />,
  },
  cancelled: {
    label: 'Cancelled',
    pill: 'bg-surface-subtle text-text-muted border-border-subtle',
    accent: 'bg-border-default',
    icon: <DismissCircle16Regular className="shrink-0" aria-hidden />,
  },
  present: {
    label: 'Present',
    pill: 'bg-status-success-subtle text-status-success border-status-success-border',
    accent: 'bg-status-success',
    icon: <CheckmarkCircle16Filled className="shrink-0" aria-hidden />,
  },
  late: {
    label: 'Late',
    pill: 'bg-status-warning-subtle text-status-warning border-status-warning-border',
    accent: 'bg-status-warning',
    icon: <Clock16Regular className="shrink-0" aria-hidden />,
  },
  absent: {
    label: 'Absent',
    pill: 'bg-status-error-subtle text-status-error border-status-error-border',
    accent: 'bg-status-error',
    icon: <Warning16Regular className="shrink-0" aria-hidden />,
  },
  excused: {
    label: 'Excused',
    pill: 'bg-status-info-subtle text-status-info border-status-info-border',
    accent: 'bg-status-info',
    icon: <Info16Regular className="shrink-0" aria-hidden />,
  },
};

const VALID_STATUSES: ReadonlySet<string> = new Set(['present', 'late', 'absent', 'excused']);

const EMPTY_REASON: Record<string, { title: string; body: string }> = {
  holiday: { title: 'Holiday', body: 'Today is a holiday — there are no classes.' },
  weekly_off: { title: 'Weekly day off', body: 'There are no classes on your weekly day off.' },
  exam: { title: 'Exam period', body: 'Regular classes are suspended for exams today.' },
  between_terms: { title: 'Between terms', body: 'No classes run until the next term starts.' },
};

const TodayClassSchedule: React.FC<TodayClassScheduleProps> = ({
  studentData,
  todayAttendance,
  onAttendanceMarked,
}) => {
  const queryClient = useQueryClient();
  const [activeClass, setActiveClass] = useState<StudentTodayClass | null>(null);

  const {
    availability,
    schedule,
    isLoading,
    isError,
    refetch,
    devPreview,
  } = useTimeRestrictions({ enabled: !!studentData });

  const classes = schedule?.classes ?? [];
  const now = Date.now();

  /** Legacy fallback for servers that do not send `my_status` yet (matches by subject). */
  const fallbackStatus = (c: StudentTodayClass): RecordStatus | null => {
    const record = (todayAttendance ?? []).find((r) => Number(r.subjectId) === c.subject_id);
    const s = record ? String(record.status).toLowerCase() : '';
    return VALID_STATUSES.has(s) ? (s as RecordStatus) : null;
  };

  const statusOf = (c: StudentTodayClass): CardStatus => {
    if (isClassCancelled(c)) return 'cancelled';
    const mine = myStatusOf(c);
    const recorded = mine === undefined ? fallbackStatus(c) : mine;
    if (recorded) return recorded;
    if (c.checkin_allowed === true) return 'checkin_open';
    switch (c.checkin_window?.state) {
      case 'open':
        return c.checkin_allowed === false ? 'closed' : 'checkin_open';
      case 'not_open':
        return 'upcoming';
      default:
        return 'closed';
    }
  };

  // FaceRecognition shows the outcome itself; refresh the server state after every answer.
  const handleResult = () => {
    void invalidateAfterCheckin(queryClient);
    onAttendanceMarked?.();
  };

  const header = (
    <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarLtr20Regular className="shrink-0 text-brand-foreground" aria-hidden />
          <CardTitle className="text-subheading text-text-primary">Today's Class Schedule</CardTitle>
        </div>
        <span className="text-caption text-text-muted">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>
    </CardHeader>
  );

  // Camera view for the selected class (kept until the student closes it, so the result stays visible)
  if (activeClass) {
    return (
      <section aria-label={`Check in to ${activeClass.subject_name}`} className="space-y-2">
        <p className="text-body text-text-secondary">
          Checking in to <span className="text-body-strong text-text-primary">{activeClass.subject_name}</span>
        </p>
        <FaceRecognition
          subjectId={activeClass.subject_id}
          sessionId={activeClass.session_id ?? null}
          scheduleId={activeClass.schedule_id ?? null}
          contextLabel={`${formatClock(activeClass.start_time)} – ${formatClock(activeClass.end_time)}`}
          autoFocus
          onResult={handleResult}
          onDone={() => setActiveClass(null)}
          onCancel={() => setActiveClass(null)}
        />
      </section>
    );
  }

  // Loading / error / empty states — check-in is closed in all of them
  if (isLoading || isError || classes.length === 0) {
    const emptyReason = schedule?.term_state === 'between_terms'
      ? EMPTY_REASON.between_terms
      : schedule?.day_status && schedule.day_status !== 'instructional'
        ? EMPTY_REASON[schedule.day_status]
        : undefined;
    return (
      <Card className="border-0 bg-surface-default shadow">
        {header}
        <CardContent className="space-y-3 p-5">
          <TermStateBanner termState={schedule?.term_state} />
          {isLoading ? (
            <div className="py-8 text-center text-caption text-text-muted">Loading today's classes…</div>
          ) : isError ? (
            <div role="alert" className="flex items-start gap-3 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2.5">
              <ErrorCircle20Regular className="mt-0.5 shrink-0 text-status-error" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body-strong text-text-primary">Couldn't load today's classes</p>
                <p className="text-body text-text-secondary">Check-in stays closed until your schedule loads.</p>
              </div>
              <Button size="sm" variant="outline" onClick={refetch}>
                <ArrowSync16Regular aria-hidden />
                Retry
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                <CalendarLtr24Regular aria-hidden />
              </div>
              <h3 className="text-subheading text-text-primary">{emptyReason?.title ?? 'No Classes Scheduled'}</h3>
              <p className="mt-1 max-w-sm text-body text-text-muted">
                {emptyReason?.body ?? 'You have no classes today, so check-in is closed. Contact your course administrator if this is unexpected.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const nextPeriod = availability.nextPeriod;

  return (
    <Card className="border-0 bg-surface-default shadow">
      {header}
      <CardContent className="space-y-3 p-5">
        <TermStateBanner termState={schedule?.term_state} />

        {/* Check-in availability (Fluent message bar) */}
        <div
          role="status"
          className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${
            availability.allowed
              ? 'border-status-success-border bg-status-success-subtle'
              : 'border-status-warning-border bg-status-warning-subtle'
          }`}
        >
          {availability.allowed ? (
            <ShieldCheckmark20Regular className="mt-0.5 shrink-0 text-status-success" aria-hidden />
          ) : (
            <LockClosed20Regular className="mt-0.5 shrink-0 text-status-warning" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-body-strong text-text-primary">
              {availability.allowed ? 'Check-in available' : 'Check-in closed'}
            </p>
            <p className="text-body text-text-secondary">{availability.reason}</p>
            {availability.allowed && availability.openClass?.checkin_window?.closes_at && (
              <p className="mt-0.5 text-caption text-text-muted">
                {getTimeRemainingInWindow(availability.openClass.checkin_window.closes_at, now)}
              </p>
            )}
            {!availability.allowed && availability.timeUntilNext && nextPeriod && (
              <p className="mt-0.5 text-caption text-text-muted">Opens in {availability.timeUntilNext}</p>
            )}
            {devPreview && (
              <p className="mt-1 text-caption text-text-muted">
                Developer preview is on — it does not bypass the server's check-in rules.
              </p>
            )}
          </div>
        </div>

        {/* Class "meeting" cards */}
        <ul className="space-y-2" aria-label="Today's classes">
          {classes.map((cls, index) => {
            const status = statusOf(cls);
            const meta = STATUS_META[status];
            const isCancelled = status === 'cancelled';
            const isOpen = status === 'checkin_open';
            const win = cls.checkin_window;
            const lateAfter = parseServerTime(win?.late_after);
            const willBeLate = isOpen && !!lateAfter && lateAfter.getTime() <= now;
            return (
              <li
                key={`${cls.session_id ?? cls.id}-${cls.start_time}-${index}`}
                className={`relative flex gap-3 overflow-hidden rounded-md border bg-surface-default py-3 pl-4 pr-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover sm:gap-4 ${
                  isOpen ? 'border-brand-stroke/60' : 'border-border-subtle'
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${meta.accent}`} aria-hidden />

                {/* Time column */}
                <div className="w-[68px] shrink-0 pt-0.5">
                  <p className={`text-body-strong tabular-nums ${isCancelled ? 'text-text-muted' : 'text-text-primary'}`}>
                    {formatClock(cls.start_time)}
                  </p>
                  <p className="text-caption tabular-nums text-text-muted">{formatClock(cls.end_time)}</p>
                </div>

                <div className="w-px shrink-0 self-stretch bg-border-subtle" aria-hidden />

                {/* Details + action */}
                <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`truncate text-body-strong ${isCancelled ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {cls.subject_name}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-caption-strong ${meta.pill}`}>
                        {meta.icon}
                        <span className="truncate">{meta.label}</span>
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
                      {cls.subject_code && (
                        <span className="inline-flex items-center gap-1">
                          <Book16Regular className="shrink-0" aria-hidden />
                          {cls.subject_code}
                        </span>
                      )}
                      {cls.instructor_name && (
                        <span className="inline-flex items-center gap-1">
                          <Person16Regular className="shrink-0" aria-hidden />
                          {cls.instructor_name}
                        </span>
                      )}
                      {cls.classroom && (
                        <span className="inline-flex items-center gap-1">
                          <Location16Regular className="shrink-0" aria-hidden />
                          {cls.classroom}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-1 md:items-end">
                    {isCancelled ? (
                      cls.cancellation_reason ? (
                        <p className="max-w-[220px] text-caption text-text-muted md:text-right">{cls.cancellation_reason}</p>
                      ) : null
                    ) : isOpen ? (
                      !studentData?.face_registered ? (
                        studentData?.face_enrollment_status === 'deleted' ? (
                          <>
                            <Badge variant="warning" shape="pill" className="gap-1">
                              <LockClosed16Regular className="shrink-0" aria-hidden />
                              Face check-in locked
                            </Badge>
                            <p className="max-w-[220px] text-caption text-text-muted md:text-right">
                              Ask an administrator to reset your face registration
                            </p>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" asChild className="gap-1.5">
                              <Link to="/face-registration">
                                <Warning16Regular aria-hidden />
                                Register face
                              </Link>
                            </Button>
                            <p className="text-caption text-text-muted md:text-right">Needed before you can check in</p>
                          </>
                        )
                      ) : (
                        <>
                          <Button size="sm" onClick={() => setActiveClass(cls)} className="gap-1.5">
                            <ScanPerson16Regular aria-hidden />
                            Check in
                          </Button>
                          <p className="text-caption text-text-muted md:text-right">
                            {willBeLate ? 'Late check-in · ' : ''}
                            {win?.closes_at ? `until ${formatClock(win.closes_at)}` : ''}
                          </p>
                        </>
                      )
                    ) : status === 'upcoming' ? (
                      <p className="text-caption text-text-muted md:text-right">
                        {win?.opens_at ? `Check-in opens ${formatClock(win.opens_at)}` : 'Not open yet'}
                      </p>
                    ) : status === 'closed' ? (
                      <p className="max-w-[220px] text-caption text-text-muted md:text-right">
                        {win ? 'No check-in recorded' : 'Check-in window unavailable'}
                      </p>
                    ) : status === 'absent' ? (
                      <p className="text-caption text-text-muted md:text-right">Recorded absent</p>
                    ) : status === 'present' || status === 'late' ? (
                      <p className="text-caption text-text-muted md:text-right">Attendance recorded</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Next check-in info */}
        {!availability.allowed && nextPeriod && availability.timeUntilNext && (
          <div className="flex items-start gap-3 rounded-md border border-status-info-border bg-status-info-subtle px-3 py-2.5">
            <Timer20Regular className="mt-0.5 shrink-0 text-status-info" aria-hidden />
            <div className="min-w-0">
              <p className="text-body-strong text-text-primary">Next Class</p>
              <p className="text-body text-text-secondary">
                Check-in for {nextPeriod.name} opens in {availability.timeUntilNext}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TodayClassSchedule;
