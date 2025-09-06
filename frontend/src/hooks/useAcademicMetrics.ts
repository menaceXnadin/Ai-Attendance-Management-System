/**
 * Hook for fetching and using academic metrics
 * Provides dynamic academic days and periods calculation
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

export interface AcademicMetrics {
  total_academic_days: number;
  total_periods: number;
}

export interface DetailedAcademicMetrics extends AcademicMetrics {
  class_days_breakdown: Array<{
    date: string;
    day_of_week: string;
    periods_count: number;
  }>;
}

/**
 * Hook to get current semester academic metrics
 */
export const useCurrentSemesterMetrics = () => {
  return useQuery({
    queryKey: ['academic-metrics-current'],
    queryFn: () => api.academicMetrics.getCurrentSemester(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
};

/**
 * Hook to get academic metrics for a specific date range
 */
export const useAcademicMetrics = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['academic-metrics', startDate, endDate],
    queryFn: () => api.academicMetrics.getSummary(startDate, endDate),
    enabled: !!(startDate && endDate),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
};

/**
 * Hook to get detailed academic metrics with daily breakdown
 */
export const useDetailedAcademicMetrics = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['academic-metrics-detailed', startDate, endDate],
    queryFn: () => api.academicMetrics.getDetailed(startDate, endDate),
    enabled: !!(startDate && endDate),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (more expensive query)
    retry: 2,
  });
};

/**
 * Hook to validate academic data integrity
 */
export const useAcademicDataValidation = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['academic-data-validation', startDate, endDate],
    queryFn: () => api.academicMetrics.validateData(startDate, endDate),
    enabled: !!(startDate && endDate),
    staleTime: 15 * 60 * 1000, // Cache for 15 minutes
    retry: 1,
  });
};

/**
 * Utility function to calculate attendance percentage with dynamic metrics
 */
export const calculateDynamicAttendancePercentage = (
  presentDays: number,
  academicMetrics?: AcademicMetrics,
  fallbackTotal?: number
): number => {
  const totalDays = academicMetrics?.total_academic_days || fallbackTotal || 0;
  if (totalDays === 0) return 0;
  return Math.round((presentDays / totalDays) * 100 * 10) / 10; // Round to 1 decimal
};

/**
 * Utility function to format academic metrics for display
 */
export const formatAcademicMetrics = (metrics?: AcademicMetrics) => {
  if (!metrics) {
    return {
      academicDaysText: '0 academic days',
      periodsText: '0 periods',
      averagePeriodsPerDay: 0,
    };
  }

  const averagePeriodsPerDay = metrics.total_academic_days > 0
    ? Math.round((metrics.total_periods / metrics.total_academic_days) * 10) / 10
    : 0;

  return {
    academicDaysText: `${metrics.total_academic_days} academic days`,
    periodsText: `${metrics.total_periods.toLocaleString()} periods`,
    averagePeriodsPerDay,
  };
};

/**
 * Get current semester date range (can be made configurable)
 */
export const getCurrentSemesterDates = () => ({
  start: '2025-08-01',
  end: '2025-12-15',
});

/**
 * Hook that combines attendance summary with academic metrics
 */
export const useEnhancedAttendanceSummary = (studentId?: number) => {
  const attendanceQuery = useQuery({
    queryKey: ['attendance-summary', studentId],
    queryFn: () => api.attendance.getSummary(studentId ? { studentId } : {}),
    enabled: true,
  });

  const metricsQuery = useCurrentSemesterMetrics();

  return {
    ...attendanceQuery,
    data: attendanceQuery.data ? {
      ...attendanceQuery.data,
      // Override total with dynamic calculation
      total: metricsQuery.data?.total_academic_days || attendanceQuery.data.total,
      // Add academic metrics
      academicMetrics: metricsQuery.data,
      // Recalculate percentage with dynamic total
      percentage_present: calculateDynamicAttendancePercentage(
        attendanceQuery.data.present,
        metricsQuery.data,
        attendanceQuery.data.total
      ),
    } : undefined,
    isLoading: attendanceQuery.isLoading || metricsQuery.isLoading,
    error: attendanceQuery.error || metricsQuery.error,
  };
};