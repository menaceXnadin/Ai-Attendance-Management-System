# Frontend (React)

Reference for `frontend/`. Read it before changing screens, the design system or the API client. Attendance business rules live in [domain-rules.md](domain-rules.md) and are enforced by the backend. The frontend only displays what the server decides. Code comments cite rules as `DOMAIN_RULES §13.x`, using the section numbers from the original design document.

**Stack:** React 18, TypeScript 5.6, Vite 5 (SWC plugin), Tailwind 3, shadcn/ui on Radix, TanStack Query 5, react-router-dom 6, Recharts 2, react-big-calendar with moment (academic calendar), MediaPipe Tasks face detection in the browser (`@mediapipe/tasks-vision`), `qrcode.react` for classroom check-in codes. Icons come from `@fluentui/react-icons`, which is the preferred set. The only leftover from another library is lucide in `ClassesPage.tsx` (not routed); `@carbon/icons-react` is still a dependency but nothing imports it.

---

## 1. Run, build, check

Use npm only. `bun.lockb` is stale; do not use bun.

```
cd frontend
npm install
npm run dev                              # Vite dev server on VITE_PORT || PORT || 8080, host VITE_HOST || HOST || "::"
npm run build                            # production build to dist/
npm run build:dev                        # development-mode build
npm run preview                          # serve dist/ on the same port
npm run lint                             # ESLint 9 flat config: expect 0 errors and about 18 warnings (fast-refresh, hook deps)
npx tsc -p tsconfig.app.json --noEmit    # type check: baseline is 13 pre-existing errors
```

- **Proxy:** `vite.config.ts` proxies `/api/*` to `http://127.0.0.1:8000` and logs every proxied request to the Vite console. Start the backend first (see [architecture.md](architecture.md)).
- **Type-check baseline:** 11 errors in `pages/ClassesPage.tsx` (not routed), 1 in `pages/StudentsPage.tsx` and 1 in `pages/TeachersPage.tsx`. Do not add new ones. Compare the count before and after your change.
- **`frontend/tsconfig.app.json` must NOT contain `"ignoreDeprecations": "6.0"`.** An editor running a newer TypeScript keeps adding it back. TS 5.6 then rejects the config (TS5103) and `tsc` checks nothing. Delete the line whenever it reappears.
- `tsconfig.app.json` uses `strict: false` and `noImplicitAny: false`. The path alias `@/*` maps to `src/*`, in both tsconfig and Vite.
- **Env:** `VITE_PORT` and `VITE_HOST` set the dev server. `VITE_MEDIAPIPE_ASSET_BASE` overrides where MediaPipe WASM and model files load from (default: the local copy in `public/mediapipe/`, no CDN). `VITE_API_URL` appears in `.env` but nothing reads it.
- There are no frontend unit tests (see [testing.md](testing.md)).

## 2. Directory map (`frontend/`)

| Path | What it holds |
|---|---|
| `index.html` | Root page, plus an inline script that applies the saved theme before first paint |
| `vite.config.ts` | Port and host, `/api` proxy, `@` alias, `__APP_VERSION__` define |
| `tailwind.config.ts` | Fluent 2 token mapping: colors, type ramp, radii, shadows, easing |
| `components.json` | shadcn generator config (aliases `@/components/ui`, `@/lib/utils`) |
| `public/mediapipe/` | Local MediaPipe Tasks assets: `tasks/` (the wasm runtime copied from `node_modules/@mediapipe/tasks-vision/wasm`) and `models/blaze_face_short_range.tflite`. Re-copy `tasks/` after upgrading `@mediapipe/tasks-vision` |
| `src/main.tsx` | Mounts `ErrorBoundary > AuthProvider > ThemeProvider(storageKey "attendai-theme") > App` |
| `src/App.tsx` | QueryClient, the global providers and **every route** |
| `src/index.css` | CSS variables for light and `.dark`, base styles, `.fluent-card`, `.page-header`, the shell `:has()` rule, scrollbar, reduced motion |
| `src/integrations/api/client.ts` | `api` object, `apiRequest`, `apiClient`, error helpers, contract-v1 types (about 2,300 lines) |
| `src/integrations/api/types.ts` | Older shared types (`User`, `Student`, `Attendance`, ...) |
| `src/contexts/` | `AuthContext.ts` (type and context), `AuthProvider.tsx`, `useAuth.ts`. `AuthContext.tsx` and `SimpleAuthProvider.tsx` are stubs |
| `src/components/layout/` | `AppShell`, `ShellNav`, `ShellCommandPalette`, `ShellAccountMenu`, `shell-types.ts`, `FullPageLoader`, `TermStateBanner` |
| `src/components/ui/` | shadcn/Radix primitives restyled to Fluent (button, badge, alert, dialog, table, tabs, select, command, chart, ...) |
| `src/components/feedback/` | `EmptyState`, `ErrorState`, `LoadingState` (plus `Spinner`) |
| `src/components/attendance-admin/` | Contract-v1 attendance tooling: session register, unrecorded panel, dialogs, `errors.ts`, `metrics.ts`, `shared.tsx` |
| `src/components/attendance/` | Admin attendance page pieces (`EnhancedAttendanceManagement`, `IndividualStudentAnalysis`, table, filters) |
| `src/components/dashboard/`, `student/`, `admin/` | Dashboard cards, student widgets, `CalendarGeneratorControl` |
| `src/components/*.tsx` (top level) | Route guards, role sidebars (`DashboardSidebar`, `TeacherSidebar`, `StudentSidebar`), `FaceRecognition`, `FaceRegistration`, `TodayClassSchedule`, `ScheduleManagement`, `NotificationCenter`, `ThemeProvider`, `ThemeToggle`, `TermStateBanner` (member wrapper) and many older analytics components |
| `src/components/data-view/DataTable.tsx`, `filters/SemesterFilter.tsx` | Generic table (currently unused) and the teacher semester filter |
| `src/components/landing/` | Public landing page sections (see §8 "Public site"): `primitives.tsx` + `landing.css` (marketing type scale `lp-*`, `--lp-gutter`), `photos.ts` and `screens.ts` (asset manifests), one file per section |
| `src/assets/landing/` | Landing imagery: `photos/` (Unsplash photography, WebP, credited in the footer) and `screens/` (real portal screenshots, light and dark, 1000w and 2000w) |
| `src/pages/` | Route screens (see §3). Not routed: `ClassesPage`, `EnhancedAttendancePage`, `Index`, `ModernAcademicCalendar`, `RegisterPage`. `AcademicCalendarSettings` is embedded in Semester Setup |
| `src/hooks/` | `useAttendancePolicy`, `useTimeRestrictions` (student check-in state), `useAttendanceData` (admin attendance page state), `useAcademicMetrics`, `useApiErrorHandler`, face-detection hooks, `use-toast`, `use-mobile`, `useTheme` |
| `src/utils/` | `metricsDisplay.ts` (null-safe metrics and local dates), `timeRestrictions.ts` (check-in evaluation and rejection messages), `dateUtils.ts`, `developmentOverride.ts` |
| `src/components/face/` | Student face capture: `CameraStage` (video tile, guide oval, prompts), `useCameraStream`, `capture.ts` (unmirrored ≤640 px JPEG frames), `PresenceCodeInput`, `FaceMessage`, `faceQueries.ts`, `enrolmentMessages.ts` |
| `src/components/face-admin/` | Staff face tools: `PresenceCodeDialog` (QR + rotating code), `FaceAttemptsPanel`, `StudentFaceDialog` (status, history, reset), `FacePolicySettingsCard`, `FaceBadges`, `faceLabels.ts` |
| `src/lib/` | `utils.ts` (`cn`), `mediapipe.ts` (asset base for the wasm runtime and the model) |
| `src/config/api.ts` | `API_BASE_URL = '/api'` (same-origin, proxied). Only older code (notifications) uses it; prefer `api` |
| `src/services/` | `mediaPipeService.ts`, `notificationService.ts` (direct `fetch`, older code) |
| `src/styles/calendar.css` | react-big-calendar overrides |

