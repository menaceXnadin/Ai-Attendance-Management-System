# Frontend Professional Revamp — Audit and Implementation Plan

**Project:** AttendAI college/attendance management system  
**Branch:** `feat/frontend-professional-revamp`  
**Status:** Audit complete; design system proposal awaiting approval  
**Scope:** Visual and UX refactor only. Business logic, API contracts, query behavior, authentication, routing, and data handling are out of scope unless a minimal change is required to preserve existing behavior during component extraction.

> **Approval gate:** Do not begin the system-wide implementation until the typography, color palette, icon set, density, radii, and shadow tokens in this document are approved.

## 1. Repository audit

### 1.1 Skill availability

The requested **“impeccable”** skill is not installed or exposed in this environment. It therefore cannot be applied directly. This plan uses the requested standards as the governing design rubric and adds explicit checks modeled on mature internal-product systems: restrained color, high information density, predictable navigation, real tables, visible state handling, keyboard focus, reduced motion, and WCAG contrast validation.

### 1.2 Actual frontend stack

| Area | Current implementation |
|---|---|
| Framework | React 18.3 + TypeScript |
| Build tool | Vite 5 with `@vitejs/plugin-react-swc` |
| Routing | React Router 6 |
| Styling | Tailwind CSS 3.4, PostCSS, global CSS, component utility strings, and inline styles |
| Primitive components | shadcn-style local components built on Radix UI |
| Variant composition | `class-variance-authority`, `clsx`, `tailwind-merge` |
| Server state | TanStack React Query 5 |
| Forms/validation | React Hook Form, Zod, Hookform resolvers |
| Charts | Recharts |
| Calendars | React Big Calendar, React Day Picker, Moment, Date-fns |
| Theme | Custom provider forcibly applies dark mode; light mode is currently disabled |
| Notifications | Radix toast wrapper plus Sonner |
| Icons | `lucide-react` only; used throughout application and primitive layers |
| Tests | No frontend test runner or frontend test script is configured |

Relevant configuration and entry points:

- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/postcss.config.js`
- `frontend/tailwind.config.ts`
- `frontend/tailwind.config.js`
- `frontend/components.json`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `frontend/src/App.css`

### 1.3 Component and route structure

The frontend contains **182 TSX files**, including:

- 57 files under `src/pages`
- 120 files under `src/components`
- 50 local primitives under `src/components/ui`
- 7 attendance-focused components
- 6 dashboard widgets
- 6 student-focused components
- 11 hooks and 5 service modules

The application has three authenticated product shells plus public pages:

1. **Admin:** nested `/app/*` routes wrapped by `DashboardLayout` and `DashboardSidebar`.
2. **Teacher:** standalone `/teacher/*` pages, each responsible for its own `TeacherSidebar` shell.
3. **Student:** standalone `/student/*` pages, each responsible for its own `StudentSidebar` shell.
4. **Public/support:** home, about, blog, authentication, password recovery, status, and multiple development/demo routes.

The admin shell uses the local Radix/shadcn sidebar primitive. Teacher and student shells independently reimplement navigation, header, user area, responsive behavior, colors, and spacing. These should be unified behind a shared `AppShell` configuration while preserving each role’s route set and permissions.

### 1.4 Duplicate and inactive source variants

The following variants create ambiguity and must be classified before visual migration. Active route imports must be confirmed before any deletion or consolidation:

- `pages/Dashboard.tsx.backup`
- `pages/AcademicCalendar_backup.tsx`
- `pages/AcademicCalendar_clean.tsx`
- `pages/AcademicCalendar_complete.tsx`
- `pages/AcademicCalendar_fixed.tsx`
- `components/FaceRecognition.tsx.broken`
- `components/FaceRegistration_clean.tsx`
- `hooks/useRealFaceDetection2.ts.disabled`
- `services/mediaPipeService.ts.disabled`

There are also similarly named active components in different folders, including `StudentProfile` and `AttendanceCalendar`. The redesign must follow the import graph rather than filenames alone.

## 2. Existing style-source inventory

### 2.1 Where tokens and styling currently live

| Source | What it currently controls | Audit finding |
|---|---|---|
| `tailwind.config.ts` | CSS-variable colors, teal `brand` scale, radius aliases, sidebar colors, animations | Intended shadcn configuration, but includes blob, pulse, fade, and 3D utilities that are unsuitable as global product defaults. |
| `tailwind.config.js` | Shimmer animation only | Competes with the TypeScript config. The active config must be verified and the duplicate removed after approval. |
| `src/index.css` | Light/dark variables, base styles, selection rules, gradients, scrollbars, global transitions, glows, table animation, sidebar animation, input motion | 748 lines; contains broad selectors that affect unrelated screens and encode much of the “AI-generated” look. |
| `src/styles/calendar-dark.css` | Calendar colors, typography, shadows, gradients, hover states | 398 lines and heavily hardcoded, isolated from the nominal theme. |
| `src/App.css` | Vite starter root, logo, card, animation styles | Appears to be leftover starter CSS; it is not imported by `main.tsx` or `App.tsx`, but should be formally retired after import verification. |
| `src/components/ui/*` | Primitive sizing, color, radius, focus, overlay, table and form styles | Some primitives use semantic tokens; others hardcode slate/hex colors and special effects. |
| Page/component `className` strings | Most real page colors, spacing, type sizes, gradients, radii, and shadows | Dominant styling source; frequently bypasses theme variables. |
| JSX `style={{...}}` | Positioning, third-party integration overrides, filters, colors, and fallback UI | Present in 34 TSX files. Some values are legitimately dynamic, but visual constants must become tokens/classes. |
| Generated print/export HTML | PDF and print font/color styles | Arial and hardcoded report colors appear outside normal React styling. |

### 2.2 Quantified hardcoding and consistency risk

Read-only source scans found:

| Pattern | Coverage |
|---|---:|
| Files importing Lucide | 112 |
| Files with direct Tailwind palette colors | 112 |
| Files with gradients | 75 |
| Files with shadows/glows | 71 |
| TSX files with inline style objects | 34 |
| TSX/CSS files with hex colors | 19 |
| Files with radius utilities | 129 |
| TSX files containing `aria-label` | 8 |
| Query/table data-view files | 37 |

This means replacing only `:root` variables would not materially redesign the product. The migration must first repair primitives and shells, then systematically replace component-level palette and effect utilities.

### 2.3 Highest-risk hardcoded style locations

Direct hex colors occur in the following active or audit-relevant locations:

- `src/main.tsx`
- `src/App.css`
- `src/styles/calendar-dark.css`
- `src/components/AdminAttendanceWorkflow.tsx`
- `src/components/AttendanceChart.tsx`
- `src/components/FaceRecognition.tsx`
- `src/components/LiveFaceDetection.tsx`
- `src/components/MergedAnalytics.tsx`
- `src/components/ProfileDropdown.tsx`
- `src/components/attendance/IndividualStudentAnalysis.tsx`
- `src/components/dashboard/PDFExportCard.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/password-input.tsx`
- `src/pages/AcademicCalendar.tsx`
- `src/pages/AcademicCalendar_backup.tsx`
- `src/pages/AcademicCalendar_clean.tsx`
- `src/pages/FaceRegistrationDebugPage.tsx`
- `src/pages/TeacherAttendancePage.tsx`
- `src/hooks/useRealFaceDetection.ts` (non-UI drawing color constants)

Inline JSX style objects occur in:

- `src/main.tsx`
- `src/components/AttendanceAnalytics.tsx`
- `src/components/AttendanceChart.tsx`
- `src/components/DashboardSidebar.tsx`
- `src/components/FaceRecognition.tsx`
- `src/components/FaceRegistration.tsx`
- `src/components/Footer.tsx`
- `src/components/LiveFaceDetection.tsx`
- `src/components/MergedAnalytics.tsx`
- `src/components/Navbar.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/RealTimeStats.tsx`
- `src/components/RoleRedirect.tsx`
- `src/components/StudentFormEnhanced.tsx`
- `src/components/StudentSidebar.tsx`
- `src/components/TeacherSidebar.tsx`
- `src/components/attendance/IndividualStudentAnalysis.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/password-input.tsx`
- `src/components/ui/progress.tsx`
- `src/pages/AcademicCalendar.tsx`
- `src/pages/AcademicCalendar_backup.tsx`
- `src/pages/AcademicCalendar_clean.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/FaceRegistrationDebugPage.tsx`
- `src/pages/FacultiesPage.tsx`
- `src/pages/ForgotPasswordPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/ResetPasswordPage.tsx`
- `src/pages/SemesterConfigurationPage.tsx`
- `src/pages/StudentAttendanceCalendar.tsx`
- `src/pages/StudentDashboard.tsx`
- `src/pages/StudentFaceRegistrationPage.tsx`
- `src/pages/TeacherDashboard.tsx`

Spacing, radii, shadows, and named Tailwind palette colors are embedded across nearly every page and feature component. The biggest concentrations are:

- `AcademicCalendar.tsx`
- `AdvancedAnalyticsDashboard.tsx`
- `SettingsPage.tsx`
- `ScheduleManagement.tsx`
- `FacultiesPage.tsx`
- `TeachersPage.tsx`
- `StudentFormEnhanced.tsx`
- `StudentsPage.tsx`
- `TeacherDashboard.tsx`
- `EnhancedAttendanceManagement.tsx`
- `StudentAttendanceCalendar.tsx`
- `IndividualStudentAnalysis.tsx`
- `TeacherAttendancePage.tsx`
- `StudentProfile.tsx`
- `HomePage.tsx`
- `StudentDashboard.tsx`

The implementation sweep must include all `src/pages/**/*.tsx`, `src/components/**/*.tsx`, `src/index.css`, and `src/styles/calendar-dark.css`, with exclusions only for dynamic geometry and non-DOM drawing colors that cannot use CSS tokens.

### 2.4 Current fonts

No web font is loaded and no `fontFamily` is configured in Tailwind. Normal UI text therefore uses Tailwind Preflight’s default `ui-sans-serif/system-ui` stack. Additional one-off families are:

- Arial in the root error fallback (`src/main.tsx`)
- Arial in generated print/export HTML (`IndividualStudentAnalysis.tsx`, `PDFExportCard.tsx`)
- System stack with Segoe UI/Roboto in `calendar-dark.css`
- Arial and monospace in `FaceRegistrationDebugPage.tsx`

There is no deliberate application-wide type hierarchy.

### 2.5 Current icons

`lucide-react` is the only installed/imported icon library. It is used in both product features and 20+ local UI primitives, including dialogs, menus, selects, pagination, calendar navigation, checkboxes, radio groups, sheets, toasts, and sidebar controls. There are 112 importing source files, so replacement must be handled as a coordinated dependency migration rather than piecemeal page edits.

No other icon package is present. Any inline SVG or camera/canvas drawing should be audited separately and retained only where it is functional visualization rather than a UI icon.

### 2.6 Current AI-slop indicators found in code

- Dark blue/indigo full-page gradients in all three role shells.
- Gradient navigation selections and gradient avatars.
- Backdrop blur used on persistent shell chrome and table headers.
- Glow shadows on navigation, avatars, logos, badges, scrollbars, buttons, and loading icons.
- Global hover transforms on cards, buttons, icons, inputs, and table rows.
- Staggered entrance animation applied globally to the first ten rows of every table.
- Pulse, shimmer, blob, spin-glow, bounce, and sidebar shimmer effects.
- Large concentrations of `rounded-xl`, `rounded-2xl`, and `rounded-full` without component semantics.
- Direct slate/blue/indigo/teal/purple/pink utility colors bypassing tokens.
- Multiple dashboard cards used where dense tables or compact lists are more appropriate.
- Separate role shells with inconsistent responsive behavior and duplicated visual rules.

## 3. Existing state, responsive, and accessibility audit

### 3.1 Data states

The codebase has individual loading/error/empty implementations, plus `Skeleton` and `ApiErrorBoundary`, but there is no shared state contract. The 37 files containing a query or table do not consistently expose all four states:

1. loading/skeleton;
2. populated;
3. empty/no results;
4. error/retry.

Current problems include spinner-only loading, errors surfaced only as toasts, empty conditions expressed as ad hoc text, and table bodies whose state layout differs by module. The redesign will introduce reusable table/list state primitives and require a state matrix for every data view.

### 3.2 Responsive behavior

- Student shell has a mobile drawer/overlay pattern.
- Teacher shell is fixed-width with desktop padding and lacks an equivalent mobile navigation flow.
- Admin uses a Radix-style sidebar and desktop resize handle; mobile behavior depends on the primitive implementation and is not aligned with the student shell.
- Many screens use responsive Tailwind modifiers, but wide calendars, analytics, forms, and tables need explicit overflow, column-priority, and stacked-action rules.
- The plan targets 360 px mobile, 768 px tablet, 1024/1280 px desktop, and 1440 px wide desktop.

### 3.3 Accessibility

- Focus styles exist in some primitives but are inconsistent and sometimes replaced by hover-only effects.
- Only 8 TSX files contain an explicit `aria-label`; many icon-only buttons rely on `title` or tooltip text.
- Status is frequently encoded primarily through color.
- Global animation does not consistently respect `prefers-reduced-motion`.
- Global `user-select` rules and broad `button`/`svg` selectors create unpredictable behavior.
- Table sorting semantics, `aria-sort`, form error association, modal descriptions, and keyboard access require a component-level pass.

## 4. Baseline verification before redesign

The baseline was run before UI edits:

- `npm run build` — **fails before redesign** because `src/pages/AcademicCalendarSettings.tsx` imports `axios`, which is not declared/resolved.
- `npm run lint` — **fails before redesign** with 50 errors and 10 warnings. Most errors are existing `no-explicit-any` violations; warnings include hook dependency and Fast Refresh issues.
- No frontend unit, component, integration, or end-to-end test command is configured.
- Existing unrelated working-tree changes were present in `backend/app/core/database.py`, `backend/app/main.py`, and `backend/models/silent_face/`. They must not be modified or included in frontend commits.

The implementation should record this baseline in the first revamp commit and avoid increasing the error count. The missing `axios` dependency is a pre-existing build blocker; fixing it requires separate approval because it is not inherently a visual change.

## 5. Proposed design system — approval required

### 5.1 Product direction

Use a **light-first, neutral enterprise application shell** with an optional fully tokenized dark theme. Navigation is persistent on desktop and becomes an accessible drawer on smaller screens. Surfaces are flat, borders carry most separation, shadows are reserved for overlays, and color is used for actions and meaning rather than decoration.

The information-density target is closer to Linear/Stripe/Carbon than to a marketing dashboard:

- compact page headers;
- 32–40 px controls;
- 44 px default table rows;
- real tables with sticky headers, sorting, filtering, pagination, selection, and overflow behavior;
- limited card usage for summaries and bounded modules, not as a substitute for tabular data;
- minimal motion, no glow, no glass shell, and no decorative gradients in authenticated product screens.

### 5.2 Typography

**Proposed family:** **IBM Plex Sans**, self-hosted through local font assets or a pinned font package. It is neutral, highly legible at dense sizes, supports an institutional/enterprise tone, and includes clear numeric forms. Use one UI family consistently; the “heading/body pairing” is created through a disciplined type scale and weight contrast rather than mixing unrelated display fonts.

**Optional technical companion:** IBM Plex Mono only for debug output, tokens, IDs, or machine-readable values—not normal table/body text.

| Token | Size / line height | Weight | Use |
|---|---:|---:|---|
| `type-display` | 32 / 40 | 600 | Public-page display only |
| `type-page-title` | 24 / 32 | 600 | Product page title |
| `type-section-title` | 18 / 24 | 600 | Major section/card heading |
| `type-subheading` | 16 / 24 | 600 | Subsection and modal title |
| `type-body` | 14 / 20 | 400 | Default product body |
| `type-body-strong` | 14 / 20 | 500 | Emphasis and controls |
| `type-label` | 13 / 16 | 500 | Field and table labels |
| `type-caption` | 12 / 16 | 400 | Supporting metadata |
| `type-overline` | 11 / 16 | 600 | Rare group labels; no excessive tracking |

Use `font-variant-numeric: tabular-nums` for attendance percentages, dates, times, counts, and analytics. Maximum routine weight is 600; reserve 700 for rare public marketing emphasis.

### 5.3 Icon system

**Proposed replacement:** `@carbon/icons-react`.

Rules:

- One icon package across primitives and product modules.
- Default size 16 px inside controls, 20 px for standalone actions/navigation, 24 px only for state illustrations.
- Use the Carbon-provided visual weight consistently; do not mix outline styles from other packages.
- Every icon-only control gets an accessible name (`aria-label`) and tooltip where discovery benefits.
- Decorative icons use `aria-hidden="true"`.
- Status always includes text and/or shape, not color or icon alone.
- Keep the product logo image separate from the UI icon system.

### 5.4 Core color tokens

The values below avoid Tailwind defaults and use cool neutrals with one restrained blue action color. Semantic colors are dark enough for readable text and are paired with low-chroma backgrounds.

#### Light theme

| Role | Token | Value |
|---|---|---:|
| Canvas | `--surface-canvas` | `#F6F7F9` |
| Surface | `--surface-default` | `#FFFFFF` |
| Subtle surface | `--surface-subtle` | `#EFF1F4` |
| Raised surface | `--surface-raised` | `#FFFFFF` |
| Border subtle | `--border-subtle` | `#E5E8ED` |
| Border default | `--border-default` | `#D9DEE7` |
| Border strong | `--border-strong` | `#B8C0CC` |
| Text primary | `--text-primary` | `#17202B` |
| Text secondary | `--text-secondary` | `#4E5968` |
| Text muted | `--text-muted` | `#727E8E` |
| Text inverse | `--text-inverse` | `#FFFFFF` |
| Primary | `--action-primary` | `#0B57D0` |
| Primary hover | `--action-primary-hover` | `#0842A0` |
| Primary subtle | `--action-primary-subtle` | `#EAF2FF` |
| Secondary action | `--action-secondary` | `#FFFFFF` + default border |
| Sidebar | `--nav-surface` | `#18212F` |
| Sidebar hover | `--nav-hover` | `#232E3E` |
| Sidebar active | `--nav-active` | `#2C394B` + 2 px primary indicator |
| Sidebar text | `--nav-text` | `#DDE3EC` |

