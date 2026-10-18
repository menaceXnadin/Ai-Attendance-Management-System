import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Section, SectionHeader } from './primitives';

/**
 * "The life of one class session": a 10:00–11:00 lecture under the default
 * attendance policy (docs/system/domain-rules.md §1, §4–§6 and
 * face-verification.md). Desktop (lg+) draws a true-to-scale time axis from
 * check-in opening (09:50) to the end of the grace period (11:15), so the axis
 * spans exactly the container width. Notes alternate above and below the axis
 * and are pinned to their minute by hairline leaders. Phones and tablets get
 * the same ordered list as a vertical timeline.
 */

/* Time scale ---------------------------------------------------------------- */

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const AXIS_START = toMinutes('09:50');
const AXIS_END = toMinutes('11:15');
const AXIS_SPAN = AXIS_END - AXIS_START;

const fraction = (minutes: number) => ((minutes - AXIS_START) / AXIS_SPAN) * 100;

/** Left edge of a 1px line at `minutes`. The last instant sits flush with the right edge. */
const lineAt = (minutes: number): string =>
  minutes >= AXIS_END ? 'calc(100% - 1px)' : `${fraction(minutes).toFixed(3)}%`;

const at = (hhmm: string) => lineAt(toMinutes(hhmm));
const width = (from: string, to: string) => `${(fraction(toMinutes(to)) - fraction(toMinutes(from))).toFixed(3)}%`;

const formatMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/* Events -------------------------------------------------------------------- */

/** What the line looks like after this event on the vertical (phone/tablet) timeline. */
type Phase = 'onTime' | 'late' | 'inClass' | 'grace' | 'end';

interface TimelineEvent {
  time: string;
  title: string;
  body: string;
  /** Optional second, smaller line. */
  note?: string;
  /** Desktop placement relative to the axis. */
  side: 'above' | 'below';
  /** Desktop: the note reads to the right of its leader ('start') or to the left ('end'). */
  align: 'start' | 'end';
  phase: Phase;
  /** Desktop: the leader continues down into the two outcomes. */
  forks?: boolean;
}

const EVENTS: TimelineEvent[] = [
  {
    time: '09:50',
    title: 'Check-in opens',
    body: 'Students scan or type the teacher’s rotating classroom code, look at the camera and turn their head when asked.',
    note: 'Checked on the server: their own face, liveness and the current code.',
    side: 'above',
    align: 'start',
    phase: 'onTime',
  },
  {
    time: '10:00',
    title: 'Class starts',
    body: 'The teacher can take the register alongside check-ins, and adjust it for up to 7 days.',
    side: 'below',
    align: 'start',
    phase: 'onTime',
  },
  {
    time: '10:10',
    title: 'Late from here',
    body: 'Check-ins in the first 10 minutes count as present. After that, they’re recorded as late.',
    side: 'above',
    align: 'start',
    phase: 'late',
  },
  {
    time: '10:20',
    title: 'Check-in closes',
    body: '20 minutes after the start, or when the class ends if that’s sooner. Students can’t check in after this.',
    side: 'below',
    align: 'start',
    phase: 'inClass',
  },
  {
    time: '11:00',
    title: 'Class ends',
    body: 'Nothing is final yet. A 15-minute grace period leaves time to finish the register.',
    side: 'above',
    align: 'end',
    phase: 'grace',
  },
  {
    time: '11:15',
    title: 'Grace period ends',
    body: 'What happens next depends on one question: did anyone record attendance?',
    side: 'below',
    align: 'end',
    phase: 'end',
    forks: true,
  },
];

const EVENT_MINUTES = new Set(EVENTS.map((e) => toMinutes(e.time)));

/** Five-minute ticks across the whole axis. */
const TICKS = Array.from({ length: AXIS_SPAN / 5 + 1 }, (_, i) => AXIS_START + i * 5);

/** Labelled ticks: every ten minutes plus the final 11:15 (11:10 would collide with it). */
const TICK_LABELS = TICKS.filter((m) => m === AXIS_END || (m % 10 === 0 && m + 5 < AXIS_END));

/* Decoration ---------------------------------------------------------------- */

/** Late part of the check-in window: hatched warning tint (on time is solid brand). */
const LATE_HATCH: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in srgb, var(--status-warning) 38%, transparent) 0 1px, transparent 1px 5px)',
};

/** Grace period on the axis: a dashed continuation of the class line. */
const GRACE_DASH: React.CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(90deg, var(--text-primary) 0 5px, transparent 5px 9px)',
};

const PHASE_RULE: Record<Phase, string> = {
  onTime: 'border-brand',
  late: 'border-status-warning/60',
  inClass: 'border-border-strong',
  grace: 'border-dashed border-border-strong',
  end: 'border-transparent',
};

/* Desktop axis band (decorative; the ordered list carries the content) ------- */

