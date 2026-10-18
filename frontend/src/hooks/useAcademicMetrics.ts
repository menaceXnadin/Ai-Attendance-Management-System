/**
 * Academic calendar metrics (instructional days / planned periods) for the current term.
 *
 * Attendance percentages are NOT computed here — they come from the server's
 * metrics service (`percentage`, `has_data`, `eligible`, `band`; DOMAIN_RULES §13.12).
 * The former client-side recalculation helpers were removed.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

export interface AcademicMetrics {
  total_academic_days: number;
  total_periods: number;
}

/**
 * Hook to get current semester academic metrics
 */
export const useCurrentSemesterMetrics = () => {
  return useQuery<AcademicMetrics>({
    queryKey: ['academic-metrics-current'],
    queryFn: () => api.academicMetrics.getCurrentSemester(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
};