#### Semantic colors

| Meaning | Strong/text | Subtle background | Intended use |
|---|---:|---:|---|
| Success | `#16794B` | `#EAF7F0` | Present, complete, healthy |
| Warning | `#7A5200` | `#FFF4CE` | Late, approaching threshold, needs attention |
| Error | `#B42318` | `#FDECEC` | Absent, failed, destructive |
| Info | `#0757B5` | `#EAF2FF` | Informational and in-progress |

Measured contrast examples:

- Primary on white: **6.39:1**
- Primary hover on white: **9.14:1**
- Primary text on white: **16.43:1**
- Secondary text on white: **7.11:1**
- Success on its tint: **4.92:1**
- Warning on its tint: **6.29:1**
- Error on its tint: **5.76:1**
- Info on its tint: **6.13:1**
- Sidebar text on sidebar: **12.54:1**

Final contrast must be rechecked in rendered context, including disabled states, chart marks, focus rings, and adjacent-color non-text contrast.

### 5.5 Spacing and sizing

Use a 4 px base grid. Components may consume only named steps unless third-party geometry requires otherwise.

| Token | Value |
|---|---:|
| `space-0` | 0 |
| `space-0.5` | 2 px |
| `space-1` | 4 px |
| `space-2` | 8 px |
| `space-3` | 12 px |
| `space-4` | 16 px |
| `space-5` | 20 px |
| `space-6` | 24 px |
| `space-8` | 32 px |
| `space-10` | 40 px |
| `space-12` | 48 px |

