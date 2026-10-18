import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { STUDENT_TODAY_QUERY_KEY } from '@/hooks/useTimeRestrictions';

export const FACE_POLICY_QUERY_KEY = ['face-policy'] as const;
export const FACE_ENROLLMENT_QUERY_KEY = ['face-enrollment'] as const;

/** Public face policy (`GET /face-recognition/policy`): what the capture UI must collect. */
export const useFacePolicy = (enabled = true) =>
  useQuery({
    queryKey: FACE_POLICY_QUERY_KEY,
    queryFn: () => api.faceRecognition.getPolicy(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled,
  });

/** The logged-in student's enrolment state (`GET /face-recognition/enrollment`). */
export const useFaceEnrollment = (enabled = true) =>
  useQuery({
    queryKey: FACE_ENROLLMENT_QUERY_KEY,
    queryFn: () => api.faceRecognition.getEnrollment(),
    staleTime: 30 * 1000,
    retry: 1,
    enabled,
  });

/** Every student view that shows `face_registered` / the enrolment state. */
export const invalidateStudentFaceViews = (queryClient: QueryClient) =>
  Promise.all(
    [
      FACE_ENROLLMENT_QUERY_KEY,
      ['current-student'],
      ['current-student-sidebar'],
      ['current-student-face-status'],
      ['current-student-profile'],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );

/** Views to refresh after a check-in attempt (today's classes, summary, streaks). */
export const invalidateAfterCheckin = (queryClient: QueryClient) =>
  Promise.all(
    [
      STUDENT_TODAY_QUERY_KEY,
      ['today-attendance-data'],
      ['attendance-summary'],
      ['student-attendance-summary'],
      ['my-streaks'],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
