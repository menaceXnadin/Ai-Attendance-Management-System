import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight20Regular, Camera20Regular, CheckmarkCircle16Filled, Clock16Regular } from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { cn } from '@/lib/utils';
import { ArrowLink, Container, Photo } from './primitives';
import { heroClassroom } from './photos';

/**
 * Composed preview of the student check-in panel. It follows the real flow
 * (docs/system/face-verification.md: classroom code, then a face burst with a
 * head turn) and the default policy (opens 10 min before class, late after
 * 10 min, closes after 20 min). Illustrative, not live data.
 */
const CheckinPreview: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden
    className={cn(
      'w-full max-w-[22rem] overflow-hidden rounded-lg border border-border-subtle bg-surface-raised text-left',
      'shadow-[0_2px_4px_rgba(0,0,0,0.06),0_24px_56px_-16px_rgba(0,0,0,0.32)]',
      className
    )}
  >
    <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
      <span className="text-caption-strong text-text-secondary">Today’s classes</span>
      <span className="text-caption tabular-nums text-text-muted">Sun 10:04</span>
    </div>

    <div className="px-4 pb-4 pt-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-subheading text-text-primary">Data structures</div>
          <div className="mt-0.5 text-caption tabular-nums text-text-muted">10:00 – 11:00 · Room 302</div>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-sm bg-status-success-subtle px-1.5 py-0.5 text-caption-strong text-status-success">
          <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
          Check-in open
        </span>
      </div>

      {/* Check-in window: 09:50 → 10:20, on time until 10:10. Marker at 10:04. */}
      <div className="mt-4">
        <div className="relative h-1.5 rounded-full bg-surface-pressed">
          <div className="absolute inset-y-0 left-0 w-2/3 rounded-l-full bg-brand" />
          <div className="absolute inset-y-0 left-2/3 right-0 rounded-r-full bg-status-warning/60" />
          <div className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-text-primary" style={{ left: '46.6%' }} />
        </div>
        <div className="relative mt-1.5 h-4 text-caption tabular-nums text-text-muted">
          <span className="absolute left-0">09:50</span>
          <span className="absolute -translate-x-1/2" style={{ left: '66.67%' }}>
            10:10
          </span>
          <span className="absolute right-0">10:20</span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-caption text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand" />
            On time
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-status-warning/60" />
            Late
          </span>
        </div>
      </div>

      {/* Proof of presence: the rotating code the teacher shows in the room. */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-caption text-text-muted">Classroom code</div>
          <div className="mt-1.5 flex">
            {'482913'.split('').map((digit, i) => (
              <span
                key={i}
                className={cn(
                  'grid h-8 w-6 place-items-center border-y border-l border-border-default bg-surface-default text-subheading tabular-nums text-text-primary',
                  i === 0 || i === 3 ? 'rounded-l-sm' : '',
                  i === 2 || i === 5 ? 'rounded-r-sm border-r' : '',
                  i === 3 && 'ml-1.5'
                )}
              >
                {digit}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 pb-1.5 text-caption text-text-secondary">
          <Clock16Regular className="shrink-0 text-text-muted" />
          <span className="tabular-nums">16 min left</span>
        </div>
      </div>

      <div className="mt-4 flex h-9 items-center justify-center gap-2 rounded-md bg-brand text-body-strong text-brand-on">
        <Camera20Regular />
        Continue to face check
      </div>
      <p className="mt-2 text-center text-caption text-text-muted">Look at the camera, then turn your head when asked.</p>
    </div>

    <div className="flex items-center gap-2 border-t border-border-subtle bg-surface-subtle px-4 py-2.5">
      <CheckmarkCircle16Filled className="shrink-0 text-status-success" />
      <span className="text-caption text-text-secondary">
        <span className="text-caption-strong text-text-primary">Operating systems</span> · checked in at 08:03
      </span>
    </div>
  </div>
);

const Hero: React.FC = () => {
  const { user } = useAuth();

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-surface-default">
      <Container className="grid items-center gap-y-12 pb-6 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-x-10 lg:pb-10 lg:pt-16 xl:gap-x-16">
        {/* Copy */}
        <div className="lg:col-span-6 xl:col-span-5">
          <p className="lp-eyebrow text-brand-foreground">Attendance for universities and colleges</p>
          <h1 id="hero-title" className="lp-display mt-4 text-text-primary">
            Every class, accounted for.
          </h1>
          <p className="lp-lede mt-6 max-w-[34rem] text-text-secondary">
            AttendAI turns your timetable into class sessions. Students check in with their face and the code shown in
            the room, teachers keep the register, and administrators see which classes still need attention.
          </p>

          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
            <Button asChild size="lg" className="h-11 px-5 text-[15px]">
              <Link to={user ? '/dashboard' : '/login'}>
                <span>{user ? 'Open your dashboard' : 'Sign in to AttendAI'}</span>
                <ArrowRight20Regular aria-hidden />
              </Link>
            </Button>
            <ArrowLink to="#how-it-works">See how a class is recorded</ArrowLink>
          </div>

          <p className="mt-10 max-w-[34rem] border-t border-border-subtle pt-5 text-body text-text-muted">
            One sign-in, three portals: students, teachers and administrators each get their own workspace.
          </p>
        </div>

        {/* Photograph with the product moment anchored to it */}
        {/* Faces sit in the upper part of the crop; the panel overlaps the desks below them. */}
        <div className="relative lg:col-span-6 xl:col-span-7">
          <div className="aspect-[16/11] w-full overflow-hidden rounded-lg bg-surface-subtle sm:aspect-[16/10] lg:aspect-[5/4]">
            <Photo
              photo={heroClassroom}
              eager
              position={null}
              className="object-[50%_52%] lg:object-[50%_100%]"
              sizes="(min-width: 1280px) 700px, (min-width: 1024px) 46vw, 100vw"
            />
          </div>
          <div className="relative z-10 -mt-16 flex flex-col items-center gap-4 sm:-mt-28 sm:flex-row sm:items-end sm:gap-8 sm:pl-6 lg:-ml-6 lg:flex-col lg:items-start lg:gap-4 lg:pl-0 xl:flex-row xl:items-end xl:gap-8">
            <CheckinPreview className="shrink-0" />
            <p className="max-w-[22rem] text-center text-caption text-text-muted sm:max-w-[15rem] sm:pb-1 sm:text-left lg:max-w-[22rem] lg:pl-6 xl:max-w-[15rem] xl:pl-0">
              Illustrative panel. By default check-in opens 10 minutes before class, counts as late after 10 and closes
              after 20. The classroom code changes every 30 seconds.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default Hero;