## 3. Routing, roles and auth

**Provider tree** (`App.tsx`): `QueryClientProvider > TooltipProvider > <Toaster/> + <Sonner/> > BrowserRouter (future v7_startTransition) > ApiErrorBoundary > Suspense(FullPageLoader) > Routes`. Most protected routes add their own `ApiErrorBoundary`.

**Code splitting:** every route except the landing page, login and 404 is loaded with `React.lazy`, so `/` doesn't download the portals. Admin child routes get their own `Suspense` with an in-shell `LoadingState`, so the shell stays visible. `v7_startTransition` keeps the current page on screen while a chunk loads. Add new routes as `lazy(() => import(...))`.

**Auth (`contexts/AuthProvider.tsx`):**
- The JWT is stored under the key **`authToken`**: localStorage when "remember me" is on, sessionStorage otherwise. **Always use `src/lib/authToken.ts`** (`getAuthToken()` reads both, `setAuthToken()` replaces it in whichever storage holds it, `clearAuthToken()` clears both); never touch `localStorage` directly.
- On load, the provider reads the token. If the token has expired it calls `POST /auth/refresh-token`. Otherwise it calls `GET /auth/me` (`api.auth.getUser`) and sets `user`. Only a 401 logs the user out; network errors keep the session.
- Read auth with `const { user, loading, signIn, signOut } = useAuth()`. `user.role` is `admin`, `teacher` (or `faculty`) or `student`. Self-registration is disabled.

**Guards:**
- `ProtectedRoute` shows `FullPageLoader` while `loading`, sends anonymous users to `/login` (with `state.from`), and enforces the portal for the path: `/app*` → admin, `/teacher*` → teacher/faculty, `/student*` and `/face-registration` → student. A user on the wrong portal is sent to **their own** home (`/app`, `/teacher` or `/student`), so redirects can't loop.
- `AdminRoute` sends non-admins to their own home (teachers to `/teacher`, students to `/student`).
- `RoleRedirect` (`/dashboard`) sends admins to `/app`, teachers and faculty to `/teacher`, and everyone else to `/student`. After login, go through `/dashboard`.

**Layouts:**
- **Admin** routes are nested under `/app` and render through `DashboardLayout` (an `<Outlet/>` inside `DashboardSidebar`, which renders `AppShell`). Admin pages do **not** wrap themselves.
- **Teacher and student** pages are flat routes. Each page wraps its own content in `<TeacherSidebar>` or `<StudentSidebar>`, both of which render `AppShell`. A new teacher or student page must do the same.

