import React from 'react';
import type { TermState, TermSummary } from '@/integrations/api/client';
import LayoutTermStateBanner from '@/components/layout/TermStateBanner';

interface TermStateBannerProps {
  termState: TermState | null | undefined;
  /** Reporting term the numbers refer to (most recent past term when between terms). */
  term?: TermSummary | null;
  className?: string;
}

/**
 * Student/teacher wording of the shared between-terms banner
 * (single implementation lives in `components/layout/TermStateBanner`).
 */
const TermStateBanner: React.FC<TermStateBannerProps> = ({ termState, term, className }) => (
  <LayoutTermStateBanner termState={termState ?? null} reportingTerm={term} audience="member" className={className} />
);

export default TermStateBanner;