Density targets:

- Small control: 32 px
- Default control: 36 px
- Large/touch control: 40 px; icon-only touch targets remain at least 40×40 px
- Compact table row: 36 px
- Default table row: 44 px
- Page gutters: 16 px mobile, 24 px tablet, 32 px desktop
- Content max width: none for data tables; 960–1200 px for long forms/settings where readability benefits

### 5.6 Radius scale

| Token | Value | Use |
|---|---:|---|
| `radius-none` | 0 | Tables joined to containers |
| `radius-sm` | 4 px | Badges, compact controls |
| `radius-md` | 6 px | Buttons, inputs, menus |
| `radius-lg` | 8 px | Cards, dialogs, popovers |
| `radius-full` | 999 px | Avatar and true pill/status only |

No `rounded-2xl`/`rounded-3xl` in the authenticated product unless an approved exception is documented.

### 5.7 Shadow and elevation scale

| Token | Value | Use |
|---|---|---|
| `shadow-none` | none | Default cards, tables, shell |
| `shadow-sm` | `0 1px 2px rgb(16 24 40 / 0.06)` | Rare raised controls |
| `shadow-md` | `0 4px 12px rgb(16 24 40 / 0.10)` | Menus/popovers |
| `shadow-lg` | `0 12px 32px rgb(16 24 40 / 0.14)` | Modals/drawers only |

