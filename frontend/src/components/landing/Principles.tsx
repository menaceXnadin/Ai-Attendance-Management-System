import * as React from 'react';
import {
  Clock20Regular,
  DataBarVertical20Regular,
  DoorArrowLeft20Regular,
  History20Regular,
  PeopleLock20Regular,
  PersonDelete20Regular,
  Server20Regular,
} from '@fluentui/react-icons';
import { ArrowLink, Eyebrow, Section } from './primitives';

/**
 * `#trust`: the integrity and privacy rules, stated plainly. Every line here
 * is enforced by the backend (see docs/system/domain-rules.md); do not add
 * claims about certifications, encryption specifics or uptime.
 */

interface Principle {
  icon: React.ReactElement;
  title: string;
  body: React.ReactNode;
}

const PRINCIPLES: Principle[] = [
  {
    icon: <Server20Regular />,
    title: 'Faces are matched on your own server',
    body: (
      <>
        The browser only guides framing and the head-turn prompt (with MediaPipe). Your institution’s AttendAI server
        does the matching with InsightFace, comparing a student only with their own enrolled face. Nothing is sent to a
        third-party AI service.
      </>
    ),
  },
  {
    icon: <PersonDelete20Regular />,
    title: 'Templates, not photos',
    body: (
      <>
        Enrolling a face needs the student’s consent. Only face templates are kept, never the photos, and students can
        delete their face data themselves. Similarity scores are never shown to students.
      </>
    ),
  },
  {
    icon: <DoorArrowLeft20Regular />,
    title: 'Being in the room is part of the check',
    body: (
      <>
        By default a check-in also needs the classroom code the teacher shows on screen, which changes every 30
        seconds, plus a liveness check and a head turn. Repeated failures pause check-in for a while, and every attempt
        is logged.
      </>
    ),
  },
  {
    icon: <PeopleLock20Regular />,
    title: 'Each role sees only what it should',
    body: (
      <>
        Students see their own records, teachers see the cohorts they teach, and administrators see everything. Access is
        checked by the server, not just hidden in the interface.
      </>
    ),
  },
  {
    icon: <History20Regular />,
    title: 'Nothing is overwritten or deleted quietly',
    body: (
      <>
        Every change to an attendance record is logged with the old value, the new value, who made it, when and why.
        Removing a student or teacher deactivates their account; their attendance history stays.
      </>
    ),
  },
  {
    icon: <DataBarVertical20Regular />,
    title: 'Percentages are calculated one way',
    body: (
      <>
        Every percentage is weighted by class session and comes from a single calculation, so students, teachers and
        administrators see the same figure. Classes nobody recorded never count, and with no data you see “—”, not a
        misleading 0%.
      </>
    ),
  },
  {
    icon: <Clock20Regular />,
    title: 'One clock for every decision',
    body: (
      <>
        Check-in windows, late marks and automatic absences all run on Asia/Kathmandu time, kept by the server. The clock
        on a student’s phone doesn’t decide anything.
      </>
    ),
  },
];

const Principles: React.FC = () => (
  <Section id="trust" tone="tint" aria-labelledby="trust-title">
    <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
      <div className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start xl:col-span-4">
        <Eyebrow>Trust and privacy</Eyebrow>
        <h2 id="trust-title" className="lp-h2 mt-3 text-text-primary">
          Rules you can inspect
        </h2>
        <p className="lp-lede mt-5 max-w-[34rem] text-text-secondary">
          Attendance affects whether students are eligible, so the system has to be predictable. These are the rules
          AttendAI follows. They’re written down, tested and enforced on the server.
        </p>
        <div className="mt-8">
          <ArrowLink to="/about">About AttendAI</ArrowLink>
        </div>
      </div>

      <dl className="divide-y divide-border-subtle border-y border-border-subtle lg:col-span-7 lg:col-start-6 xl:col-start-6">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="py-7 lg:py-8">
            <dt className="flex items-start gap-3 text-section-title text-text-primary">
              <span aria-hidden className="mt-1 flex shrink-0 text-text-muted">
                {p.icon}
              </span>
              <span>{p.title}</span>
            </dt>
            <dd className="lp-body mt-2 max-w-[40rem] pl-8 text-text-secondary">{p.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  </Section>
);

export default Principles;