const AxisBand: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden className={cn('relative h-[7.25rem]', className)}>
    {/* Leaders continue from each note to the axis. */}
    {EVENTS.map((e) => (
      <span
        key={e.time}
        className={cn('absolute w-px bg-border-default', e.side === 'above' ? 'top-0 h-14' : 'bottom-0 top-[57px]')}
        style={{ left: at(e.time) }}
      />
    ))}

    {/* Five-minute ticks, taller on the tens. */}
    {TICKS.map((m) => (
      <span
        key={m}
        className={cn('absolute top-[57px] w-px bg-border-default', m % 10 === 0 ? 'h-2' : 'h-1')}
        style={{ left: lineAt(m) }}
      />
    ))}

    {/* The axis. */}
    <span className="absolute inset-x-0 top-14 h-px bg-border-strong" />

    {/* Check-in window: on time, then late. */}
    <span
      className="absolute left-0 top-8 flex h-6 items-center overflow-hidden whitespace-nowrap bg-brand pl-2 text-caption-strong text-brand-on"
      style={{ width: width('09:50', '10:10') }}
    >
      On time
    </span>
    <span
      className="absolute top-8 flex h-6 items-center overflow-hidden border border-status-warning/60 bg-status-warning-subtle pl-1.5"
      style={{ left: at('10:10'), width: width('10:10', '10:20'), ...LATE_HATCH }}
    >
      <span className="bg-status-warning-subtle px-1 text-caption-strong text-status-warning">Late</span>
    </span>

    {/* Class (solid) and grace period (dashed) drawn on the axis. */}
    <span
      className="absolute top-[55px] h-[3px] bg-text-primary"
      style={{ left: at('10:00'), width: width('10:00', '11:00') }}
    />
    <span className="absolute right-0 top-[55px] h-[3px]" style={{ left: at('11:00'), ...GRACE_DASH }} />
    {['10:00', '11:00'].map((t) => (
      <span key={t} className="absolute top-[50px] h-[13px] w-0.5 bg-text-primary" style={{ left: at(t) }} />
    ))}
    <span
      className="absolute top-[51px] h-[11px] w-[11px] rounded-full border-2 border-text-primary bg-surface-canvas"
      style={{ left: 'calc(100% - 6px)' }}
    />

    {/* Span labels, sitting on the axis. */}
    <span
      className="absolute top-8 flex h-6 items-center gap-2 whitespace-nowrap"
      style={{ left: `calc(${at('10:20')} + 0.75rem)` }}
    >
      <span className="text-caption-strong text-text-primary">Class in session</span>
      <span className="text-caption tabular-nums text-text-muted">10:00–11:00</span>
    </span>
    <span
      className="absolute top-8 flex h-6 items-center gap-2 whitespace-nowrap"
      style={{ left: `calc(${at('11:00')} + 0.75rem)` }}
    >
      <span className="text-caption-strong text-text-primary">Grace period</span>
      <span className="text-caption tabular-nums text-text-muted">15 min</span>
    </span>

    {/* Tick labels sit just right of their tick; the last one sits left of it. */}
    {TICK_LABELS.map((m) => (
      <span
        key={m}
        className={cn(
          'absolute top-[68px] tabular-nums',
          EVENT_MINUTES.has(m) ? 'text-caption-strong text-text-primary' : 'text-caption text-text-muted'
        )}
        style={m === AXIS_END ? { right: '0.625rem' } : { left: `calc(${lineAt(m)} + 6px)` }}
      >
        {formatMinutes(m)}
      </span>
    ))}
  </div>
);

/* One event: a vertical-timeline row on small screens, an axis note on lg+ --- */

const EventItem: React.FC<{ event: TimelineEvent; last: boolean }> = ({ event, last }) => {
  const start = event.align === 'start';
  return (
    <li
      style={{ '--x': at(event.time) } as React.CSSProperties}
      className={cn(
        // Phones and tablets: time in a left gutter, rule line, note to the right.
        'grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[4.5rem_minmax(0,1fr)]',
        // Desktop: a note pinned to its minute by a hairline leader.
        'lg:col-start-1 lg:block lg:w-[min(16rem,calc(23.5%_-_1rem))] lg:border-border-default',
        event.side === 'above' ? 'lg:row-start-1' : 'lg:row-start-3',
        event.forks ? 'lg:self-stretch' : event.side === 'above' ? 'lg:self-end' : 'lg:self-start',
        start
          ? 'lg:ml-[var(--x)] lg:justify-self-start lg:border-l lg:pl-3'
          : 'lg:mr-[calc(100%_-_var(--x)_-_1px)] lg:justify-self-end lg:border-r lg:pr-3 lg:text-right'
      )}
    >
      <time
        dateTime={event.time}
        className="text-subheading tabular-nums text-text-primary lg:block lg:text-caption-strong lg:text-text-muted"
      >
        {event.time}
      </time>
      <div
        className={cn(
          'relative border-l-2 pl-6',
          last ? 'pb-2' : 'pb-9',
          PHASE_RULE[event.phase],
          'lg:border-l-0 lg:pb-0 lg:pl-0'
        )}
      >
        <span
          aria-hidden
          className="absolute -left-[7px] top-[5px] h-3 w-3 rounded-full border-2 border-border-strong bg-surface-canvas lg:hidden"
        />
        <p className="text-subheading text-text-primary lg:mt-0.5">{event.title}</p>
        <p className="mt-1 text-body text-text-secondary">{event.body}</p>
        {event.note && <p className="mt-1.5 text-caption text-text-muted">{event.note}</p>}
      </div>
    </li>
  );
};