No colored shadows or glow effects. Borders and surface tone provide normal separation.

### 5.8 Motion

- 120 ms color/opacity transitions for controls.
- 160 ms transform/opacity for menus, popovers, and drawers.
- No routine card lifting, icon rotation, row entrance stagger, shimmer-on-hover, blob motion, or glow pulse.
- Loading skeleton motion is subtle and disabled under `prefers-reduced-motion`.
- All essential state changes remain legible with animation disabled.

## 6. Target component architecture

### 6.1 Foundation

Create/normalize a single token layer in `src/index.css` and one Tailwind config. Prefer semantic classes/tokens such as `bg-surface`, `text-secondary`, and `border-default` over raw `slate-*`, `blue-*`, hex values, or arbitrary values.

Recommended folders:

```text
src/
  components/
    ui/                 # accessible primitives
    layout/             # AppShell, RoleSidebar, TopBar, PageHeader
    data-view/          # DataTable, filters, pagination, view states
    feedback/           # EmptyState, ErrorState, LoadingState, InlineAlert
  design-system/
    tokens.css
    icon-map.ts
    status.ts
```

If a separate `tokens.css` adds unnecessary indirection, keep tokens in `index.css`; do not duplicate definitions.

### 6.2 Shared primitives to refactor first

1. Button and icon button
2. Input, textarea, select, checkbox, radio, switch, date controls
3. Form field, label, help text, validation message
4. Badge/status tag
5. Table primitives and a higher-level `DataTable`
6. Card/panel
7. Dialog, alert dialog, sheet/drawer, popover, dropdown, tooltip
8. Toast and inline alert
9. Tabs, pagination, breadcrumb
10. Skeleton, empty state, error state, loading state
11. Page header, toolbar, filter bar, stats strip
12. Unified app shell and role navigation