| Route | Component | Access |
|---|---|---|
| `/`, `/about`, `/blog` | `HomePage`, `AboutPage`, `BlogPage` | public |
| `/login`, `/forgot-password`, `/reset-password` | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` | public |
| `/register` | redirects to `/login` | public |
| `/dashboard` | `RoleRedirect` | any user |
| `/attendance-analytics-demo`, `/advanced-analytics-demo`, `/global-analytics-demo`, `/merged-analytics-demo`, `analytics-showcase` | demo pages | public (dev only) |
| `/status` | `SystemStatusPage` | logged in |
| `/student` | `StudentDashboard` | student |
| `/student/attendance` | `StudentAttendancePage` (embeds `StudentAttendanceCalendar`) | student |
| `/student/attendance/mark` | `StudentMarkAttendancePage` (`FaceRecognition`). Target of the classroom QR: `?session=<id>&code=<code>`. "Check in" in the student nav | student |
| `/student/calendar` | `StudentCalendar` (wraps `AcademicCalendar`) | student |
| `/student/notifications`, `/student/profile` | `StudentNotificationsPage`, `ProfilePage` | student |
| `/face-registration` | `StudentFaceRegistrationPage` | student |
| `/teacher` | `TeacherDashboard` | teacher |
| `/teacher/attendance` | `TeacherAttendancePage` | teacher |
| `/teacher/schedule`, `/teacher/notifications`, `/teacher/profile` | `TeacherSchedulePage`, `TeacherNotificationsPage`, `TeacherProfilePage` | teacher |
| `/teacher/subjects/:subjectId/students` and `.../analytics` | `TeacherSubjectStudents`, `TeacherSubjectAnalytics` | teacher |
| `/app` (index) | `Dashboard` | admin |
| `/app/students`, `/app/students/:studentId/calendar` | `StudentsPage`, `StudentAttendanceCalendar` | admin |
| `/app/teachers`, `/app/faculties` | `TeachersPage`, `FacultiesPage` | admin |
| `/app/schedules` | `components/ScheduleManagement` | admin |
| `/app/calendar` | `AcademicCalendar embedded` | admin |
| `/app/attendance` | `AttendancePage` | admin |
| `/app/auto-absent` | `AutoAbsentManagementPage` | admin |
| `/app/admin/semester-configuration` | `SemesterConfigurationPage` | admin |
| `/app/analytics` | `AnalyticsPage` (`AdvancedAnalyticsDashboard`) | admin |
| `/app/monitoring`, `/app/notifications` | `LiveMonitoringPage`, `AdminNotificationsPage` | admin |
| `/app/settings`, `/app/settings/attendance-thresholds` | `SettingsPage`, `AttendanceThresholdSettings` | admin |
| `/app/tools/reset-link` | `AdminGenerateResetLinkPage` | admin |
| `*` | `NotFound` | public |

Adding an admin screen takes three steps: add a `<Route>` under `/app` in `App.tsx`, add a nav item to `navGroups` in `DashboardSidebar.tsx`, and add a branch in its `getPageInfo()`, which supplies the fallback title. Teacher and student screens work the same way, using `TeacherSidebar` or `StudentSidebar`.

## 4. App shell (Teams-style), `components/layout/`

- **`AppShell`** props: `roleLabel`, `navGroups: NavGroup[]`, `user`, `onSignOut`, `pageTitle`, `pageDescription`, `headerActions` (admin passes `<NotificationCenter/>`) and `onViewProfile`. The layout is a 48px title bar (`bg-titlebar`) with the brand and role label, a search box, header actions, the theme toggle and the account menu. Below it sit the nav pane (`bg-nav-surface`) and the content pane.
- **Nav:** `ShellNav` renders a 240px drawer, or a 68px Teams-style rail when collapsed. The collapsed state persists in localStorage under `attendai-shell-collapsed`. Below `lg`, an off-canvas drawer opens instead. Opening it moves focus to its close button and locks body scroll; it closes on Escape, on a backdrop click and on route change. A nav item is `{label, to, icon, activeIcon?, badge?, isNew?, end?}`. Use Fluent `*20Regular` for `icon` and `*20Filled` for `activeIcon`.
- **`ShellCommandPalette`:** **Ctrl+K / ⌘K** (or the title-bar search box) opens a cmdk quick-navigation dialog. It searches the nav items and offers theme toggle and sign-out. It does not search data.
- **`ShellAccountMenu`:** avatar with initials and a presence dot. The menu holds the user's name, email and role, "View profile" (when `onViewProfile` is set) and Sign out.
- **Content:** the scroll container is **`<main id="app-main">`**, not `window`. A skip link targets it, and its `scrollTop` resets on route change. Inside it, `.shell-content` holds a fallback header `.shell-page-header` (built from `pageTitle` and `pageDescription`) and `.shell-page-body` (the page). The CSS rule `.shell-content:has(.shell-page-body h1) > .shell-page-header { display:none }` hides the fallback as soon as the page renders its own `<h1>`. Render one `<h1>` per page, using `text-page-title`, often inside `.page-header`.
- `FullPageLoader` is the full-screen spinner used by the guards. `TermStateBanner` is described in §7.

## 5. Design system (Microsoft Teams / Fluent 2)

The design system has two layers. `src/index.css` defines CSS variables in `:root` (light) and `.dark`. `tailwind.config.ts` maps them to classes. Semantic tokens are **hex** values, and opacity modifiers work through `color-mix` (for example `bg-brand/10`). The shadcn compatibility tokens (`--background`, `--primary`, `--muted`, `--card`, ...) are **HSL triplets** used as `hsl(var(--x))`. Never wrap a semantic token in `hsl()`.

**Rule: no raw Tailwind palette colors** (`bg-blue-500`, `text-gray-600`, `#hex` in class names). Use the semantic classes below so light and dark both work. The codebase currently has none; keep it that way. The static `brand-50` to `brand-900` ramp is not theme-aware, so avoid it for text and surfaces.

