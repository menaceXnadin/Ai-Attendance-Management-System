import * as React from 'react';
import { ArrowLink, Container, Eyebrow, Photo, Section } from './primitives';
import { lectureHall } from './photos';

/**
 * Full-bleed lecture-hall photograph with one principle set in a solid
 * caption panel, magazine style. The panel overlaps the photo's bottom-left;
 * on lg+ it bleeds into the container gutter by exactly the gutter width, so
 * its text lines up with every other section's left edge.
 *
 * The gutter comes from `--lp-gutter` in landing.css.
 */
const EditorialBand: React.FC = () => (
  <Section bleed aria-labelledby="principle-title">
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-subtle sm:aspect-[16/9] lg:aspect-auto lg:h-[clamp(420px,42.857vw,560px)]">
      <Photo photo={lectureHall} sizes="100vw" />
    </div>

    <Container>
      <div className="relative -mt-12 bg-surface-default p-6 sm:-mt-20 sm:max-w-[36rem] sm:p-10 lg:-ml-[var(--lp-gutter)] lg:-mt-40 lg:max-w-[42rem] lg:pb-0 lg:pl-[var(--lp-gutter)] lg:pr-16 lg:pt-14">
        <Eyebrow>A rule, not a setting</Eyebrow>
        <h2 id="principle-title" className="lp-h2 mt-3 text-text-primary">
          An absence is only recorded for a class that actually happened.
        </h2>
        <p className="lp-lede mt-5 text-text-secondary">
          If nobody takes attendance, the class is flagged as unrecorded for follow-up instead of being filled with
          absences. Percentages leave out anything that wasn’t held, and when there’s nothing to count you see “—”,
          not 0%.
        </p>
        <ArrowLink to="#trust" className="mt-5">
          How records are protected
        </ArrowLink>
      </div>
    </Container>
  </Section>
);

export default EditorialBand;
