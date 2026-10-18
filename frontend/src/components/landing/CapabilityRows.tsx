import * as React from 'react';
import {
  ArrowRight12Regular,
  CalendarCancel20Regular,
  CheckmarkCircle16Regular,
  DismissCircle16Regular,
  History20Regular,
  Prohibited16Regular,
  QuestionCircle16Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Photo, RuleList, ScreenFrame, Section, SectionHeader } from './primitives';
import { teacherFront } from './photos';
import { teacherRegister } from './screens';

/**
 * "For the people who run the term": three capabilities, each with its own
 * composition (composed calendar, photo + screenshot, composed audit log).
 * The composed panels are illustrations built from tokens and say so.
 */

/** Same quiet elevation ScreenFrame uses, so composed panels read as product UI. */
const PANEL_SHADOW = 'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.22)]';

/* -------------------------------------------------------------------------- */
/* Row a: composed student calendar                                           */
/* -------------------------------------------------------------------------- */

type ClassDay = 'present' | 'partial' | 'absent' | 'cancelled' | 'unrecorded';
type CalendarDay = 'holiday' | 'exam' | 'weekly_off';
type DayStatus = ClassDay | CalendarDay;

/** Days with classes carry a status mark (the same icons the student calendar uses). */
const CLASS_DAY: Record<ClassDay, { label: string; icon: React.ReactElement; tone: string }> = {
  present: { label: 'Present', icon: <CheckmarkCircle16Regular />, tone: 'text-status-success' },
  partial: { label: 'Partial', icon: <Warning16Regular />, tone: 'text-status-warning' },
  absent: { label: 'Absent', icon: <DismissCircle16Regular />, tone: 'text-status-error' },
  cancelled: { label: 'Cancelled', icon: <Prohibited16Regular />, tone: 'text-text-muted' },
  unrecorded: { label: 'Not recorded', icon: <QuestionCircle16Regular />, tone: 'text-text-secondary' },
};

/** Days the academic calendar decides are tinted as a whole. */
const CALENDAR_DAY: Record<CalendarDay, { label: string; cell: string; text: string; swatch: string }> = {
  holiday: {
    label: 'Holiday',
    cell: 'bg-status-info-subtle',
    text: 'text-status-info',
    swatch: 'border-status-info-border bg-status-info-subtle',
  },
  exam: {
    label: 'Exam',
    cell: 'bg-brand-subtle',
    text: 'text-brand-foreground',
    swatch: 'border-brand-stroke/60 bg-brand-subtle',
  },
  weekly_off: {
    label: 'Day off',
    cell: 'bg-surface-canvas',
    text: 'text-text-muted',
    swatch: 'border-border-default bg-surface-canvas',
  },
};

const isCalendarDay = (s: DayStatus): s is CalendarDay => s in CALENDAR_DAY;

/** An example 30-day month whose 1st falls on a Tuesday; weeks start on Sunday. */
const FIRST_WEEKDAY = 2;
const DAYS_IN_MONTH = 30;
const SELECTED_DAY = 9;
const EXAMPLE_DAYS: Partial<Record<number, DayStatus>> = {
  3: 'partial',
  7: 'absent',
  9: 'holiday',
  14: 'cancelled',
  16: 'unrecorded',
  18: 'partial',
  27: 'exam',
  28: 'exam',
  29: 'exam',
  30: 'exam',
};

const statusOf = (day: number): DayStatus => {
  const weekday = (FIRST_WEEKDAY + day - 1) % 7; // 0 = Sunday
  if (weekday === 6) return 'weekly_off'; // Saturday on the Nepal calendar
  return EXAMPLE_DAYS[day] ?? 'present';
};

