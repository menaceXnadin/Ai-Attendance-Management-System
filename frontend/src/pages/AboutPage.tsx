import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight20Regular } from '@fluentui/react-icons';
import Navbar from '@/components/Navbar';
import Footer, { type FooterCredit } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import ClosingCta from '@/components/landing/ClosingCta';
import { ArrowLink, Container, Eyebrow, Photo, Section, SectionHeader } from '@/components/landing/primitives';
import { studentDevice, teacherFront } from '@/components/landing/photos';

/**
 * Public "About" page, built from the landing-page primitives (components/landing/).
 * Copy rules (docs/system/frontend.md §8): only true statements. No usage figures,
 * customer names, testimonials or certifications; every product claim below is
 * enforced by the backend (docs/system/domain-rules.md, face-verification.md).
 */

const credits: FooterCredit[] = [teacherFront, studentDevice]
  .map((photo) => photo.credit)
  .filter((credit): credit is FooterCredit => !!credit);

interface Goal {
  title: string;
  body: string;
}

const GOALS: Goal[] = [
  {
    title: 'Accurate, not just automatic',
    body: 'An absence is only recorded for a class that actually happened. If nobody takes attendance, the class is flagged for follow-up instead of being filled with absences.',
  },
  {
    title: 'Fair to every student',
    body: 'Percentages come from one calculation, weighted by class session, so students, teachers and administrators see the same number. No data shows “—”, never a misleading 0%.',
  },
  {
    title: 'Hard to fake',
    body: 'A check-in needs the student’s own face, a liveness check with a head turn, and the code shown in the room, which changes every 30 seconds by default.',
  },
  {
    title: 'Respectful of privacy',
    body: 'Faces are matched on the institution’s own server. Only face templates are kept, never photos, enrolment needs consent, and students can delete their data.',
  },
];

interface Member {
  name: string;
  role: string;
  image: string;
  /** object-position that keeps the face in a head-and-shoulders crop. */
  position: string;
  /** Zoom into the face (1 = cover the tile). */
  scale: number;
}

const TEAM: Member[] = [
  { name: 'Nadin Tamang', role: 'Founder & CEO', image: '/team/ceo.jpg', position: '50% 24%', scale: 1.35 },
  { name: 'Diwash Ghimire', role: 'CTO', image: '/team/cto.png', position: '46% 20%', scale: 1.25 },
  { name: 'Abhishek Subedi', role: 'CMO', image: '/team/cmo.png', position: '45% 20%', scale: 1.9 },
];

const STACK: { term: string; detail: string }[] = [
  { term: 'Web app', detail: 'React and TypeScript, styled to Microsoft’s Fluent 2 design language, in light and dark.' },
  { term: 'Server', detail: 'FastAPI with PostgreSQL. Every attendance rule runs here, with a written spec and automated tests.' },
  {
    term: 'Face recognition',
    detail: 'InsightFace on the server for matching; MediaPipe in the browser only to guide framing and the head turn.',
  },
  { term: 'Anti-spoofing', detail: 'A passive liveness model (MiniFASNet) that looks for printed photos and screens.' },
  { term: 'Time', detail: 'One server clock (Asia/Kathmandu) decides check-in windows, late marks and automatic absences.' },
];

const AboutHero: React.FC = () => {
  const { user } = useAuth();
  return (
    <section aria-labelledby="about-title" className="bg-surface-default">
      <Container className="grid items-center gap-y-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-x-10 lg:pb-24 lg:pt-16 xl:gap-x-16">
        <div className="lg:col-span-6 xl:col-span-5">
          <Eyebrow>About AttendAI</Eyebrow>
          <h1 id="about-title" className="lp-display mt-4 text-text-primary">
            Class time belongs to teaching.
          </h1>
          <p className="lp-lede mt-6 max-w-[34rem] text-text-secondary">
            AttendAI began as a final-year university project with one goal: take attendance off the teacher’s plate
            without making the record any less trustworthy. Students check in with their face and the code shown in the
            room; teachers and administrators get a register they can rely on.
          </p>
          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
            <Button asChild size="lg" className="h-11 px-5 text-[15px]">
              <Link to={user ? '/dashboard' : '/login'}>
                <span>{user ? 'Open your dashboard' : 'Sign in to AttendAI'}</span>
                <ArrowRight20Regular aria-hidden />
              </Link>
            </Button>
            <ArrowLink to="#story">Read the story</ArrowLink>
          </div>
        </div>

        <div className="lg:col-span-6 xl:col-span-7">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-subtle">
            <Photo photo={teacherFront} eager sizes="(min-width: 1280px) 700px, (min-width: 1024px) 46vw, 100vw" />
          </div>
        </div>
      </Container>
    </section>
  );
};

