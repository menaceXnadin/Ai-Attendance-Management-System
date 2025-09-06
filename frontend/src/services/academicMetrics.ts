/**
 * Academic Metrics Service
 * 
 * Service for fetching dynamic academic days and periods calculations
 * using the new backend API endpoints.
 */

import { apiClient } from '../integrations/api/client';

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

export interface AcademicBreakdown {
  total_academic_days: number;
  total_periods: number;
  date_range: {
    start: string;
    end: string;
  };
  daily_breakdown: Array<{
    date: string;
    day_of_week: string;
    periods_count: number;
    subjects: Array<{
      subject_name: string;
      start_time: string;
      end_time: string;
      classroom?: string;
      faculty?: string;
    }>;
  }>;
}

export interface ValidationResult {
  total_class_days: number;
  days_with_issues: Array<{
    date: string;
    day_of_week: string;
    issue: string;
    periods_count: number;
  }>;
  summary: {
    days_without_schedules: number;
    days_with_empty_schedules: number;
    total_issues: number;
  };
  data_integrity: 'good' | 'needs_attention';
}

class AcademicMetricsService {
  
  /**
   * Get simple academic metrics for a date range
   * Returns just the totals needed for attendance calculations
   */
  async getAcademicMetrics(
    startDate: string, 
    endDate: string,
    semester?: number,
    academicYear?: number
  ): Promise<AcademicMetrics> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    
    if (semester) params.append('semester', semester.toString());
    if (academicYear) params.append('academic_year', academicYear.toString());
    
    const response = await apiClient.get(`/academic-metrics/summary?${params}`);
    return response.data;
  }

  /**
   * Get current semester metrics (Fall 2025)
   * Convenience method for the active semester
   */
  async getCurrentSemesterMetrics(): Promise<AcademicMetrics> {
    const response = await apiClient.get('/academic-metrics/current-semester');
    return response.data.data;
  }

  /**
   * Get detailed academic metrics with breakdown
   * Includes daily breakdown and period counts
   */
  async getDetailedMetrics(
    startDate: string,
    endDate: string,
    semester?: number,
    academicYear?: number
  ): Promise<DetailedAcademicMetrics> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    
    if (semester) params.append('semester', semester.toString());
    if (academicYear) params.append('academic_year', academicYear.toString());
    
    const response = await apiClient.get(`/academic-metrics/calculate?${params}`);
    return response.data.data;
  }

  /**
   * Get comprehensive breakdown with schedule details
   * Includes subject-level information for each day
   */
  async getScheduleBreakdown(
    startDate: string,
    endDate: string,
    semester?: number,
    academicYear?: number
  ): Promise<AcademicBreakdown> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    
    if (semester) params.append('semester', semester.toString());
    if (academicYear) params.append('academic_year', academicYear.toString());
    
    const response = await apiClient.get(`/academic-metrics/detailed-breakdown?${params}`);
    return response.data.data;
  }

  /**
   * Validate academic data integrity
   * Checks for missing schedules or inconsistencies
   */
  async validateAcademicData(
    startDate: string,
    endDate: string
  ): Promise<ValidationResult> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    
    const response = await apiClient.get(`/academic-metrics/validate-data?${params}`);
    return response.data.validation;
  }

  /**
   * Get academic metrics for a specific month
   * Convenience method for monthly reports
   */
  async getMonthlyMetrics(year: number, month: number): Promise<AcademicMetrics> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    
    return this.getAcademicMetrics(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }

  /**
   * Calculate attendance percentage using new metrics
   * Replaces the old static calculation
   */
  async calculateAttendancePercentage(
    presentDays: number,
    startDate: string,
    endDate: string
  ): Promise<{
    percentage: number;
    totalAcademicDays: number;
    totalPeriods: number;
    presentDays: number;
  }> {
    const metrics = await this.getAcademicMetrics(startDate, endDate);
    
    const percentage = metrics.total_academic_days > 0 
      ? (presentDays / metrics.total_academic_days) * 100 
      : 0;
    
    return {
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
      totalAcademicDays: metrics.total_academic_days,
      totalPeriods: metrics.total_periods,
      presentDays
    };
  }
}

// Export singleton instance
export const academicMetricsService = new AcademicMetricsService();

// Export utility functions
export const formatAcademicMetrics = (metrics: AcademicMetrics) => ({
  academicDaysText: `${metrics.total_academic_days} academic days`,
  periodsText: `${metrics.total_periods} total periods`,
  averagePeriodsPerDay: metrics.total_academic_days > 0 
    ? Math.round((metrics.total_periods / metrics.total_academic_days) * 10) / 10
    : 0
});

export const getCurrentSemesterDates = () => ({
  start: '2025-08-01',
  end: '2025-12-15'
});

// React hook for easy integration
export const useAcademicMetrics = () => {
  return {
    getMetrics: academicMetricsService.getAcademicMetrics.bind(academicMetricsService),
    getCurrentSemester: academicMetricsService.getCurrentSemesterMetrics.bind(academicMetricsService),
    getDetailed: academicMetricsService.getDetailedMetrics.bind(academicMetricsService),
    getBreakdown: academicMetricsService.getScheduleBreakdown.bind(academicMetricsService),
    validate: academicMetricsService.validateAcademicData.bind(academicMetricsService),
    calculatePercentage: academicMetricsService.calculateAttendancePercentage.bind(academicMetricsService)
  };
};