| Group | Classes |
|---|---|
| Surfaces | `bg-surface-canvas` (app background), `bg-surface` / `bg-surface-default` (cards, inputs), `-subtle`, `-raised` (popovers), `-hover`, `-pressed`, `-selected`; `bg-titlebar`; `bg-nav-surface`, `bg-nav-hover`, `bg-nav-active`, `text-nav-text` |
| Text | `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-disabled`, `text-text-inverse` |
| Borders | `border-border-subtle`, `border-border-default`, `border-border-strong` (plain `border` uses shadcn `--border`) |
| Brand | `bg-brand` with `hover:bg-brand-hover` and `active:bg-brand-pressed`; `text-brand-on` (text on a brand fill); `text-brand-foreground` (brand-colored text and links, lighter in dark mode) with `hover:text-brand-foreground-hover`; `bg-brand-subtle` and `-subtle-hover`; `border-brand-stroke` |
| Status | `{bg,text,border}-status-{success,warning,error,info}`, `...-{success,warning,error,info}-subtle` (tinted backgrounds), `...-border` |
| Presence | `bg-presence-available`, `-away`, `-busy`, `-offline` |
| Charts | `chart-1` to `chart-8` (also available as `var(--chart-n)`) |
| Legacy shadcn | `bg-primary`, `bg-card`, `bg-muted`, `text-muted-foreground`, `bg-destructive`, `bg-accent`, ... still work. Prefer the semantic classes |

- **Type ramp** (font size, line height and weight together, so do not add `font-semibold`): `text-display` 32/40, `text-title-2` 28/36, `text-page-title` 24/32, `text-section-title` 20/28, `text-subheading` 16/22, `text-body` 14/20 (the body default), `text-body-strong` and `text-label` 14/20 semibold, `text-caption` 12/16, `text-caption-strong`, `text-overline` 10/14. Use `tabular-nums` for numbers in tables.
- **Font:** Segoe UI stack (`font-sans`); `font-mono` is Cascadia Code or Consolas.
- **Elevation:** `shadow-xs` and `shadow-sm` = Fluent 2, `shadow` = 4, `shadow-md` = 8, `shadow-lg` = 16, `shadow-xl` = 28, `shadow-2xl` = 64. Aliases `shadow-fluent-{2,4,8,16,28,64}` exist. All are theme-aware (`--shadow-n`). `.fluent-card` gives a surface-default card with 8px radius and shadow-4.
- **Radii:** `rounded-sm` 2px, `rounded` and `rounded-md` 4px (controls), `rounded-lg` 8px (cards, dialogs), `rounded-xl` 12px, `rounded-2xl` 16px, `rounded-full`.
- **Motion:** `ease-fluent-standard`, `ease-fluent-decelerate`, `ease-fluent-accelerate`, `animate-fade-in-up`, `animate-skeleton`. `prefers-reduced-motion` disables animations globally.
- **Focus:** `:focus-visible` draws a 2px `--text-primary` outline globally. Do not remove outlines.
- **Dark mode:** `ThemeProvider` (`components/ThemeProvider.tsx`; `useTheme()` returns `{theme, resolvedTheme, setTheme}`) stores `light`, `dark` or `system` in localStorage under **`attendai-theme`** and puts the class on `<html>`. Tailwind uses `darkMode: ["class"]`. The inline script in `index.html` applies the same key before React mounts, so the page does not flash. Change both places together. Toggle with `ThemeToggle` or the command palette.
- **`cn()`** (`src/lib/utils.ts`) is `clsx` plus a tailwind-merge built with `extendTailwindMerge`. It registers the custom font-size names and `shadow-fluent-*`. Without that, `cn('text-body', 'text-text-primary')` would treat both as text colors and drop the size. When you add a font size or shadow key in Tailwind, add it there too.

**Primitives (`components/ui/`):**
- `Button` variants: `default` (brand fill), `destructive`, `outline`, `secondary`, `ghost`, `subtle` (transparent with secondary text, the Fluent "subtle" style) and `link`. Sizes: `default` h-8, `sm` h-7, `lg` h-10, `icon` 32px, `icon-sm` 28px. SVGs are 16px by default.
- `Badge` variants: `default` (brand fill), `brand` (subtle brand), `secondary`, `destructive`, `success`, `warning`, `info`, `outline`. Shape: `rounded` (default) or `pill`.
- `Alert` variants: `default`, `destructive`, `success`, `warning`, `info`.
- The rest are standard shadcn APIs: `Card`, `Dialog`, `AlertDialog`, `Sheet`, `Tabs`, `Table`, `Select`, `Command`, `Tooltip`, `Skeleton`, `PasswordInput`, ...
- Toasts: use `useToast()` from `@/hooks/use-toast` (37 files). Sonner is mounted but almost unused.
- `attendance-admin/shared.tsx` provides `RecordStatusBadge`, `SessionStatusBadge`, `MessageBar` (the Fluent inline message bar), `formatTime`, `formatTimeRange`, `formatDateLabel`, `formatDateTime`, `localToday`, `getInitials` and `sourceLabel`.

**Feedback:** `EmptyState({title, description?, icon?, isFiltered?, actionLabel?, onAction?})`, `ErrorState({title?, message?, onRetry?})`, `LoadingState({variant: 'skeleton'|'spinner', rows?, columns?, label?})` and `Spinner`. Every query-driven view should cover loading, error, empty and data.