const Story: React.FC = () => (
  <Section id="story" tone="tint" aria-labelledby="story-title">
    <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
      <div className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start xl:col-span-4">
        <Eyebrow>Why it exists</Eyebrow>
        <h2 id="story-title" className="lp-h2 mt-3 text-text-primary">
          Roll call was eating the lecture.
        </h2>
        <figure className="mt-10 border-t border-border-subtle pt-6">
          <p className="lp-figure text-brand-foreground">~10 min</p>
          <figcaption className="mt-3 max-w-[22rem] text-body text-text-muted">
            of a class lost to calling names, in the lecture halls that started this project.
          </figcaption>
        </figure>
      </div>

      <div className="space-y-6 lg:col-span-7 lg:col-start-6">
        <p className="lp-lede text-text-primary">
          As a student at a large university, Nadin Tamang watched around ten minutes of every class disappear into a
          slow, traditional roll call.
        </p>
        <p className="lp-body max-w-[40rem] text-text-secondary">
          Calling names is slow, easy to game and hard to audit afterwards. Yet attendance decides who may sit an exam,
          so the record has to be right. The question became whether a class could record itself, without anyone
          reading a list, and still be accurate enough to make that decision.
        </p>
        <p className="lp-body max-w-[40rem] text-text-secondary">
          AttendAI is the answer we built for our final-year project. We treated it like a system an institution would
          actually depend on: the attendance rules are written down, tested, and enforced on the server rather than
          hidden in the interface.
        </p>
      </div>
    </div>
  </Section>
);

const Goals: React.FC = () => (
  <Section aria-labelledby="goals-title">
    <SectionHeader
      id="goals-title"
      eyebrow="What we set out to get right"
      title="Four things we wouldn’t compromise on"
      action={<ArrowLink to="/#trust">See every rule AttendAI follows</ArrowLink>}
    />
    <ol className="mt-12 grid gap-x-10 gap-y-10 border-t border-border-subtle pt-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
      {GOALS.map((goal, i) => (
        <li key={goal.title}>
          <span aria-hidden className="lp-eyebrow tabular-nums text-brand-foreground">
            {String(i + 1).padStart(2, '0')}
          </span>
          <h3 className="lp-h3 mt-3 text-text-primary">{goal.title}</h3>
          <p className="lp-body mt-3 text-text-secondary">{goal.body}</p>
        </li>
      ))}
    </ol>
  </Section>
);

const Team: React.FC = () => (
  <Section tone="tint" aria-labelledby="team-title">
    <SectionHeader
      id="team-title"
      eyebrow="The team"
      title="The people behind AttendAI"
      lede="AttendAI was designed and built as our final-year project."
    />
    <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
      {TEAM.map((member) => (
        <li key={member.name}>
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-surface-subtle sm:aspect-[4/5]">
            <img
              src={member.image}
              alt={`Portrait of ${member.name}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              style={{
                objectPosition: member.position,
                transform: `scale(${member.scale})`,
                transformOrigin: member.position,
              }}
            />
          </div>
          <h3 className="lp-h3 mt-5 text-text-primary">{member.name}</h3>
          <p className="mt-1 text-body text-text-muted">{member.role}</p>
        </li>
      ))}
    </ul>
  </Section>
);

const Stack: React.FC = () => (
  <Section aria-labelledby="stack-title">
    <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-12 xl:gap-x-16">
      <div className="lg:col-span-5 xl:col-span-4">
        <Eyebrow>How it’s built</Eyebrow>
        <h2 id="stack-title" className="lp-h2 mt-3 text-text-primary">
          Open tools, on a server you control.
        </h2>
        <p className="lp-lede mt-5 max-w-[30rem] text-text-secondary">
          Nothing is sent to a third-party AI service. The browser guides the camera; the server makes every decision.
        </p>
      </div>
      <dl className="divide-y divide-border-subtle border-y border-border-subtle lg:col-span-7 lg:col-start-6">
        {STACK.map((row) => (
          <div key={row.term} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
            <dt className="text-body-strong text-text-primary">{row.term}</dt>
            <dd className="lp-body text-text-secondary">{row.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  </Section>
);

const AboutPage: React.FC = () => (
  <div className="lp flex min-h-screen flex-col bg-surface-default text-text-primary">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-body-strong focus:text-text-primary focus:shadow-lg"
    >
      Skip to content
    </a>
    <Navbar />
    <main id="main" className="flex-1">
      <AboutHero />
      <Story />
      <Goals />
      <Team />
      <Stack />
      <ClosingCta />
    </main>
    <Footer credits={credits} />
  </div>
);

export default AboutPage;