const CELLS: Array<number | null> = Array.from({ length: 35 }, (_, i) => {
  const day = i - FIRST_WEEKDAY + 1;
  return day >= 1 && day <= DAYS_IN_MONTH ? day : null;
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CalendarPreview: React.FC = () => (
  <figure className="w-full">
    <div aria-hidden className={cn('overflow-hidden rounded-lg border border-border-subtle bg-surface-default', PANEL_SHADOW)}>
      {/* Title bar */}
      <div className="flex items-end justify-between gap-4 border-b border-border-subtle px-4 py-3 sm:px-5">
        <div>
          <p className="text-caption text-text-muted">My attendance</p>
          <p className="text-subheading text-text-primary">September</p>
        </div>
        <p className="text-caption text-text-muted">Classes Sunday to Friday</p>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-subtle">
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-1.5 py-1.5 text-caption-strong text-text-muted sm:px-2">
            <span className="sm:hidden">{d.charAt(0)}</span>
            <span className="hidden sm:inline">{d}</span>
          </span>
        ))}
      </div>

      {/* Month grid: 1px gaps over a border-coloured backdrop draw the hairlines */}
      <div className="grid grid-cols-7 gap-px bg-border-subtle">
        {CELLS.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="bg-surface-subtle" />;
          const status = statusOf(day);
          const calendar = isCalendarDay(status) ? CALENDAR_DAY[status] : null;
          const mark = isCalendarDay(status) ? null : CLASS_DAY[status];
          return (
            <div
              key={day}
              className={cn(
                'relative flex min-h-[3.25rem] flex-col justify-between p-1.5 sm:min-h-[4rem] sm:p-2 xl:min-h-[4.25rem]',
                calendar ? calendar.cell : 'bg-surface-default',
                day === SELECTED_DAY && 'ring-2 ring-inset ring-brand'
              )}
            >
              {status === 'unrecorded' && (
                <span className="pointer-events-none absolute inset-1 rounded-sm border border-dashed border-text-muted" />
              )}
              <span
                className={cn(
                  'text-caption-strong tabular-nums',
                  status === 'weekly_off' ? 'text-text-muted' : 'text-text-primary'
                )}
              >
                {day}
              </span>
              {mark && <span className={cn('flex', mark.tone)}>{mark.icon}</span>}
              {calendar && (
                <span className={cn('hidden truncate text-caption md:block', calendar.text)}>{calendar.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day */}
      <div className="flex items-start gap-3 border-t border-border-subtle bg-surface-subtle px-4 py-3 sm:px-5">
        <CalendarCancel20Regular className="mt-px shrink-0 text-status-info" />
        <div className="min-w-0">
          <p className="text-caption-strong text-text-primary">Wednesday 9 · Holiday</p>
          <p className="mt-0.5 text-caption text-text-secondary">
            No classes are expected on a holiday. Nothing is marked, and the day doesn’t count towards attendance.
          </p>
        </div>
      </div>

      {/* Legend: what a class recorded vs. what the calendar decided */}
      <div className="flex flex-col gap-2.5 border-t border-border-subtle px-4 py-3.5 sm:px-5 xl:flex-row xl:gap-8">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          <span className="w-[4.5rem] text-caption-strong text-text-secondary xl:w-auto">Classes</span>
          {(Object.keys(CLASS_DAY) as ClassDay[]).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
              <span className={cn('flex', CLASS_DAY[key].tone)}>{CLASS_DAY[key].icon}</span>
              {CLASS_DAY[key].label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 xl:border-l xl:border-border-subtle xl:pl-8">
          <span className="w-[4.5rem] text-caption-strong text-text-secondary xl:w-auto">Calendar</span>
          {(Object.keys(CALENDAR_DAY) as CalendarDay[]).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
              <span className={cn('h-3 w-3 rounded-sm border', CALENDAR_DAY[key].swatch)} />
              {CALENDAR_DAY[key].label}
            </span>
          ))}
        </div>
      </div>
    </div>
    <figcaption className="mt-3 text-caption text-text-muted">
      Illustrative preview of the student calendar.
      <span className="sr-only">
        {' '}
        An example month: most class days present, two partial days, one absence, a holiday, a cancelled class, a
        class nobody recorded, Saturdays off and an exam period in the last week.
      </span>
    </figcaption>
  </figure>
);

const CALENDAR_FACTS: Array<{ term: string; detail: string }> = [
  { term: 'Holidays and exams', detail: 'Cancel the class sessions they cover, automatically.' },
  { term: 'Classes already recorded', detail: 'Flagged for an administrator to review, never changed.' },
  { term: 'Weekly day off', detail: 'Saturday on the Nepal calendar; Saturday and Sunday otherwise.' },
  { term: 'Between terms', detail: 'No sessions are created and nobody is marked absent.' },
];

const CalendarRow: React.FC = () => (
  <div className="grid items-center gap-y-12 lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
    <div className="lg:col-span-5">
      <h3 className="lp-h3 text-text-primary">The calendar decides which days have classes</h3>
      <p className="lp-body mt-4 max-w-[34rem] text-text-secondary">
        Administrators set the term dates, the exam window and the holidays once. From then on the academic calendar
        decides which days have classes for every cohort, and nobody has to cancel registers by hand.
      </p>
      <dl className="mt-8 max-w-[34rem] divide-y divide-border-subtle border-y border-border-subtle">
        {CALENDAR_FACTS.map((f) => (
          <div
            key={f.term}
            className="grid gap-1 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 lg:grid-cols-1 lg:gap-1 xl:grid-cols-[11rem_minmax(0,1fr)] xl:gap-6"
          >
            <dt className="text-body-strong text-text-primary">{f.term}</dt>
            <dd className="text-body text-text-secondary">{f.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
    <div className="lg:col-span-7">
      <CalendarPreview />
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Row b: teacher photo + register screenshot                                  */
/* -------------------------------------------------------------------------- */

/** Zooms into the Status and Actions columns of the register (four student rows). */
const REGISTER_CROP = { aspect: '2 / 1', position: '97% 82%', scale: 2.94 };

const RegisterRow: React.FC = () => (
  <div className="grid items-center gap-y-12 lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
    <div className="relative lg:col-span-7 lg:pb-16">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-subtle">
        <Photo photo={teacherFront} sizes="(min-width: 1280px) 670px, (min-width: 1024px) 56vw, 100vw" />
      </div>
      <ScreenFrame
        screen={teacherRegister}
        sizes="100vw"
        crop={REGISTER_CROP}
        className="relative z-10 -mt-20 ml-auto mr-4 hidden w-[70%] sm:block lg:absolute lg:-right-6 lg:bottom-0 lg:mr-0 lg:mt-0 lg:w-[58%]"
      />
    </div>

    <div className="lg:col-span-5">
      <h3 className="lp-h3 text-text-primary">Teachers keep the register; nothing slips through</h3>
      <p className="lp-body mt-4 max-w-[34rem] text-text-secondary">
        Teachers open the register for the classes assigned to them and mark each student present, late or absent.
        Only the rows they change are saved. A class nobody recorded is flagged as not recorded; it never turns into
        absences on its own.
      </p>
      <p className="lp-body mt-4 max-w-[34rem] text-text-secondary">
        At the start of class they put the rotating check-in code on the classroom screen, so students check in from
        the room. If a class can’t run, they cancel it with a reason; if it moves, they add a make-up session in a free
        slot.
      </p>
      <div className="mt-8 flex max-w-[34rem] items-baseline gap-5 border-t border-border-subtle pt-6">
        <p className="shrink-0 text-brand-foreground">
          <span className="lp-figure">7</span>
          <span className="ml-1.5 text-subheading">days</span>
        </p>
        <p className="text-body text-text-secondary">
          to edit a register after the class, by default. Later changes go through an administrator, with a reason.
        </p>
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Row c: composed audit-log excerpt                                           */
/* -------------------------------------------------------------------------- */

type ChipVariant = 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'outline';

interface AuditEntry {
  when: string;
  who: string;
  context: string;
  from: { label: string; variant: ChipVariant };
  to: { label: string; variant: ChipVariant };
  by: string;
  reason: string;
}

/** Placeholder names only; the fields mirror what the audit log stores. */
const AUDIT_ENTRIES: AuditEntry[] = [
  {
    when: '24 Sep, 09:15',
    who: 'Student A',
    context: 'Database systems · 23 Sep, 11:00',
    from: { label: 'Absent', variant: 'destructive' },
    to: { label: 'Excused', variant: 'info' },
    by: 'Admin',
    reason: 'Medical certificate submitted',
  },
  {
    when: '22 Sep, 10:31',
    who: 'Student B',
    context: 'Data structures · 22 Sep, 10:00',
    from: { label: 'Late', variant: 'warning' },
    to: { label: 'Present', variant: 'success' },
    by: 'Teacher',
    reason: 'Class started 10 minutes late',
  },
  {
    when: '21 Sep, 17:05',
    who: 'Student C',
    context: 'Operating systems · 18 Sep, 14:00',
    from: { label: 'Absent', variant: 'destructive' },
    to: { label: 'Present', variant: 'success' },
    by: 'Admin',
    reason: 'Register error, confirmed with the teacher',
  },
  {
    when: '21 Sep, 07:48',
    who: 'Class session',
    context: 'Computer networks · 21 Sep, 13:00',
    from: { label: 'Scheduled', variant: 'outline' },
    to: { label: 'Cancelled', variant: 'secondary' },
    by: 'Teacher',
    reason: 'Teacher on leave; make-up session added',
  },
];

const AUDIT_COLUMNS = 'lg:grid-cols-[7.5rem_minmax(0,1.25fr)_minmax(0,1.1fr)_5.5rem_minmax(0,1.5fr)]';

const AuditPreview: React.FC = () => (
  <figure>
    <div className={cn('overflow-hidden rounded-lg border border-border-subtle bg-surface-default', PANEL_SHADOW)}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-border-subtle px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 text-subheading text-text-primary">
          <History20Regular aria-hidden className="shrink-0 text-text-muted" />
          Change history
        </p>
        <p className="text-caption text-text-muted">Times in Asia/Kathmandu</p>
      </div>

      <div
        aria-hidden
        className={cn(
          'hidden gap-x-6 border-b border-border-subtle bg-surface-subtle px-5 py-2 text-caption-strong text-text-muted lg:grid',
          AUDIT_COLUMNS
        )}
      >
        <span>When</span>
        <span>Record</span>
        <span>Change</span>
        <span>Changed by</span>
        <span>Reason</span>
      </div>

      <ol className="divide-y divide-border-subtle">
        {AUDIT_ENTRIES.map((e) => (
          <li
            key={`${e.when}-${e.who}`}
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 px-4 py-4 sm:px-5 lg:items-center lg:gap-x-6 lg:py-3.5',
              AUDIT_COLUMNS
            )}
          >
            <div className="col-start-1 row-start-1 flex flex-wrap items-center gap-1.5 lg:col-start-3">
              <span className="sr-only">Changed from </span>
              <Badge variant={e.from.variant} shape="pill">
                {e.from.label}
              </Badge>
              <ArrowRight12Regular aria-hidden className="text-text-muted" />
              <span className="sr-only"> to </span>
              <Badge variant={e.to.variant} shape="pill">
                {e.to.label}
              </Badge>
            </div>
            <p className="col-start-2 row-start-1 self-center text-right text-caption tabular-nums text-text-muted lg:col-start-1 lg:text-left lg:text-body lg:text-text-secondary">
              {e.when}
            </p>
            <div className="col-span-2 mt-1 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mt-0">
              <p className="text-body-strong text-text-primary">{e.who}</p>
              <p className="text-caption tabular-nums text-text-muted">{e.context}</p>
            </div>
            <p className="col-span-2 text-caption text-text-secondary lg:col-span-1 lg:col-start-4 lg:row-start-1 lg:text-body">
              <span className="lg:sr-only">Changed by </span>
              <span className="font-semibold text-text-primary lg:font-normal">{e.by}</span>
            </p>
            <p className="col-span-2 rounded-sm bg-surface-subtle px-2 py-1 text-caption text-text-primary lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:text-body">
              <span className="text-text-muted lg:sr-only">Reason: </span>
              {e.reason}
            </p>
          </li>
        ))}
      </ol>
    </div>
    <figcaption className="mt-3 text-caption text-text-muted">
      Illustrative example with placeholder names. The fields are the ones AttendAI keeps for each change.
    </figcaption>
  </figure>
);

const AuditRow: React.FC = () => (
  <div>
    <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
      <div className="lg:col-span-5">
        <h3 className="lp-h3 text-text-primary">Every correction leaves a trail</h3>
        <p className="lp-body mt-4 max-w-[34rem] text-text-secondary">
          Registers get corrected; that’s normal. What matters is that each correction can be traced. Every change to an
          attendance record writes an audit entry with the old value, the new value, who made it, when, and why.
          Cancelling or restoring a class is logged the same way.
        </p>
      </div>
      <RuleList
        className="lg:col-span-6 lg:col-start-7"
        items={[
          <>
            <span className="font-semibold text-text-primary">Unrecorded classes are queued, not guessed.</span> If
            nobody took attendance, administrators resolve the class as held, with a register, or as not held, which
            cancels it.
          </>,
          <>
            <span className="font-semibold text-text-primary">Reasons are required where it matters.</span> Marking a
            student excused, overriding a face check-in or a teacher’s register, and any change after the teacher’s edit
            window all need one.
          </>,
          <>
            <span className="font-semibold text-text-primary">Excused is for administrators only.</span> An excused
            class counts neither for nor against a student’s percentage.
          </>,
        ]}
      />
    </div>
    <div className="mt-12 lg:mt-16">
      <AuditPreview />
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */

const CapabilityRows: React.FC = () => (
  <Section tone="default" aria-labelledby="capabilities-title">
    <SectionHeader
      id="capabilities-title"
      eyebrow="For the people who run the term"
      title="Set up the term once, and the rules handle the routine"
      lede="Administrators define the term, the timetable and the calendar. AttendAI works out which classes should happen, who may record them and what changes when plans do, and it keeps a record of every decision."
    />
    <div className="mt-16 space-y-24 lg:mt-24 lg:space-y-36">
      <CalendarRow />
      <RegisterRow />
      <AuditRow />
    </div>
  </Section>
);

export default CapabilityRows;