**Charts (Recharts):** color with CSS variables, never hex. Series use `var(--chart-1..8)`. Grid and axis lines use `var(--border-subtle)`, tick text `var(--text-muted)`, threshold and reference lines `var(--status-error|warning|success)`, and active dot strokes `var(--surface-default)`. Tooltip: `contentStyle={{background:'var(--surface-raised)', border:'1px solid var(--border-subtle)', borderRadius:8, boxShadow:'var(--shadow-16)', color:'var(--text-primary)', fontSize:12}}` (`CHART_TOOLTIP_STYLE` in `IndividualStudentAnalysis.tsx`). `ui/chart.tsx` (`ChartContainer`) already restyles the default Recharts chrome with tokens. `TONE_CSS_VAR` in `metricsDisplay.ts` maps a metric tone to a status variable.

## 6. Data layer

### `api` (`src/integrations/api/client.ts`)
All requests go through `apiRequest(path, init)`, which calls `fetch('/api' + path)` with JSON headers, `Authorization: Bearer <localStorage.authToken>` (unless `skipAuth`) and `credentials: 'include'`. Namespaces:

| Namespace | Purpose (main methods) |
|---|---|
| `auth` | `login`, `getUser` (`/auth/me`), `refreshToken`, `logout` |
| `students`, `teachers`, `faculties`, `subjects`, `classes` | CRUD. `teachers.*Assignment`, `getUnassignedSchedules`; `faculties.getCascadePreview` |
| `schedules` | `getStudentToday()` and **`getStudentTodayContext()`** (`/schedules/student/today?envelope=true`, which returns `{classes, term_state, day_status, date}`), plus timetable CRUD and `toggle` |
| `sessions` | Contract v1 `/attendance/sessions*`: `list(filters)`, `getRegister(id)`, `submitRegister(id, {entries, reason?, confirm_held?, mark_remaining_absent?})`, `cancel` and `uncancel(id, reason)`, `clearReview`, `createMakeup`, `listUnrecorded({from,to,limit,offset})` |
| `records` | `setMetricsExclusion(recordId, excluded, reason)`, `getAudit(recordId)` |
| `attendance` | `recordSingle` (admin `POST /attendance`), `getStudentCalendar`, `getMyCalendar`, `getStudentSubjectBreakdown`, plus older list and summary calls |
| `teacher` | Teacher portal: `getDashboard`, `getSchedule`, `getSubjectStudentsWithAttendance` (roster with `can_edit`, `edit_block_reason`, `session`), `bulkMarkAttendance` (`/teacher/attendance/bulk-mark`, takes the same `confirm_held` and `mark_remaining_absent` options), `cancelClass` and `uncancelClass`, and notifications (`getInbox`, `markRead`, `sendNotification`, ...) |
| `studentAttendance` | Logged-in student's `/student-attendance/{summary,subject-breakdown,analytics,goals}` |
| `faceRecognition` | `getPolicy`, `createChallenge({purpose})`, `markAttendance(frames, {subjectId?, sessionId?, scheduleId?, challengeId?, presenceCode?})` (returns a `FaceCheckinResult` with `code`, `quality_issues`, `retry_after_seconds`), `getEnrollment`, `enroll(images, {consent, challengeId})`, `deleteMyFace`; legacy `verifyIdentity`, `registerFace*`, `verifyFace`, `detectFaces` |
| face (staff) | `sessions.getPresenceCode`, `sessions.getFaceAttempts`, `students.getFace`, `students.resetFace`, `systemSettings.getFacePolicy` / `updateFacePolicy` |
| `semesterConfig` | Typed terms API (`/admin/semester-config/`): `list`, `getCurrent`, `create`, `update`, `deactivate`. `semesterConfiguration` is the older untyped twin |
| `attendancePolicy` | `get({force?})` reads `/system-settings/attendance-policy`, keeps a 5-minute in-module cache and deduplicates in-flight requests. `invalidate()` clears the cache |
| `autoAbsent` | `status`, `trigger`, `runs(limit)` (the finalizer) |
| `analytics`, `dashboard`, `academicMetrics`, `streaks`, `systemSettings`, `attendanceAdmin` | Older or auxiliary endpoints (thresholds, insights, streaks and badges, calendar metrics) |

`apiClient.get|post|put|delete(path, body?)` returns `{data}` (an axios-like shape over `apiRequest`). It is used by analytics, password reset and calendar settings. For new code, add a typed method to `api` instead.

**Error behaviour:** for any non-2xx response, `apiRequest` throws an `Error` whose `message` is a readable string taken from `detail` (string, `{message}`, `{code}` or a FastAPI validation array; never `[object Object]`). The error carries `.status` and `.response = {status, data}`. On a 401 or 403 it tries `refreshToken()` once and retries. If that fails, a 401 clears `authToken`. A 204 or empty body resolves to `undefined`.
- `parseApiError(err)` returns `{status, code, message, detail, data, errors}`. `code` is the structured code (`invalid_entries`, `confirm_held`, `session_cancelled`, ...). `errors` holds the per-row `{student_id, code, message}` entries.
- `getErrorDetailField(info, key)` looks in `detail.key`, then `detail.details.key`, then `body.key` (for example `students_without_record`, `term_state`).
- `attendance-admin/errors.ts` adds `errorField`, `entryErrors`, `isEntryValidationError` and `legacyFailure(body)`. The last one normalizes older HTTP-200 `{success:false, code}` bodies.

