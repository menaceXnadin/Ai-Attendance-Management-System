/**
 * Standalone face check-in (`/student/attendance/mark`), also the target of the classroom QR
 * code: `?session=<id>&code=<6 digits>` (docs/system/face-verification.md §9, §10).
 * Which class is open comes from the server (`GET /schedules/student/today`); this page fails
 * closed while that is loading or unavailable.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import StudentSidebar from '@/components/StudentSidebar';
import FaceRecognition from '@/components/FaceRecognition';
import FaceMessage from '@/components/face/FaceMessage';
import { invalidateAfterCheckin, useFaceEnrollment } from '@/components/face/faceQueries';
import { normalizePresenceCode } from '@/components/face/presenceCode';
import TermStateBanner from '@/components/TermStateBanner';
import { Button } from '@/components/ui/button';
import { ArrowClockwise20Regular, Camera20Regular } from '@fluentui/react-icons';
import { useTimeRestrictions } from '@/hooks/useTimeRestrictions';
import type { StudentTodayClass } from '@/integrations/api/client';
import { formatClock, isClassCancelled, myStatusOf } from '@/utils/timeRestrictions';

const isOpenForCheckin = (c: StudentTodayClass): boolean => {
  if (isClassCancelled(c) || myStatusOf(c)) return false;
  if (c.checkin_allowed === true) return true;
  return c.checkin_window?.state === 'open' && c.checkin_allowed !== false;
};

/** Why the targeted class can't be checked in to right now (server data only). */
const closedReason = (c: StudentTodayClass): string => {
  if (isClassCancelled(c)) return `${c.subject_name} has been cancelled — no check-in needed.`;
  const mine = myStatusOf(c);
  if (mine) return `Your attendance for ${c.subject_name} is already recorded as ${mine}.`;
  if (c.checkin_window?.state === 'not_open') {
    const opens = formatClock(c.checkin_window.opens_at);
    return `Check-in for ${c.subject_name} opens${opens ? ` at ${opens}` : ' soon'}.`;
  }
  return `The check-in window for ${c.subject_name} is closed.`;
};

const StudentMarkAttendancePage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionParam = Number(params.get('session')) || null;
  const codeParam = normalizePresenceCode(params.get('code')) || null;

  const { availability, schedule, isLoading, isError, refetch } = useTimeRestrictions();
  const enrollment = useFaceEnrollment();

  const classes = schedule?.classes ?? [];
  const target: StudentTodayClass | undefined = sessionParam
    ? classes.find((c) => c.session_id === sessionParam)
    : availability.openClass;
  const openTarget = target && isOpenForCheckin(target) ? target : undefined;
  const enrollmentAllows = !enrollment.data || enrollment.data.status === 'enrolled';

  // Keep the class once check-in is offered, so refetches (polling, or the refresh after a
  // successful check-in) don't swap the camera/result view for a "recorded" message.
  const [pinned, setPinned] = useState<StudentTodayClass | null>(null);
  useEffect(() => {
    if (!pinned && openTarget && enrollmentAllows && !enrollment.isLoading) setPinned(openTarget);
  }, [pinned, openTarget, enrollmentAllows, enrollment.isLoading]);
  const active = pinned ?? (enrollmentAllows && !enrollment.isLoading ? openTarget : undefined);

  let body: React.ReactNode;
  if (active) {
    body = (
      <div className="space-y-3">
        <p className="text-body text-text-secondary">
          Checking in to <span className="text-body-strong text-text-primary">{active.subject_name}</span>
          {active.checkin_window?.closes_at ? ` · open until ${formatClock(active.checkin_window.closes_at)}` : ''}
        </p>
        <FaceRecognition
          key={active.session_id ?? `${active.id}-${active.start_time}`}
          subjectId={active.subject_id}
          sessionId={active.session_id ?? null}
          scheduleId={active.schedule_id ?? null}
          contextLabel={`${formatClock(active.start_time)} – ${formatClock(active.end_time)}`}
          initialPresenceCode={codeParam}
          autoFocus
          onResult={() => void invalidateAfterCheckin(queryClient)}
          onDone={() => navigate('/student')}
          onCancel={() => navigate('/student')}
        />
      </div>
    );
  } else if (isLoading || enrollment.isLoading) {
    body = (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="flex items-center gap-3 text-body text-text-secondary" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden />
          Loading today's classes…
        </div>
      </div>
    );
  } else if (isError && !schedule) {
    body = (
      <FaceMessage
        tone="error"
        title="Couldn't load today's classes"
        actions={
          <Button size="sm" variant="outline" onClick={refetch}>
            <ArrowClockwise20Regular aria-hidden />
            Retry
          </Button>
        }
      >
        Check-in stays closed until your schedule loads.
      </FaceMessage>
    );
  } else if (enrollment.data && enrollment.data.status !== 'enrolled') {
    const locked = enrollment.data.status === 'deleted' || !enrollment.data.can_enroll;
    body = (
      <FaceMessage
        tone="warning"
        title={locked ? 'Face registration locked' : 'Register your face first'}
        actions={
          !locked && (
            <Button size="sm" asChild>
              <Link to="/face-registration">
                <Camera20Regular aria-hidden />
                Register face
              </Link>
            </Button>
          )
        }
      >
        {locked
          ? 'You deleted your face data. Ask an administrator to reset your face registration before you can check in with your face.'
          : 'Face check-in needs a registered face. It takes less than a minute.'}
      </FaceMessage>
    );
  } else if (sessionParam && !target) {
    body = (
      <FaceMessage tone="warning" title="This check-in link isn't for one of your classes today">
        Make sure you scanned the code for your own class. {availability.reason}
      </FaceMessage>
    );
  } else if (!target) {
    body = (
      <FaceMessage tone="info" title="No class is open for check-in" role="status">
        {availability.reason}
      </FaceMessage>
    );
  } else {
    body = (
      <FaceMessage tone={myStatusOf(target) ? 'info' : 'warning'} title="Check-in not available" role="status">
        {closedReason(target)}
      </FaceMessage>
    );
  }

  return (
    <StudentSidebar>
      <div className="mx-auto max-w-xl space-y-4 py-2">
        <div className="page-header mb-0">
          <div>
            <h1 className="text-page-title text-text-primary">Check in</h1>
            <p className="mt-1 text-body text-text-muted">Confirm your attendance with your face.</p>
          </div>
        </div>
        <TermStateBanner termState={schedule?.term_state} />
        {body}
      </div>
    </StudentSidebar>
  );
};

export default StudentMarkAttendancePage;