### 6.3 Data-table contract

Every management data table should support, as applicable:

- semantic `<table>` structure;
- visible column headings;
- sort controls with `aria-sort`;
- filter/search controls with clear/reset behavior;
- server/client pagination without changing current data behavior;
- compact/default density;
- row actions in a consistent final column;
- horizontal overflow on small screens;
- deliberate mobile column priority or an alternate labeled detail layout;
- loading rows that preserve column widths;
- empty state inside the table region;
- filtered-empty state distinct from no records;
- inline error with retry;
- keyboard-visible row/action focus;
- no hover scale or row-level shadow.

## 7. Implementation sequence

### Phase 0 — Approval and baseline lock

- Obtain approval for the proposed font, palette, Carbon icons, light-first direction, density, radii, and shadows.
- Confirm whether optional dark mode is required in the first delivery or a follow-up.
- Record the existing build/lint failures.
- Decide separately whether the undeclared `axios` blocker may be fixed.
- Inventory screenshots of representative routes at 360, 768, 1280, and 1440 px before changes.
- Add a concise visual regression checklist.

**Verification:** no product code changes; branch and baseline documented.

### Phase 1 — Token and dependency foundation

- Consolidate the two Tailwind configs into the verified active config.
- Define semantic light/dark CSS variables and map them through Tailwind.
- Add IBM Plex Sans and apply the type scale globally.
- Add Carbon icons and a temporary icon compatibility map if needed for staged migration.
- Remove global animation/glow rules and broad selectors from `index.css`.
- Retire unused Vite starter CSS after import verification.
- Tokenize `calendar-dark.css` or replace it with scoped calendar styles.

**Verification after phase:** `npm run lint`, `npm run build`, token contrast script/check, smoke render of public/admin/teacher/student shells. Compare results against the recorded baseline; no new failures.

### Phase 2 — Primitive component refactor

- Refactor shared controls and overlays in `components/ui`.
- Add icon-button naming enforcement through component API.
- Create shared state components and table primitives.
- Normalize heights, padding, radii, focus rings, disabled states, and destructive confirmation.
- Replace primitive-layer Lucide imports with Carbon icons.