### TanStack Query
- The QueryClient in `App.tsx` uses `staleTime` 5 minutes, `retry` up to 2 (never on auth errors), and no refetch on window focus or reconnect. Override these per query when you need live data.
- Keys are kebab-case arrays: the resource first, then its params. Examples: `['students']`, `['faculties']`, `['subjects', facultyId]`, `['session-register', sessionId]`, `['class-sessions']`, `['unrecorded-sessions', params]`, `['auto-absent-status']`, `['teacher-dashboard']`, `['teacher-subject-attendance', subject, semester, date, sessionId]`, `['attendance-policy']` (`ATTENDANCE_POLICY_QUERY_KEY`), `['student-today-schedule']` (`STUDENT_TODAY_QUERY_KEY`, shared by the dashboard, the schedule card and the check-in hook), face keys `['presence-code', id]`, `['face-attempts', id]`, `['student-face', id]`, `['face-policy']` and the student policy/enrolment keys in `components/face/faceQueries.ts`.
- After a write, invalidate every view that shows the data. Example: after a register save, `SessionRegister` invalidates `session-register`, `class-sessions`, `unrecorded-sessions` and `auto-absent-status`. After term edits, invalidate `['attendance-policy']` **and** call `api.attendancePolicy.invalidate()`, because the module cache otherwise keeps serving the old policy for 5 minutes.

