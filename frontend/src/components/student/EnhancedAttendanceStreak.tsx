/**
 * Enhanced Attendance Streak & Badges Component
 * Uses the new robust backend API for accurate calculations
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { api, type MetricsBlock } from '@/integrations/api/client';
import TermStateBanner from '@/components/TermStateBanner';
import { useAttendancePolicy } from '@/hooks/useAttendancePolicy';
import { barWidth, formatPercent, metricTone, readMetrics, TONE_FILL } from '@/utils/metricsDisplay';
import {
  CalendarLtr20Regular,
  Checkmark12Filled,
  Crown20Regular,
  DataTrending20Regular,
  ErrorCircle20Regular,
  Fire20Filled,
  Flash20Regular,
  Ribbon20Filled,
  Ribbon20Regular,
  Rocket20Regular,
  Target20Regular,
  Trophy20Filled,
} from '@fluentui/react-icons';

interface StreakData extends MetricsBlock {
  current_streak: number;
  longest_streak: number;
  current_week_streak?: number;
  is_streak_active: boolean;
  total_class_days?: number;
  total_present_days?: number;
  calculation_period_days?: number;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  icon: string;
  color: string;
}

interface BadgesResponse {
  badges: BadgeData[];
  total_earned: number;
  streak_summary: {
    current_streak: number;
    longest_streak: number;
    is_active: boolean;
  };
}

const EnhancedAttendanceStreak: React.FC = () => {
  const { data: policy } = useAttendancePolicy();

  // Streaks + badges (server metrics service)
  const { data: streakData, isLoading: streakLoading, error: streakError } = useQuery<StreakData>({
    queryKey: ['my-streaks'],
    queryFn: () => api.streaks.getMyStreaks(),
    staleTime: 60000,
    retry: 2,
  });

  const { data: badgesData, isLoading: badgesLoading } = useQuery<BadgesResponse>({
    queryKey: ['my-badges'],
    queryFn: () => api.streaks.getMyBadges(),
    staleTime: 60000,
    retry: 2,
  });

  // Loading state
  if (streakLoading || badgesLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div
          className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-brand-subtle border-t-brand"
          role="progressbar"
          aria-label="Loading"
        />
        <p className="text-body text-text-muted">Loading your achievements...</p>
      </div>
    );
  }

  // Error state
  if (streakError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2.5"
      >
        <ErrorCircle20Regular className="mt-0.5 shrink-0 text-status-error" aria-hidden />
        <p className="text-body text-text-primary">Failed to load streak data. Please try again.</p>
      </div>
    );
  }

  // Rate comes from the server (null = no classes yet); never recomputed here.
  const metrics = readMetrics(streakData, ['attendance_rate', 'percentage_present']);
  const rateBarClass = TONE_FILL[metricTone(metrics, policy)];
  const classDays = streakData?.total_class_days;
  const presentDays = streakData?.total_present_days;

  // Presentation-only helpers
  const isActive = Boolean(streakData?.is_streak_active);
  const weekDays = Math.max(0, streakData?.current_week_streak || 0);

  const tierChip: Record<BadgeData['tier'], string> = {
    legendary: 'bg-status-warning-subtle text-status-warning',
    epic: 'bg-brand-subtle text-brand-foreground',
    rare: 'bg-status-info-subtle text-status-info',
    uncommon: 'bg-status-success-subtle text-status-success',
    common: 'bg-surface-subtle text-text-muted',
  };

  const currentStreak = streakData?.current_streak || 0;
  const motivation = !streakData?.is_streak_active
    ? {
        icon: <Target20Regular aria-hidden />,
        chip: 'bg-brand-subtle text-brand-foreground',
        title: 'Start Your Streak!',
        text: 'Your next attendance will begin a new streak. Every journey starts with a single step.',
      }
    : currentStreak < 7
    ? {
        icon: <Fire20Filled aria-hidden />,
        chip: 'bg-status-warning-subtle text-status-warning',
        title: 'Great Start!',
        text: 'Keep going to reach a 7-day streak and earn your Weekly Streak badge.',
      }
    : currentStreak < 14
    ? {
        icon: <Flash20Regular aria-hidden />,
        chip: 'bg-status-warning-subtle text-status-warning',
        title: "You're On Fire!",
        text: `Just ${14 - currentStreak} more days to reach a Hot Streak!`,
      }
    : currentStreak < 30
    ? {
        icon: <Rocket20Regular aria-hidden />,
        chip: 'bg-brand-subtle text-brand-foreground',
        title: 'Amazing Consistency!',
        text: `${30 - currentStreak} more days for a Super Streak achievement!`,
      }
    : {
        icon: <Crown20Regular aria-hidden />,
        chip: 'bg-brand-subtle text-brand-foreground',
        title: 'Legendary Performance!',
        text: "You're maintaining an outstanding attendance record. Keep it up, champion!",
      };

  return (
    <div className="space-y-4">
      <TermStateBanner termState={streakData?.term_state} term={streakData?.term} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Current Streak — Fluent achievement card */}
        <section aria-label="Current streak" className="rounded-lg bg-surface-default p-5 shadow lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${
                  isActive ? 'bg-status-warning-subtle text-status-warning' : 'bg-surface-subtle text-text-muted'
                }`}
              >
                <Fire20Filled aria-hidden />
              </div>
              <div>
                <p className="text-caption text-text-muted">Current Streak</p>
                <p className="flex items-baseline gap-2">
                  <span className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                    {streakData?.current_streak || 0}
                  </span>
                  <span className="text-body text-text-muted">consecutive days</span>
                </p>
              </div>
            </div>
            {streakData?.is_streak_active && (
              <Badge variant="success" shape="pill" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-success" aria-hidden />
                Active
              </Badge>
            )}
          </div>

          {/* This week — dots row */}
          <div className="mt-5 border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-caption-strong text-text-secondary">This Week</p>
              <p className="text-caption text-text-muted">
                <span className="tabular-nums text-text-primary">{streakData?.current_week_streak || 0}</span> Days present this week
              </p>
            </div>
            <div
              className="mt-3 flex items-center gap-2"
              role="img"
              aria-label={`${weekDays} days present this week`}
            >
              {Array.from({ length: Math.max(7, weekDays) }).map((_, i) => (
                <span
                  key={i}
                  className={`grid h-7 w-7 place-items-center rounded-full border ${
                    i < weekDays
                      ? 'border-status-success-border bg-status-success-subtle text-status-success'
                      : 'border-dashed border-border-default bg-surface-default text-text-disabled'
                  }`}
                >
                  {i < weekDays && <Checkmark12Filled aria-hidden />}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Best Streak */}
        <section aria-label="Best streak" className="flex flex-col rounded-lg bg-surface-default p-5 shadow">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <Trophy20Filled aria-hidden />
            </div>
            <div>
              <p className="text-caption text-text-muted">Best Streak</p>
              <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                {streakData?.longest_streak || 0}
              </p>
              <p className="text-caption text-text-muted">longest streak</p>
            </div>
          </div>
        </section>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Overall Rate */}
        <section aria-label="Overall rate" className="rounded-lg bg-surface-default p-5 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption text-text-muted">Overall Rate</p>
              <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                {formatPercent(metrics.percentage)}
              </p>
              <p className="text-caption text-text-muted">
                {!metrics.hasData
                  ? 'No classes yet'
                  : typeof presentDays === 'number' && typeof classDays === 'number'
                    ? `${presentDays}/${classDays} class days fully attended`
                    : metrics.considered !== null && metrics.attended !== null
                      ? `${metrics.attended}/${metrics.considered} classes attended`
                      : 'This term'}
              </p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <CalendarLtr20Regular aria-hidden />
            </div>
          </div>
          <div
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-border-subtle"
            role="progressbar"
            aria-valuenow={metrics.percentage ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-fluent-decelerate ${rateBarClass}`}
              style={{ width: `${barWidth(metrics.percentage)}%` }}
            />
          </div>
        </section>

        {/* Calculation Period */}
        <section aria-label="Calculation period" className="rounded-lg bg-surface-default p-5 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption text-text-muted">Calculation Period</p>
              <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                {streakData?.term?.name ?? (typeof streakData?.calculation_period_days === 'number' ? streakData.calculation_period_days : '—')}
              </p>
              <p className="text-caption text-text-muted">
                {streakData?.term ? 'Reporting term' : 'Days analyzed'}
              </p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-text-secondary">
              <DataTrending20Regular aria-hidden />
            </div>
          </div>
        </section>
      </div>

      {/* Achievement Badges */}
      {badgesData && Array.isArray(badgesData.badges) && badgesData.badges.length > 0 && (
        <section aria-label="Achievements" className="rounded-lg bg-surface-default shadow">
          <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
            <h3 className="flex items-center gap-2 text-subheading text-text-primary">
              <Ribbon20Regular className="shrink-0 text-brand-foreground" aria-hidden />
              Achievements
            </h3>
            <Badge
              variant="outline"
              shape="pill"
              className="border-transparent bg-brand-subtle text-brand-foreground"
            >
              {badgesData.total_earned} Earned
            </Badge>
          </header>
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
            {badgesData.badges.map((badge, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-default p-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${tierChip[badge.tier] ?? tierChip.common}`}>
                  {badge.tier === 'legendary' ? <Trophy20Filled aria-hidden /> : <Ribbon20Filled aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-body-strong text-text-primary">
                    {badge.name}
                  </h4>
                  <p className="mt-0.5 text-caption text-text-muted">
                    {badge.description}
                  </p>
                  <Badge variant="secondary" shape="pill" className="mt-2 capitalize">
                    {badge.tier}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Motivation Messages */}
      <section aria-label="Motivation" className="flex items-start gap-4 rounded-lg bg-surface-default p-5 shadow">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${motivation.chip}`}>
          {motivation.icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-subheading text-text-primary">{motivation.title}</h3>
          <p className="mt-1 text-body text-text-secondary">{motivation.text}</p>
        </div>
      </section>
    </div>
  );
};

export default EnhancedAttendanceStreak;
