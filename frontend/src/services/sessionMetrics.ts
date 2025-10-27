/**
 * Session Metrics Service
 * 
 * Handles API calls for planned vs actual class session metrics
 */

import { apiClient } from '../integrations/api/client';

export interface SessionMetrics {
  planned: {
    total_academic_days: number;
    total_periods: number;
    source: string;
    description: string;
  };
  actual: {
    total_conducted_days: number;
    total_conducted_periods: number;
    unique_dates: string[];
    source: string;
    description: string;
  };
  recommended: {
    method: 'planned' | 'actual' | 'hybrid';
    reason: string;
    use_case: string;
  };
  deviation: {
    count: number;
    percentage: number;
    severity: 'minimal' | 'moderate' | 'significant';
    impact: string;
    direction: 'more_than_planned' | 'less_than_planned' | 'matches_plan';
    likely_causes: string[];
    recommendation: string;
  };
  metadata: {
    start_date: string;
    end_date: string;
    student_id?: number;
    subject_id?: number;
    calculation_timestamp: string;
  };
}

export interface AttendanceWithDeviation {
  present_days: number;
  total_days_used: number;
  percentage: number;
  calculation_method: 'planned' | 'actual' | 'hybrid';
  metrics_breakdown: SessionMetrics;
  deviation_alert: boolean;
  recommendation: {
    method: string;
    reason: string;
    use_case: string;
  };
}

export interface DeviationSummary {
  planned_total: number;
  actual_total: number;
  deviation: number;
  deviation_percentage: number;
  severity: 'minimal' | 'moderate' | 'significant';
  status: 'healthy' | 'info' | 'warning';
  message: string;
  likely_causes: string[];
}

export interface StudentSpecificMetrics {
  student_info: {
    id: number;
    name: string;
    semester: number;
  };
  planned_classes: number;
  actual_classes_student_has_records: number;
  attended_classes: number;
  attendance_percentage: number;
  deviation_from_plan: number;
  missed_opportunities: number;
  metrics_detail: SessionMetrics;
}

class SessionMetricsService {
  /**
   * Get comprehensive session metrics showing planned vs actual
   */
  async getComprehensiveMetrics(params: {
    startDate: string;
    endDate: string;
    studentId?: number;
    subjectId?: number;
    semester?: number;
    academicYear?: number;
  }): Promise<SessionMetrics> {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.startDate);
    queryParams.append('end_date', params.endDate);
    if (params.studentId) queryParams.append('student_id', params.studentId.toString());
    if (params.subjectId) queryParams.append('subject_id', params.subjectId.toString());
    if (params.semester) queryParams.append('semester', params.semester.toString());
    if (params.academicYear) queryParams.append('academic_year', params.academicYear.toString());

    const response = await apiClient.get<SessionMetrics>(
      `/session-metrics/comprehensive?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Calculate attendance with deviation awareness
   */
  async getAttendanceWithDeviation(params: {
    startDate: string;
    endDate: string;
    calculationMethod?: 'planned' | 'actual' | 'hybrid';
  }): Promise<AttendanceWithDeviation> {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.startDate);
    queryParams.append('end_date', params.endDate);
    queryParams.append('calculation_method', params.calculationMethod || 'hybrid');

    const response = await apiClient.get<AttendanceWithDeviation>(
      `/session-metrics/attendance-with-deviation?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Get quick deviation summary
   */
  async getDeviationSummary(params: {
    startDate: string;
    endDate: string;
  }): Promise<DeviationSummary> {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.startDate);
    queryParams.append('end_date', params.endDate);

    const response = await apiClient.get<DeviationSummary>(
      `/session-metrics/deviation-summary?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Get student-specific metrics
   */
  async getStudentSpecificMetrics(params: {
    startDate: string;
    endDate: string;
  }): Promise<StudentSpecificMetrics> {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.startDate);
    queryParams.append('end_date', params.endDate);

    const response = await apiClient.get<StudentSpecificMetrics>(
      `/session-metrics/student-specific?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Get formatted metric display text
   */
  formatMetricDisplay(metrics: SessionMetrics): {
    title: string;
    message: string;
    statusColor: string;
    icon: string;
  } {
    const { deviation } = metrics;

    let statusColor: string;
    let icon: string;
    let title: string;
    let message: string;

    if (deviation.severity === 'minimal') {
      statusColor = 'text-green-400';
      icon = '✓';
      title = 'Sessions On Track';
      message = `${metrics.actual.total_conducted_days} classes conducted as planned`;
    } else if (deviation.direction === 'more_than_planned') {
      statusColor = 'text-blue-400';
      icon = '+';
      title = 'Extra Sessions';
      message = `${Math.abs(deviation.count)} additional classes conducted`;
    } else {
      statusColor = 'text-amber-400';
      icon = '!';
      title = 'Deviation Detected';
      message = `${Math.abs(deviation.count)} fewer classes than planned`;
    }

    return { title, message, statusColor, icon };
  }

  /**
   * Get deviation badge color
   */
  getDeviationBadgeColor(severity: string): string {
    switch (severity) {
      case 'minimal':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'moderate':
        return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
      case 'significant':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  }

  /**
   * Format deviation for display
   */
  formatDeviation(deviation: number): string {
    if (deviation === 0) return 'On Track';
    const sign = deviation > 0 ? '+' : '';
    return `${sign}${deviation}`;
  }

  /**
   * Get recommendation text
   */
  getRecommendationText(method: 'planned' | 'actual' | 'hybrid'): string {
    switch (method) {
      case 'planned':
        return 'Using scheduled classes from calendar';
      case 'actual':
        return 'Using only conducted sessions for fairness';
      case 'hybrid':
        return 'Smart calculation based on deviation';
      default:
        return 'Using default calculation';
    }
  }
}

export const sessionMetricsService = new SessionMetricsService();
export default sessionMetricsService;