### Policy and metric display
- `hooks/useAttendancePolicy.ts` provides `useAttendancePolicy()`, a `useQuery<AttendancePolicy>` with `{minimum_percentage, bands (best first, half-open [min,max)), checkin_* minutes, teacher_edit_window_days, weekly_off_days, term_state, current_term}`. `data` is undefined while loading, so render neutral tones until it arrives.
- `components/attendance-admin/metrics.ts` has an admin wrapper, also named `useAttendancePolicy()`, that returns `{policy, minimum, bands, isLoading, isFallback}` and falls back to `FALLBACK_POLICY_BANDS` (90/85/75). It also provides `resolvePercentage`, `resolveBand` (to `{label, tone}`), `toneClasses`, `describeEligibility` and a `formatPercent` that keeps `82.0%`.
- `utils/metricsDisplay.ts`, used by student and teacher screens:
  - `readMetrics(raw)` returns `DisplayMetrics` with `percentage: number|null` and `hasData`. Legacy payloads that report 0 with a zero denominator become `null`.
  - `formatPercent(pct)` returns `"86.5%"`, trims `.0`, and returns **`"—"`** for null or NaN.
  - `barWidth`, `metricTone`, `percentTone`, `meetsMinimum` (prefers the server's `eligible`).
  - Tone maps `TONE_TEXT`, `TONE_FILL`, `TONE_CSS_VAR`, `TONE_BADGE`.
  - **`localDateString(d)`** returns the local `YYYY-MM-DD` and **`parseLocalDate(s)`** parses one. Never use `toISOString()` for a local date: it is UTC, and in Asia/Kathmandu (UTC+5:45) it gives the wrong day before 05:45. `attendance-admin/shared.tsx` `localToday()` and `utils/dateUtils.ts` do the same thing.

## 7. Attendance UX rules (the server is authoritative)

1. **Never compute percentages, bands, eligibility or windows on the client.** Read `percentage`, `has_data`, `band`, `eligible` and `eligibility_provisional` from the server. A percentage can be `null`; render it as **"—"** or "No classes yet", never as `0%` or "critical".
2. **The check-in window comes from the server.** `useTimeRestrictions()` (hooks) calls `api.schedules.getStudentTodayContext()`, polling every 30 seconds and on focus. `evaluateCheckin()` (`utils/timeRestrictions.ts`) then reads `checkin_allowed`, `checkin_window.state` (`not_open`, `open` or `closed`), `my_status`, `is_cancelled`, `term_state` and `day_status`. The client clock only drives the countdown text.
3. **Fail closed.** While loading, after a failed request, with an empty schedule, between terms, with no terms, or on a non-instructional day (holiday, weekly off, exam), check-in is **closed** and the UI says why. The `dev_override_all_restrictions` localStorage flag (`DevelopmentToggle`) is a UI preview only. It never opens check-in.
4. **Face check-in** (`FaceRecognition`, rules in [face-verification.md](face-verification.md)): load the policy, get a `checkin` challenge, guide "look at the camera" then "turn your head left/right" (mirrored preview, unmirrored frames), then **one** `markAttendance` call with the frames, `challengeId`, `presenceCode` (from `?code=` or the 6-digit field) and `subjectId`/`sessionId`/`scheduleId`. The server picks the session and decides present or late. Every `CheckinRejectionCode` may arrive as HTTP 200 `{success:false, code}`; map it through `checkinRejectionMessage()`, show `quality_issues` as hints and a countdown for `too_many_attempts`. Never show similarity scores. After a check-in, invalidate `STUDENT_TODAY_QUERY_KEY` and the summary and streak queries.
5. **Unmarked means "Not marked"**, which is `status: null`. Never pre-fill or default a student to absent. An absent write for the rest of the class is an explicit `mark_remaining_absent: true` option.
6. **Registers send only changed rows** (`entries` that differ from the loaded status), with an optional batch `reason`. This applies to `sessions.submitRegister` and `teacher.bulkMarkAttendance`. Then handle the errors:
   - **400 `invalid_entries`** (or `validation_failed`): nothing was written. Highlight each row from `errors[].student_id` and show the general message.
   - **409 `confirm_held`**: the session ended and nobody recorded it. Open `ConfirmHeldDialog` (shows `students_without_record`). On confirm, resubmit with `confirm_held: true`.
   - **409 `session_cancelled`**: show "restore it first" and refetch. Cancel and restore require a reason (`SessionStatusDialog` for admins, `SessionCancelDialog` for teachers).
7. **Teacher edit rights:** respect `can_edit` and `edit_block_reason` from the roster response (`no_session`, `session_cancelled`, `session_not_started`, `edit_window_closed`). Show a read-only banner rather than letting the request fail.
8. **Unrecorded sessions are resolved explicitly**, either as Held (submit the register) or Not held (cancel with a reason). They never turn into absences on their own (`UnrecordedSessionsPanel`).
9. **Between terms:** render `TermStateBanner`. `components/layout/TermStateBanner.tsx` is the real implementation: it reads `term_state` from props or the policy, renders nothing while `active`, and takes `audience` (`admin` or `member`), `reportingTerm`, `showSetupLink` and `context`. `components/TermStateBanner.tsx` is a member-audience wrapper (`termState`, `term`) for student and teacher pages. Base term state on the server's `term_state` only, never on the client date.
10. Admin record tools: `MetricsExclusionDialog` (exclude from metrics, reason required, the record is kept) and `RecordAuditDialog` (audit trail). Attendance history is never deleted from the UI.

## 8. Key screens

**Public site (`/`, `/about`, `/login`, ...)**
- `components/Navbar.tsx` and `components/Footer.tsx` are shared by every public page. Navbar section links (`/#product`, `/#how-it-works`, `/#trust`) work from any page because `HomePage` scrolls to `location.hash` itself (react-router doesn't). `Footer` takes optional `credits` (photo attribution).
- `pages/HomePage.tsx` assembles the landing sections from `components/landing/`: `Hero` (h1, classroom photo plus a composed check-in panel), `PortalShowcase` (`#product`, ARIA tabs over real screenshots), `SessionTimeline` (`#how-it-works`, the life of one class session), `EditorialBand`, `CapabilityRows` (calendar, register, audit trail), `Principles` (`#trust`) and `ClosingCta`.
- `pages/AboutPage.tsx` uses the same primitives: hero (`teacherFront`), story, design goals, team (photos in `public/team/`), how it's built, and the shared `ClosingCta`. It states only true things: AttendAI began as a final-year project; no usage figures or founding claims.
- **Copy must stay true to the rules.** Only state policy defaults (check-in window 10/10/20 minutes, 15-minute grace, 7-day teacher edit window, 75% minimum, 30-second classroom code) and label them as defaults. Composed previews (hero check-in panel, calendar, audit log) are captioned as illustrative. No testimonials, customer names, statistics or certifications.
- Marketing type uses the `lp-display`, `lp-h2`, `lp-h3`, `lp-lede`, `lp-body` and `lp-eyebrow` classes from `landing.css` (scoped; the app's type ramp is unchanged). Colours still come only from the semantic tokens.
- `ScreenFrame` renders the light or dark screenshot to match the theme. Re-capture `assets/landing/screens/` when the portals change visibly, with personal data anonymised.

**Admin (`/app`, inside `DashboardLayout`)**
- Dashboard: `pages/Dashboard.tsx`. KPI cards and a pie chart. Today's counts, percentage and band come from `/analytics/dashboard-summary` (read with `readMetrics`/`metricTone`), and the scheduler card from `/auto-absent/status`; the page computes no percentages. Recent activity lists the first page of today's records.
- Students: `pages/StudentsPage.tsx`. CRUD with `StudentForm*`, a Face column (status badge, face-status filter, "N without a registered face") and the "Face registration…" action (`StudentFaceDialog`: history and reset with a reason). Per-student calendar at `pages/StudentAttendanceCalendar.tsx`.
- Teachers: `pages/TeachersPage.tsx`. CRUD plus schedule assignments (`teachers.addAssignment`, `getUnassignedSchedules`).
- Faculties: `pages/FacultiesPage.tsx`. Faculties and subjects, with a cascade-delete preview.
- Schedules: `components/ScheduleManagement.tsx`. Weekly timetable CRUD and toggle.
- Academic Calendar: `pages/AcademicCalendar.tsx` (react-big-calendar, very large). Uses direct `fetch` to `http://localhost:8000` and `CalendarGeneratorControl`.
- Attendance: `pages/AttendancePage.tsx`, which shows `TermStateBanner` and three tabs:
  - Admin workflow: `components/attendance/EnhancedAttendanceManagement.tsx`. "By subject" opens `DateSessionRegister`, which resolves the sessions on a date and then shows `SessionRegister`. "By student" opens `StudentDayAttendance`, which writes one `recordSingle` per changed session.
  - Daily report: `AttendanceTable` driven by `useAttendanceData`.
  - Individual analysis: `IndividualStudentAnalysis`.
- Session register: `components/attendance-admin/SessionRegister.tsx`. Search, per-row status, reason, mark-remaining-absent, cancel and restore, audit and exclusion menus.
- Unrecorded sessions: `components/attendance-admin/UnrecordedSessionsPanel.tsx`, shown on the Auto-Absent page.
- Semester Setup: `pages/SemesterConfigurationPage.tsx`. Tab "terms" (`api.semesterConfig`, lifecycle state comes from the server) and tab "legacy" (embeds `AcademicCalendarSettings`). Invalidates the policy after changes.
- Auto-Absent: `pages/AutoAbsentManagementPage.tsx`. Finalizer status, manual trigger, run history and `UnrecordedSessionsPanel`.
- Analytics: `pages/AnalyticsPage.tsx` wraps `components/AdvancedAnalyticsDashboard.tsx` (`apiClient` calls to `/analytics/*`).
- Settings: `pages/SettingsPage.tsx` (tabs general, system, notifications, reports, account, and **Face verification** with `FacePolicySettingsCard`) and `pages/AttendanceThresholdSettings.tsx` (policy bands and thresholds).
- Also: `LiveMonitoringPage`, `AdminNotificationsPage` (`AdminNotificationCreator`), `AdminGenerateResetLinkPage`.

**Teacher (each page wraps itself in `TeacherSidebar`)**
- `pages/TeacherDashboard.tsx`: today's classes, session cancel and restore (`SessionCancelDialog`), member `TermStateBanner`.
- `pages/TeacherAttendancePage.tsx` (and the admin `SessionRegister`): "Show check-in code" (`PresenceCodeDialog`, today's non-cancelled sessions) and a collapsible "Face check-in attempts" panel. Subject, date and session picker, then the roster (`teacher.getSubjectStudentsWithAttendance`) and a changed-rows submit through `teacher.bulkMarkAttendance`. Handles `invalid_entries`, `confirm_held` (inline dialog) and `session_cancelled`, and respects `can_edit`.
- `pages/TeacherSchedulePage.tsx` (weekly timetable), `pages/TeacherNotificationsPage.tsx` (inbox and send), `TeacherSubjectStudents`, `TeacherSubjectAnalytics`, `TeacherProfilePage`.

**Student (each page wraps itself in `StudentSidebar`)**
- `pages/StudentDashboard.tsx`: summary (`studentAttendance.getSummary`), `TermStateBanner`, a prompt to register a face, and **`components/TodayClassSchedule.tsx`**. The schedule card shows each class's window state, and check-in opens `FaceRecognition` inline.
- `components/FaceRecognition.tsx`: guided check-in (presence code, liveness challenge, head-turn burst via `components/face/`), MediaPipe Tasks face detector for framing (falls back to timed prompts if it can't load), one `markAttendance` call.
- `pages/StudentMarkAttendancePage.tsx`: standalone check-in page and QR target (`?session`, `?code`); resolves the class from the server's schedule and fails closed. `LoginPage` returns students to it (with the query string) after login.
- `pages/StudentAttendancePage.tsx`: attendance calendar (`StudentAttendanceCalendar`, using `attendance.getMyCalendar`) and streaks.
- `pages/StudentCalendar.tsx` (the academic calendar, read-only), `StudentNotificationsPage`, `ProfilePage`, `StudentFaceRegistrationPage` (reads `getEnrollment()`: enrolled → date + "Delete my face data"; deleted → locked until an admin resets; none/reset → `FaceRegistration`: consent, enrolment challenge, guided front/left/right capture, **all** images in one `enroll` call).

## 9. Gotchas

- **The `ignoreDeprecations` line** in `tsconfig.app.json` silently disables type checking (§1). Check for it before trusting a clean `tsc`.
- **Two `useAttendancePolicy` hooks** exist: `hooks/useAttendancePolicy` (the raw query) and `attendance-admin/metrics` (a view with fallbacks). There are also **two `formatPercent` functions** (`metricsDisplay` trims `.0`; `metrics.ts` does not) and **two `TermStateBanner` components** (layout implementation and member wrapper). Import the one you mean.
- **`text-primary` is brand-colored text**, not body text: `textColor.primary` is remapped to `--brand-foreground`. Use `text-text-primary` for normal text. `bg-primary` is still the brand fill.
- **Scrolling happens in `#app-main`**, so `window.scrollTo` does nothing inside the shell.
- **The fallback page title is hidden only when the page body contains an `<h1>`.** A page with no `<h1>` shows the shell title. A page with an `<h1>` inside a dialog that is mounted but closed also hides it.
- **The policy cache lives in two layers** (the module TTL cache and the React Query key). After any settings, threshold or term change, call `api.attendancePolicy.invalidate()` **and** invalidate `['attendance-policy']`, as `AttendanceThresholdSettings` does.
- **`toISOString()` is still used for dates** in older analytics files (`Dashboard`, `AdvancedAnalytics*`, `AttendanceCalendar`, `PDFExportCard`, `LiveMonitoring`, `StudentPersonalAnalytics`, `IndividualStudentAnalysis`). Do not copy it; use `localDateString`.
- **Older response shapes persist.** Many endpoints still return older fields (`percentage_present`, `attendance_rate`, `no_data`, `system_inactive`) that read as 0 when there is no data. Always read them through `readMetrics` or `resolvePercentage`, never raw.
- **Unused code is still in the tree:** demo and test routes, unrouted pages, and many top-level analytics components (`Merged*`, `Unified*`, `RealTime*`, `SmartNotificationSystem`, ...). Check `App.tsx` and the importers before editing a component you think is live.
- **The ESLint config turns `no-unused-vars` off**, so unused imports do not fail lint. Remove them yourself.
- **Recharts and react-big-calendar** need token overrides (`ui/chart.tsx`, `styles/calendar.css`). Default library colors do not follow dark mode.
- **MediaPipe** assets are served from `public/mediapipe/` (no CDN). After upgrading `@mediapipe/tasks-vision`, re-copy `node_modules/@mediapipe/tasks-vision/wasm/*` into `public/mediapipe/tasks/`, or the runtime and the JS will mismatch.
- **Camera needs a secure context.** `getUserMedia` works on `localhost` and https only, so testing check-in from a phone over the LAN needs https or a tunnel. The UI explains the error.
- **Head-turn guidance thresholds** in the browser (`GUIDE` in `services/mediaPipeService.ts`) are rough; the server decides with its own detector and the policy values.