**Verification after each major primitive group:** lint/build, keyboard navigation, focus visibility, disabled state, screen-reader naming, light/dark token rendering if dark mode is included.

### Phase 3 — Unified role shell

- Build one `AppShell` configured with admin/teacher/student navigation data.
- Preserve route paths, role checks, query calls, badges, and sign-out behavior.
- Use persistent desktop navigation, collapsible rail where useful, and one mobile drawer behavior.
- Replace resizer-only mouse handling with keyboard-accessible behavior or remove resizing if it does not justify its complexity.
- Normalize page title, breadcrumbs, notification access, user menu, and responsive gutters.

**Verification:** route-by-route navigation for all roles, mobile drawer keyboard trap/return focus, active state, collapsed tooltips, sign-out, permission boundaries, no API/query changes.

### Phase 4 — Data-heavy shared patterns

- Migrate students, teachers, faculties, attendance, schedules, calendar lists, notifications, monitoring, and analytics tables to shared data-view patterns.
- Preserve existing data transforms and handlers; wrap them with new presentation components.
- Replace “cards as tables” with semantic tables/compact lists.
- Add loading, error, empty, and filtered-empty states to every data view.
- Standardize filtering, action placement, bulk affordances, pagination, and status tags.

**Verification per module:** lint/build; data parity using the same query results; sorting/filtering/pagination; zero/one/many record cases; network failure; slow loading; 360/768/1280 px layout.

### Phase 5 — Forms and workflows

- Migrate student/teacher/faculty forms, settings, attendance controls, semester configuration, reset-link tools, notifications, face registration, and profile workflows.
- Standardize field grouping, required indicators, help text, errors, submit/loading states, destructive confirmations, and success feedback.
- Keep React Hook Form/Zod/API mutations unchanged.

**Verification per workflow:** keyboard-only completion, validation association, pending submit, API error, success, cancel, modal focus return, mobile layout.

### Phase 6 — Dashboards, analytics, and calendars

- Reduce decorative metric cards; use compact stats strips and prioritized modules.
- Apply shared chart palette, tooltip, legend, empty/error/loading, and tabular-number rules.
- Reserve semantic colors for meaning and ensure chart series are distinguishable beyond color.
- Tokenize React Big Calendar and date-picker surfaces.
- Remove gradients/glows and nonessential entrance motion.

**Verification:** data values unchanged, responsive chart/container behavior, keyboard-readable supporting summaries, color-blind-safe distinction, empty datasets, print/export output.

### Phase 7 — Public/auth/support pages

- Apply the same brand foundation with slightly more breathing room, without importing marketing-page visual tropes into the product shell.
- Redesign login, password recovery, not-found, status, and root error fallback.
- Review whether demo/debug routes should be visibly labeled and excluded from production navigation.

**Verification:** auth redirects, errors, password flow, public responsiveness, focus order, no route changes.

### Phase 8 — Full hardcoding and icon cleanup

- Remove all remaining Lucide imports and dependency.
- Search for unapproved direct palette utilities, hex/rgb colors, inline visual constants, one-off radii, shadows, and arbitrary spacing.
- Keep only documented exceptions: chart/canvas drawing, third-party geometry, truly dynamic layout values, and generated print styles that use the same approved tokens.
- Remove or quarantine obsolete backup/broken/disabled frontend variants after confirming they are unreferenced.

**Verification:** zero `lucide-react` imports; zero unaudited gradients/glows; token audit passes; lint/build no worse than baseline; route smoke matrix complete.

### Phase 9 — Final QA and handoff

- Run the full role/route/state/breakpoint matrix.
- Test Chrome/Edge and one WebKit/Firefox path if available.
- Validate WCAG AA contrast and 3:1 focus/non-text contrast.
- Verify 200% zoom, keyboard-only use, reduced motion, and screen-reader names.
- Review network slow/offline behavior and error recovery.
- Produce before/after screenshots and a short design-system usage guide.

## 8. Required state matrix

For every query-backed table, list, chart, calendar, dashboard module, and selector, verify:

