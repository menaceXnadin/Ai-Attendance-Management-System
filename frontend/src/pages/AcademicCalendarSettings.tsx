import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarLtr20Regular, CalendarSettings20Regular, Info16Regular } from '@fluentui/react-icons';
import { apiClient, parseApiError } from '@/integrations/api/client';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { MessageBar } from '@/components/attendance-admin/shared';

interface DateBoundary {
  month: number;
  day: number;
}

interface CalendarOverride {
  id: number;
  fall_start: DateBoundary;
  fall_end: DateBoundary;
  spring_start: DateBoundary;
  spring_end: DateBoundary;
  is_override_active: boolean;
  reason: string;
  effective_from: string;
  effective_until: string | null;
  is_emergency_override: boolean;
  emergency_contact_email: string | null;
  created_at: string;
}

interface CurrentConfig {
  fall_start: [number, number];
  fall_end: [number, number];
  spring_start: [number, number];
  spring_end: [number, number];
  is_override_active: boolean;
  defaults?: {
    fall_start: [number, number];
    fall_end: [number, number];
    spring_start: [number, number];
    spring_end: [number, number];
  };
  override_details: CalendarOverride | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SETUP_PATH = '/app/admin/semester-configuration';

const formatMonthDay = (tuple?: [number, number] | null) =>
  Array.isArray(tuple) && tuple.length === 2 && MONTHS[tuple[0] - 1] ? `${MONTHS[tuple[0] - 1]} ${tuple[1]}` : '—';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <span className="text-body-strong text-text-primary">{label}</span>
    <span className="text-body tabular-nums text-text-secondary">{value}</span>
  </div>
);

export interface AcademicCalendarSettingsProps {
  /** Rendered inside Semester Setup (hides the link back to it). */
  embedded?: boolean;
}

/**
 * Legacy month/day academic calendar (`/admin/academic-calendar/*`).
 * Academic periods are now managed in Semester Setup; the write endpoints answer
 * 410 Gone, so this screen is a read-only reference.
 */
const AcademicCalendarSettings: React.FC<AcademicCalendarSettingsProps> = ({ embedded = false }) => {
  const query = useQuery({
    queryKey: ['legacy-academic-calendar'],
    queryFn: async () => (await apiClient.get<CurrentConfig>('/admin/academic-calendar/current')).data,
    retry: false,
  });
  const config = query.data;

  return (
    <div className="space-y-4">
      <MessageBar
        tone="info"
        icon={<Info16Regular />}
        actions={
          embedded ? undefined : (
            <Button asChild size="sm">
              <Link to={SETUP_PATH}>
                <CalendarSettings20Regular aria-hidden />
                Open Semester Setup
              </Link>
            </Button>
          )
        }
      >
        <strong className="font-semibold">Academic periods are managed in Semester Setup.</strong> The month/day calendar
        below no longer decides which term is current and can no longer be edited. It is kept only as a reference
        {embedded ? '; use the Terms tab to create or change terms.' : '.'}
      </MessageBar>

      {query.isLoading ? (
        <LoadingState rows={4} columns={2} />
      ) : query.isError ? (
        <ErrorState
          title="Legacy calendar unavailable"
          message={parseApiError(query.error).message}
          onRetry={() => void query.refetch()}
        />
      ) : config ? (
        <Card className="overflow-hidden border-0 bg-surface-default shadow">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border-subtle px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
              <CalendarLtr20Regular className="shrink-0 text-text-muted" aria-hidden />
              Legacy month/day calendar (read-only)
            </CardTitle>
            <Badge variant="secondary" shape="pill">
              {config.is_override_active ? 'Override recorded' : 'Defaults'}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border-subtle">
              <div className="bg-surface-subtle px-5 py-2 text-caption-strong text-text-secondary">Fall</div>
              <Row label="Start" value={formatMonthDay(config.fall_start)} />
              <Row label="End" value={formatMonthDay(config.fall_end)} />
              <div className="bg-surface-subtle px-5 py-2 text-caption-strong text-text-secondary">Spring</div>
              <Row label="Start" value={formatMonthDay(config.spring_start)} />
              <Row label="End" value={formatMonthDay(config.spring_end)} />
              {config.override_details && (
                <>
                  <div className="bg-surface-subtle px-5 py-2 text-caption-strong text-text-secondary">Recorded override</div>
                  <Row label="Reason" value={config.override_details.reason || '—'} />
                  <Row
                    label="Effective"
                    value={`${config.override_details.effective_from ?? '—'}${
                      config.override_details.effective_until ? ` – ${config.override_details.effective_until}` : ''
                    }`}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default AcademicCalendarSettings;
