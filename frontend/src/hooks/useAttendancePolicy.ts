import { useQuery } from '@tanstack/react-query';
import { api, type AttendancePolicy } from '@/integrations/api/client';

export const ATTENDANCE_POLICY_QUERY_KEY = ['attendance-policy'] as const;

/**
 * Attendance policy (minimum %, bands, check-in window minutes, term state).
 * Backed by the cached `api.attendancePolicy.get()`; `data` is undefined while
 * loading or if the endpoint is unavailable — callers render neutral tones then.
 */
export const useAttendancePolicy = () =>
  useQuery<AttendancePolicy>({
    queryKey: ATTENDANCE_POLICY_QUERY_KEY,
    queryFn: () => api.attendancePolicy.get(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

export default useAttendancePolicy;