| State | Required behavior |
|---|---|
| Initial loading | Layout-preserving skeleton; no misleading zero values |
| Background refresh | Existing content remains; subtle nonblocking progress |
| Success with data | Correct dense presentation and actions |
| Success with no records | Clear explanation and permitted primary action |
| Filtered no results | Shows active filters and a clear-filters action |
| Recoverable error | Plain-language message and retry |
| Permission/auth error | Correct redirect or access message; no data leak |
| Partial/missing fields | Stable layout and explicit fallback label |
| Offline/network loss | Connection-specific message where detectable |

## 9. Responsive acceptance matrix

| Width | Shell expectation | Data expectation |
|---:|---|---|
| 360 px | Drawer navigation, compact header, no clipped primary actions | Priority columns or labeled mobile layout; horizontal scroll only where necessary |
| 768 px | Drawer or compact rail depending on content | Filters may wrap; forms use one/two columns deliberately |
| 1024 px | Persistent sidebar | Full core columns; optional columns can remain hidden |
| 1280 px | Persistent sidebar and comfortable gutters | Full data-table/toolbars |
| 1440 px+ | No uncontrolled line stretching | Dense content remains bounded where appropriate |

Touch targets should be at least 40×40 px even when visual controls are denser. Fixed headers and sidebars must not hide focused elements.

## 10. Accessibility acceptance criteria

- Text contrast meets WCAG AA: 4.5:1 for normal text and 3:1 for large text.
- Interactive boundaries and focus indicators meet 3:1 against adjacent colors.
- All icon-only buttons have accessible names.
- Decorative icons are hidden from assistive technology.
- Forms associate label, description, error, and required state.
- Dialogs/sheets have titles, descriptions where needed, focus trap, Escape close, and focus return.
- Tables expose headers, sort direction, selection state, and captions/accessible names where needed.
- Status is never conveyed by color alone.
- Navigation has current-page semantics.
- Reduced-motion preference removes nonessential movement.
- Keyboard access covers all actions, menus, filters, calendar controls, and sidebar controls.

## 11. Change-safety and commit strategy

- Work only on `feat/frontend-professional-revamp`.
- Preserve the unrelated backend changes already present in the worktree.
- Make small commits by foundation, primitive group, shell, and module.
- Do not mix business-logic cleanup with visual refactors.
- Before changing a complex page, snapshot its event handlers, query keys, API calls, mutations, route params, and conditional rendering; confirm those remain identical after presentation extraction.
- Run lint/build after each major shared-component refactor and each role shell. Since the baseline currently fails, compare exact deltas and reject any new error.
- Add frontend tests before large shared refactors if authorized: Vitest + Testing Library for primitives/state components and Playwright for role-shell smoke paths. This is recommended because no frontend test harness exists today.

## 12. Definition of done

- Approved design tokens are implemented once and documented.
- All three authenticated role shells share one coherent layout system.
- Lucide is fully removed and Carbon icons are used consistently.
- IBM Plex Sans and the approved type scale are applied across UI and generated reports where practical.
- Direct palette colors, gradients, glow shadows, oversized radii, and arbitrary spacing are eliminated or documented as exceptions.
- Shared buttons, forms, tables, cards/panels, navigation, modals, feedback, and state components drive all modules.
- Every data view has loading, data, empty, filtered-empty, and error behavior.
- Mobile, tablet, desktop, keyboard, focus, reduced motion, and contrast checks pass.
- No API, business rule, route, permission, or data-handling behavior changes.
- Build/lint are at least no worse than the recorded baseline; any pre-existing failures resolved under separate authorization are documented.
- Before/after screenshots and a concise component usage guide are delivered.

## 13. Approval checklist

Please approve or request changes to these choices before implementation:

- [ ] Light-first neutral product shell, with optional tokenized dark theme
- [ ] IBM Plex Sans as the single UI font family
- [ ] Carbon Icons React as the sole UI icon set
- [ ] Blue `#0B57D0` as the primary action color
- [ ] Cool-neutral surfaces and dark neutral sidebar
- [ ] 36 px default controls and 44 px default table rows
- [ ] 4/6/8 px radius scale, with pills only for true pill/status elements
- [ ] Border-led surfaces; shadows reserved for overlays
- [ ] Minimal motion and removal of gradients, glass effects, glows, and global entrance animation

