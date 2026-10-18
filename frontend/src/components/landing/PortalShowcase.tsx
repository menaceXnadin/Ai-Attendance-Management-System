import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowLink, RuleList, ScreenFrame, Section, SectionHeader } from './primitives';
import {
  adminAnalytics,
  adminAttendance,
  studentCheckin,
  studentDashboard,
  teacherRegister,
  type ProductScreen,
} from './screens';

/**
 * `#product`: one system, three portals. Fluent underline tabs switch between
 * the student, teacher and administrator portals; each panel pairs a short,
 * true description with a real screenshot standing on a quiet brand field.
 *
 * Copy follows docs/system/domain-rules.md. The only numbers are the policy
 * defaults an administrator can change (check-in window, 75% minimum,
 * 7-day teacher edit window).
 */

type PortalId = 'students' | 'teachers' | 'admins';

interface Portal {
  id: PortalId;
  tab: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  primary: ProductScreen;
  /** Optional detail crop layered over the lower-left of the main screenshot. */
  secondary?: { screen: ProductScreen; crop: { aspect: string; position?: string; scale?: number } };
}

const PORTALS: Portal[] = [
  {
    id: 'students',
    tab: 'Students',
    title: 'Check in with your face, then see where you stand.',
    description:
      'When check-in opens for a class, students enter the code shown in the room and check in with their face right in the browser. The server decides whether they were on time or late, and every subject shows how close they are to the minimum.',
    points: [
      'By default, check-in opens 10 minutes before class and counts as late 10 minutes after the start.',
      'Attendance by subject and overall, checked against the minimum (75% by default).',
      'A calendar that marks every day, from present and absent to holidays and exams.',
      'A quick head turn proves it’s a live face; matching runs on your institution’s own server.',
    ],
    cta: 'Sign in to the student portal',
    primary: studentDashboard,
    // Zooms into the face check-in card: check-in code entry and the three steps.
    secondary: { screen: studentCheckin, crop: { aspect: '4 / 3', position: '29% 67%', scale: 2.25 } },
  },
  {
    id: 'teachers',
    tab: 'Teachers',
    title: 'Take the register for the classes you teach.',
    description:
      'Today’s classes are on the dashboard. Open a session’s register, mark each student present, late or absent, and only the rows you changed are saved.',
    points: [
      'Put the rotating check-in code, with a QR code, on the classroom screen.',
      'Correct a register for up to 7 days after the class (the default edit window).',
      'Cancel a session with a reason, or schedule a make-up class in a free slot.',
      'Student lists and attendance analytics for each of your subjects.',
    ],
    cta: 'Sign in to the teacher portal',
    primary: teacherRegister,
  },
  {
    id: 'admins',
    tab: 'Administrators',
    title: 'Set up the term, then follow up on every class.',
    description:
      'Administrators set up terms, timetables and the academic calendar, then follow up on the classes nobody recorded. Every attendance change lands in the audit log, and overriding a student’s or teacher’s record needs a reason.',
    points: [
      'Terms set by date, and timetables checked for cohort, room and teacher clashes.',
      'Holidays and exams cancel the affected classes. Any that already have records are flagged for review.',
      'A queue of unrecorded classes, each resolved as held or not held.',
      'Analytics, thresholds, face-verification settings and an audit log of who changed what, when and why.',
    ],
    cta: 'Sign in to the admin portal',
    primary: adminAttendance,
    // Zooms into the Today attendance card of the analytics page.
    secondary: { screen: adminAnalytics, crop: { aspect: '4 / 3', position: '25% 24%', scale: 2.98 } },
  },
];

const tabId = (id: PortalId) => `portal-tab-${id}`;
const panelId = (id: PortalId) => `portal-panel-${id}`;

/** Incoming content fades in over 150ms; outgoing content disappears at once. */
const fade = (on: boolean) =>
  on ? 'opacity-100 transition-opacity duration-150 ease-fluent-standard motion-reduce:transition-none' : 'opacity-0';

/**
 * How far the main screenshot pushes past the grid's right edge on lg+.
 * Below 1280px only 12px (the container gutter is at least 36px there); on
 * wider screens it also takes part of the outer margin, capped at 96px. The
 * section clips overflow, so the scrollbar's share of 100vw can't cause a
 * horizontal scroll.
 */
