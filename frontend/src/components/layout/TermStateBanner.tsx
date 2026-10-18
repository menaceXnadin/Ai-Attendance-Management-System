import React from 'react';
import { Link } from 'react-router-dom';
import { Info16Regular, Warning16Regular } from '@fluentui/react-icons';
import type { TermState, TermSummary } from '@/integrations/api/client';
import { useAttendancePolicy } from '@/components/attendance-admin/metrics';
import { cn } from '@/lib/utils';

export interface TermStateBannerProps {
  /** Overrides the policy endpoint's `term_state` (e.g. from a status payload). */
  termState?: TermState | null;
  /** Most recent / reporting term to mention, when known. */
  reportingTerm?: TermSummary | null;
  /** Show a link to Semester Setup (admin screens). */
  showSetupLink?: boolean;
  /** Extra sentence describing what this screen does while between terms. */
  context?: React.ReactNode;
  /** `admin` explains system behaviour; `member` (students/teachers) uses plain wording. */
  audience?: 'admin' | 'member';
  className?: string;
}

const SETUP_PATH = '/app/admin/semester-configuration';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Fluent MessageBar shown when the institution is between terms (or has no
 * terms configured). Renders nothing while a term is active. The state comes
 * from the server (`term_state`), never from the client clock.
 */
const TermStateBanner: React.FC<TermStateBannerProps> = ({
  termState,
  reportingTerm,
  showSetupLink = false,
  context,
  audience = 'admin',
  className,
}) => {
  const { policy } = useAttendancePolicy();
  const state: TermState | null = termState ?? policy?.term_state ?? null;

  if (!state || state === 'active') return null;

  const isNoTerms = state === 'no_terms';
  const Icon = isNoTerms ? Warning16Regular : Info16Regular;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-body text-text-primary',
        isNoTerms
          ? 'border-status-warning-border bg-status-warning-subtle'
          : 'border-status-info-border bg-status-info-subtle',
        className
      )}
    >
      <Icon
        className={cn('mt-0.5 shrink-0', isNoTerms ? 'text-status-warning' : 'text-status-info')}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p>
          <strong className="font-semibold">
            {isNoTerms ? 'No academic terms configured.' : 'Between terms.'}
          </strong>{' '}
          {audience === 'member'
            ? isNoTerms
              ? 'Classes and check-in are unavailable until an administrator sets up an academic term.'
              : 'No classes run until the next term starts and check-in is closed. Figures shown are for the most recent term'
            : isNoTerms
              ? 'No class sessions are generated and attendance metrics have no reporting period until a term is set up.'
              : 'No classes are scheduled today, automatic absence finalization does nothing, and metrics report on the most recent term'}
          {!isNoTerms && reportingTerm ? (
            <>
              {' '}
              (<span className="font-semibold">{reportingTerm.name}</span>, {formatDate(reportingTerm.start_date)} –{' '}
              {formatDate(reportingTerm.end_date)})
            </>
          ) : null}
          {!isNoTerms ? '.' : null}
          {context ? <> {context}</> : null}
        </p>
      </div>
      {showSetupLink && (
        <Link
          to={SETUP_PATH}
          className="shrink-0 text-body-strong text-brand-foreground underline-offset-4 hover:underline"
        >
          Semester Setup
        </Link>
      )}
    </div>
  );
};

export default TermStateBanner;
