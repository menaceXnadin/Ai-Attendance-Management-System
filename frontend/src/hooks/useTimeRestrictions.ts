import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type StudentTodaySchedule } from '@/integrations/api/client';
import { evaluateCheckin, type CheckinAvailability, type ClassPeriod } from '@/utils/timeRestrictions';
import { isDevelopmentOverrideEnabled } from '@/utils/developmentOverride';

/** Shared query key so the dashboard, schedule card and check-in hook share one request. */
export const STUDENT_TODAY_QUERY_KEY = ['student-today-schedule'] as const;

export interface UseTimeRestrictionsReturn {
  isAllowed: boolean;
  reason: string;
  currentPeriod: ClassPeriod | null;
  nextPeriod?: ClassPeriod;
  timeUntilNext?: string;
  availability: CheckinAvailability;
  /** Today's classes + term/day state as reported by the server. */
  schedule: StudentTodaySchedule | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** Re-reads the server state after a check-in (replaces the old localStorage history). */
  markVerificationComplete: () => void;
  /** UI-only developer preview flag; it never opens check-in (the server decides). */
  devPreview: boolean;
}

/**
 * Student check-in availability, derived only from `GET /schedules/student/today`.
 * Fails closed when the schedule is missing or the request fails.
 */
export const useTimeRestrictions = (options: { enabled?: boolean } = {}): UseTimeRestrictionsReturn => {
  const enabled = options.enabled !== false;
  const [now, setNow] = useState(() => Date.now());

  const query = useQuery({
    queryKey: STUDENT_TODAY_QUERY_KEY,
    queryFn: () => api.schedules.getStudentTodayContext(),
    enabled,
    // Window states are computed server-side at request time; refresh often so
    // "not_open" → "open" → "closed" transitions show up promptly.
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const availability = useMemo(
    () =>
      evaluateCheckin(query.data, {
        loading: query.isLoading,
        loadFailed: query.isError && !query.data,
        now,
      }),
    [query.data, query.isLoading, query.isError, now]
  );

  const { refetch } = query;

  return {
    isAllowed: availability.allowed,
    reason: availability.reason,
    currentPeriod: availability.currentPeriod,
    nextPeriod: availability.nextPeriod,
    timeUntilNext: availability.timeUntilNext,
    availability,
    schedule: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void refetch(),
    markVerificationComplete: () => void refetch(),
    devPreview: isDevelopmentOverrideEnabled(),
  };
};
