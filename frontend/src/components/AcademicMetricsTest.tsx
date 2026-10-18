/**
 * Test component to verify academic metrics integration
 * This can be temporarily added to any page to test the API
 */

import React from 'react';
import { useCurrentSemesterMetrics } from '@/hooks/useAcademicMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckmarkCircle16Regular,
  CheckmarkCircle20Regular,
  DismissCircle16Regular,
  DismissCircle20Regular,
  Clock16Regular,
  Sparkle20Regular,
  CalendarLtr20Regular,
  Layer20Regular,
  Info16Regular,
  Warning20Regular,
} from '@fluentui/react-icons';

const AcademicMetricsTest: React.FC = () => {
  const { data: metrics, isLoading, error } = useCurrentSemesterMetrics();

  const avgPerDay = metrics?.total_academic_days
    ? Number((metrics.total_periods / metrics.total_academic_days).toFixed(1))
    : 0;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-md bg-brand-subtle text-brand-foreground grid place-items-center">
              <Sparkle20Regular aria-hidden />
            </div>
            <span>Academic Metrics</span>
            {isLoading && (
              <Badge variant="outline" shape="pill" className="gap-1">
                <Clock16Regular className="h-3 w-3" aria-hidden /> Loading
              </Badge>
            )}
            {error && (
              <Badge variant="destructive" shape="pill" className="gap-1">
                <DismissCircle16Regular className="h-3 w-3" aria-hidden /> Error
              </Badge>
            )}
            {metrics && (
              <Badge variant="success" shape="pill" className="gap-1">
                <CheckmarkCircle16Regular className="h-3 w-3" aria-hidden /> Success
              </Badge>
            )}
          </CardTitle>
          {metrics && (
            <div className="flex items-center gap-1.5 text-caption text-text-muted">
              <span className="h-2 w-2 rounded-full bg-presence-available" aria-hidden />
              Live • dynamic
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            <div className="animate-skeleton h-4 w-64 rounded bg-surface-selected" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="animate-skeleton h-20 rounded-md bg-surface-selected" />
              <div className="animate-skeleton h-20 rounded-md bg-surface-selected" />
              <div className="animate-skeleton h-20 rounded-md bg-surface-selected" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2">
            <DismissCircle20Regular className="mt-0.5 shrink-0 text-status-error" aria-hidden />
            <div>
              <div className="text-body-strong text-text-primary">Failed to load academic metrics</div>
              <p className="mt-0.5 text-caption text-text-secondary">
                Ensure the backend API is running and accessible.
              </p>
            </div>
          </div>
        )}

        {metrics && (
          <div className="space-y-4">
            {/* success message bar */}
            <div className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2">
              <CheckmarkCircle20Regular className="shrink-0 text-status-success" aria-hidden />
              <span className="text-body text-text-primary">Successfully fetched dynamic academic metrics!</span>
            </div>

            {/* stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-md bg-surface-subtle border border-border-subtle p-4">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-text-muted">Academic Days</span>
                  <CalendarLtr20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                </div>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{metrics.total_academic_days}</div>
              </div>

              <div className="rounded-md bg-surface-subtle border border-border-subtle p-4">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-text-muted">Total Periods</span>
                  <Layer20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                </div>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{metrics.total_periods?.toLocaleString()}</div>
              </div>

              <div className="rounded-md bg-surface-subtle border border-border-subtle p-4">
                <div className="text-caption text-text-muted">Avg. Periods / Day</div>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{avgPerDay}</div>
                  <div className="w-24 pb-2">
                    <Progress value={Math.min((avgPerDay / 10) * 100, 100)} className="h-1.5" />
                  </div>
                </div>
                <p className="mt-1 text-caption text-text-muted">Scaled to 10 for visualization</p>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-caption text-text-muted">
              <Info16Regular className="shrink-0" aria-hidden />
              These values are live from the API and replace hardcoded constants across the app.
            </p>
          </div>
        )}

        {!isLoading && !error && !metrics && (
          <div className="flex items-center gap-2 rounded-md border border-status-warning-border bg-status-warning-subtle px-3 py-2">
            <Warning20Regular className="shrink-0 text-status-warning" aria-hidden />
            <span className="text-body text-text-primary">No data received - check API response format</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AcademicMetricsTest;