/* Small-screen legend for the coloured rule (desktop labels the bars inline). */
const RuleLegend: React.FC = () => (
  <ul aria-hidden className="mb-8 flex flex-wrap gap-x-5 gap-y-2 text-caption text-text-muted lg:hidden">
    <li className="inline-flex items-center gap-2">
      <span className="h-0.5 w-5 bg-brand" />
      On time
    </li>
    <li className="inline-flex items-center gap-2">
      <span className="h-0.5 w-5 bg-status-warning/60" />
      Late
    </li>
    <li className="inline-flex items-center gap-2">
      <span className="h-0.5 w-5 bg-border-strong" />
      Class in session
    </li>
    <li className="inline-flex items-center gap-2">
      <span className="w-5 border-t-2 border-dashed border-border-strong" />
      Grace period
    </li>
  </ul>
);

/* The fork: two outcomes, equal weight ------------------------------------- */

const Outcome: React.FC<{
  badge: React.ReactNode;
  condition: string;
  title: string;
  body: string;
  className?: string;
}> = ({ badge, condition, title, body, className }) => (
  <div className={cn('pt-8 sm:border-l sm:border-border-default sm:pl-6 sm:pr-10', className)}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {badge}
      <span className="text-caption text-text-muted">{condition}</span>
    </div>
    <h3 className="lp-h3 mt-4 text-text-primary">{title}</h3>
    <p className="lp-body mt-3 max-w-[34rem] text-text-secondary">{body}</p>
  </div>
);

/* Section ------------------------------------------------------------------- */

const SessionTimeline: React.FC = () => (
  <Section id="how-it-works" tone="tint" aria-labelledby="how-it-works-title">
    <SectionHeader
      id="how-it-works-title"
      eyebrow="How it works"
      title="One class, from first check-in to final record"
      lede="Take a lecture timetabled from 10:00 to 11:00. Here is how its attendance gets recorded, and what happens if nobody records it at all."
    />

    <div className="mt-12 lg:mt-20">
      <RuleLegend />

      <div className="lg:grid lg:grid-cols-1 lg:grid-rows-[auto_auto_auto]">
        <AxisBand className="hidden lg:col-start-1 lg:row-start-2 lg:block" />
        <ol
          aria-label="A class timetabled from 10:00 to 11:00"
          className="max-w-2xl lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:grid lg:max-w-none lg:grid-cols-1 lg:grid-rows-subgrid"
        >
          {EVENTS.map((event, i) => (
            <EventItem key={event.time} event={event} last={i === EVENTS.length - 1} />
          ))}
        </ol>
      </div>

      {/* Desktop: the 11:15 leader drops into the branch line above the outcomes. */}
      <div aria-hidden className="relative hidden h-12 lg:block">
        <span className="absolute right-0 top-0 h-full w-px bg-border-default" />
      </div>

      <div className="mt-8 grid border-t border-border-default sm:grid-cols-2 lg:mt-0">
        <Outcome
          badge={
            <Badge variant="success" shape="pill">
              Held
            </Badge>
          }
          condition="If anyone recorded attendance"
          title="Missing students are marked absent"
          body="A class counts as held once anyone records attendance for it, whether a student’s check-in or the teacher’s register. After the grace period, the next automatic run (every 10 minutes) marks each enrolled student with no record as absent, labelled as automatic. The teacher can still correct them within 7 days, and every change is logged."
        />
        <Outcome
          badge={
            <Badge variant="outline" shape="pill">
              Not recorded
            </Badge>
          }
          condition="If nobody recorded attendance"
          title="Flagged for follow-up, not marked absent"
          body="No absences are created. The class goes on an administrator’s list of unrecorded sessions, to be confirmed as held with a register or cancelled as not held. Until then it counts towards nobody’s percentage, and eligibility is shown as provisional."
          className="mt-10 border-t border-border-default sm:mt-0 sm:border-t-0"
        />
      </div>

      <p className="mt-12 text-caption text-text-muted lg:mt-16">
        Times and check-in steps shown are the default policy; administrators can change them.
      </p>
    </div>
  </Section>
);

export default SessionTimeline;