const BLEED = { '--pg-bleed': 'min(6rem, max(0px, (100vw - 80rem) / 2) + 0.75rem)' } as React.CSSProperties;

const PortalPanel: React.FC<{ portal: Portal; active: boolean }> = ({ portal, active }) => (
  <div
    role="tabpanel"
    id={panelId(portal.id)}
    aria-labelledby={tabId(portal.id)}
    tabIndex={active ? 0 : -1}
    // All panels share one grid cell, so the section keeps the height of the
    // tallest panel and switching tabs never shifts the page.
    className={cn(
      'col-start-1 row-start-1 grid gap-y-10 rounded-sm lg:grid-cols-12 lg:items-start lg:gap-x-8',
      active ? 'visible' : 'invisible'
    )}
  >
    {/* Copy */}
    <div className={cn('lg:col-span-5 lg:pr-6 lg:pt-1 xl:col-span-4 xl:pr-10', fade(active))}>
      <h3 className="lp-h3 max-w-[30rem] text-text-primary">{portal.title}</h3>
      <p className="lp-body mt-4 max-w-[34rem] text-text-secondary">{portal.description}</p>
      <RuleList items={portal.points} className="mt-8 max-w-[34rem]" />
      <div className="mt-8">
        <ArrowLink to="/login">{portal.cta}</ArrowLink>
      </div>
    </div>

    {/* Product shot on a brand field that runs off the right edge */}
    <div
      style={BLEED}
      className="relative pb-6 sm:pb-10 lg:col-span-7 lg:mr-[calc(-1*var(--pg-bleed))] lg:pb-14 xl:col-span-8"
    >
      <div aria-hidden className="absolute -right-[100vw] bottom-0 left-6 top-1/2 rounded-lg bg-brand-subtle lg:left-[8%] lg:top-[38%]" />
      <ScreenFrame
        screen={portal.primary}
        className={cn('relative w-full', fade(active))}
      />
      {portal.secondary && (
        <ScreenFrame
          screen={portal.secondary.screen}
          crop={portal.secondary.crop}
          sizes="100vw"
          className={cn(
            'absolute bottom-6 left-6 hidden w-[38%] sm:block lg:-left-6 xl:w-[34%]',
            fade(active)
          )}
        />
      )}
    </div>
  </div>
);

const PortalShowcase: React.FC = () => {
  const [active, setActive] = React.useState<PortalId>('students');
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = PORTALS.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(PORTALS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <Section id="product" tone="default" aria-labelledby="product-title" className="overflow-hidden">
      <SectionHeader
        id="product-title"
        eyebrow="The product"
        title="Three portals, one record of every class."
        lede="Students, teachers and administrators each get a portal built around their part of the job. All three work from the same class sessions, so the student’s view and the teacher’s register show the same record."
      />

      {/* Fluent underline tabs. The hairline spans the grid; the -mx-3 lets the first label line up with the headline. */}
      <div className="mt-12 border-b border-border-subtle lg:mt-16">
        <div
          role="tablist"
          aria-label="AttendAI portals"
          className="-mx-3 -mb-px flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PORTALS.map((portal, index) => {
            const selected = portal.id === active;
            return (
              <button
                key={portal.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={tabId(portal.id)}
                aria-selected={selected}
                aria-controls={panelId(portal.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(portal.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={cn(
                  'relative inline-flex h-12 shrink-0 items-center whitespace-nowrap rounded-sm px-3 text-subheading',
                  'transition-colors duration-150 ease-fluent-standard motion-reduce:transition-none',
                  'focus-visible:-outline-offset-2',
                  "after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:content-['']",
                  'after:transition-colors after:duration-150 motion-reduce:after:transition-none',
                  selected
                    ? 'text-text-primary after:bg-brand'
                    : 'font-normal text-text-secondary hover:text-text-primary after:bg-transparent hover:after:bg-border-default'
                )}
              >
                {/* The hidden semibold copy reserves width, so selecting a tab doesn't nudge its neighbours. */}
                <span className="grid">
                  <span aria-hidden className="invisible col-start-1 row-start-1 font-semibold">
                    {portal.tab}
                  </span>
                  <span className="col-start-1 row-start-1">{portal.tab}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10 grid lg:mt-14">
        {PORTALS.map((portal) => (
          <PortalPanel key={portal.id} portal={portal} active={portal.id === active} />
        ))}
      </div>
    </Section>
  );
};

export default PortalShowcase;
