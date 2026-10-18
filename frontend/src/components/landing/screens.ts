/**
 * Real screenshots of the AttendAI portals, captured from the running app in
 * light and dark themes. Files live in `src/assets/landing/screens/`. Owned by the screenshot pass.
 *
 * Captured 2026-10-18 at a 1440x900 viewport, DPR 2, then resized to 2000px (and 1000px) wide WebP.
 * Visible personal emails were rewritten to `<first>.<last>@students.example.edu` before capture.
 */
import studentDashboardLight from '@/assets/landing/screens/student-dashboard-light.webp';
import studentDashboardLight1000 from '@/assets/landing/screens/student-dashboard-light-1000.webp';
import studentDashboardDark from '@/assets/landing/screens/student-dashboard-dark.webp';
import studentDashboardDark1000 from '@/assets/landing/screens/student-dashboard-dark-1000.webp';
import studentCheckinLight from '@/assets/landing/screens/student-checkin-light.webp';
import studentCheckinLight1000 from '@/assets/landing/screens/student-checkin-light-1000.webp';
import studentCheckinDark from '@/assets/landing/screens/student-checkin-dark.webp';
import studentCheckinDark1000 from '@/assets/landing/screens/student-checkin-dark-1000.webp';
import studentAttendanceLight from '@/assets/landing/screens/student-attendance-light.webp';
import studentAttendanceLight1000 from '@/assets/landing/screens/student-attendance-light-1000.webp';
import studentAttendanceDark from '@/assets/landing/screens/student-attendance-dark.webp';
import studentAttendanceDark1000 from '@/assets/landing/screens/student-attendance-dark-1000.webp';
import teacherRegisterLight from '@/assets/landing/screens/teacher-register-light.webp';
import teacherRegisterLight1000 from '@/assets/landing/screens/teacher-register-light-1000.webp';
import teacherRegisterDark from '@/assets/landing/screens/teacher-register-dark.webp';
import teacherRegisterDark1000 from '@/assets/landing/screens/teacher-register-dark-1000.webp';
import adminAttendanceLight from '@/assets/landing/screens/admin-attendance-light.webp';
import adminAttendanceLight1000 from '@/assets/landing/screens/admin-attendance-light-1000.webp';
import adminAttendanceDark from '@/assets/landing/screens/admin-attendance-dark.webp';
import adminAttendanceDark1000 from '@/assets/landing/screens/admin-attendance-dark-1000.webp';
import adminAnalyticsLight from '@/assets/landing/screens/admin-analytics-light.webp';
import adminAnalyticsLight1000 from '@/assets/landing/screens/admin-analytics-light-1000.webp';
import adminAnalyticsDark from '@/assets/landing/screens/admin-analytics-dark.webp';
import adminAnalyticsDark1000 from '@/assets/landing/screens/admin-analytics-dark-1000.webp';

export interface ProductScreen {
  /** 2000px-wide light-theme image. */
  light: string;
  /** 2000px-wide dark-theme image. */
  dark: string;
  /** Pixel size of the 2000px images. */
  width: number;
  height: number;
  /** Describes what the screenshot shows (used as alt text). */
  alt: string;
  /** `srcset` for the light image: "<1000 url> 1000w, <2000 url> 2000w". */
  lightSrcSet?: string;
  /** `srcset` for the dark image: "<1000 url> 1000w, <2000 url> 2000w". */
  darkSrcSet?: string;
}

const srcSet = (small: string, large: string) => `${small} 1000w, ${large} 2000w`;

const screen = (
  light: string,
  light1000: string,
  dark: string,
  dark1000: string,
  alt: string,
): ProductScreen => ({
  light,
  dark,
  width: 2000,
  height: 1250,
  alt,
  lightSrcSet: srcSet(light1000, light),
  darkSrcSet: srcSet(dark1000, dark),
});

export const studentDashboard: ProductScreen = screen(
  studentDashboardLight,
  studentDashboardLight1000,
  studentDashboardDark,
  studentDashboardDark1000,
  "AttendAI student dashboard showing an 89.7% attendance rate, today's class schedule and an open check-in window for Data Structures 1",
);

export const studentCheckin: ProductScreen = screen(
  studentCheckinLight,
  studentCheckinLight1000,
  studentCheckinDark,
  studentCheckinDark1000,
  'AttendAI face check-in for Data Structures 1, asking for the six-digit class code and guiding the student through a head-turn liveness check',
);

export const studentAttendance: ProductScreen = screen(
  studentAttendanceLight,
  studentAttendanceLight1000,
  studentAttendanceDark,
  studentAttendanceDark1000,
  'AttendAI student attendance calendar for October 2026, marking each day present, partial, holiday or day off, with term attendance of 89.8%',
);

export const teacherRegister: ProductScreen = screen(
  teacherRegisterLight,
  teacherRegisterLight1000,
  teacherRegisterDark,
  teacherRegisterDark1000,
  'AttendAI teacher register for Programming Fundamentals 1, listing 12 students marked present, late, absent or not marked',
);

export const adminAttendance: ProductScreen = screen(
  adminAttendanceLight,
  adminAttendanceLight1000,
  adminAttendanceDark,
  adminAttendanceDark1000,
  'AttendAI admin view of six unrecorded class sessions awaiting a decision, each with "Resolve as held" and "Not held" actions',
);

export const adminAnalytics: ProductScreen = screen(
  adminAnalyticsLight,
  adminAnalyticsLight1000,
  adminAnalyticsDark,
  adminAnalyticsDark1000,
  'AttendAI analytics showing attendance for today, this week and this month, with a daily present, absent and late breakdown',
);
