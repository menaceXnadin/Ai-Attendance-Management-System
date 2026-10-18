# AttendAI

**Class-session attendance for universities and colleges.** Students check in with their face and the code shown in the classroom. Teachers keep the register, and administrators see which classes still need attention. Every change leaves an audit trail.

<img src="docs/images/screenshots/landing-hero.webp" alt="AttendAI landing page: 'Every class, accounted for.' beside a classroom photo and the student check-in panel" width="100%">

> **About this repository.** AttendAI began as a final-year project. It is **not deployed or hosted anywhere**, so the screenshots below are how you can see it working. They were taken from a local run on 18 October 2026 using **dummy data**; personal details are placeholders.

---

## Contents
- [What it does](#what-it-does)
- [A tour of the system](#a-tour-of-the-system)
  - [Public site and sign-in](#public-site-and-sign-in)
  - [Student portal](#student-portal)
  - [Teacher portal](#teacher-portal)
  - [Admin portal](#admin-portal)
  - [Dark mode and phones](#dark-mode-and-phones)
- [How a class gets recorded](#how-a-class-gets-recorded)
- [Face verification](#face-verification)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Running it locally](#running-it-locally)
- [Tests](#tests)
- [Documentation](#documentation)
- [Credits and licences](#credits-and-licences)

---

## What it does

| Role | What they get |
|---|---|
| **Students** | Check in to the class they're in, during a short window, with their face and the rotating classroom code. They see attendance per subject and overall, whether they meet the minimum, a calendar of every day's status, and streaks. They register (or delete) their own face data. |
| **Teachers** | Today's classes, a register for the sessions they teach (present / late / absent, only changed rows saved), a QR check-in code for the classroom screen, cancel and make-up classes, and per-subject analytics. |
| **Administrators** | Terms, timetables and the academic calendar (holidays and exams cancel affected classes automatically), a queue of classes nobody recorded, corrections with reasons and an audit log, face-verification settings, thresholds and analytics. |

A few rules shape everything (full spec: [`docs/system/domain-rules.md`](docs/system/domain-rules.md)):
- **Attendance belongs to a class session**: one timetable slot on one date.
- **No fabricated absences.** Students are marked absent automatically only for classes that were actually held. A class nobody recorded is flagged for follow-up, never filled with absences, and never counted.
- **Nothing is silently overwritten or deleted.** Every change records the old and new value, who made it, when and why.
- **One clock and one calculation.** Every time decision uses Asia/Kathmandu time on the server, and every percentage comes from one service. "—" is shown when there's no data, never a misleading 0%.

---

## A tour of the system

### Public site and sign-in

<table>
  <tr>
    <td width="50%"><img src="docs/images/screenshots/landing-how-it-works.webp" alt="Landing page timeline of one class from first check-in to final record"></td>
    <td width="50%"><img src="docs/images/screenshots/login.webp" alt="Sign-in page with Student, Teacher and Admin tabs"></td>
  </tr>
  <tr>
    <td><b>How it works.</b> The landing page explains the life of a single class: check-in window, late marks, grace period, and what happens if nobody records it.</td>
    <td><b>Sign in.</b> One sign-in page; each role lands in its own portal.</td>
  </tr>
</table>

### Student portal

<table>
  <tr>
    <td width="50%"><img src="docs/images/screenshots/student-dashboard.webp" alt="Student dashboard with attendance rate, today's class schedule and an open check-in window"></td>
    <td width="50%"><img src="frontend/src/assets/landing/screens/student-checkin-light-1000.webp" alt="Face check-in panel asking for the six-digit classroom code and explaining the head-turn steps"></td>
  </tr>
  <tr>
    <td><b>Dashboard.</b> Attendance rate against the minimum, and today's classes with their live check-in state ("Check-in open", "Upcoming", "Present").</td>
    <td><b>Face check-in.</b> Enter the classroom code (or scan the teacher's QR), look at the camera, then turn your head when asked.</td>
  </tr>
  <tr>
    <td><img src="docs/images/screenshots/student-attendance.webp" alt="Student attendance calendar marking each day present, partial, holiday or day off"></td>
    <td><img src="docs/images/screenshots/student-face-registration.webp" alt="Face registration with consent and an explanation of how face data is used"></td>
  </tr>
  <tr>
    <td><b>My attendance.</b> A calendar of every day's status, with this month's and this term's figures and streaks.</td>
    <td><b>Face registration.</b> Consent first; only a numeric face template is kept, never the photos, and students can delete it themselves.</td>
  </tr>
</table>

### Teacher portal

<table>
  <tr>
    <td width="50%"><img src="docs/images/screenshots/teacher-dashboard.webp" alt="Teacher dashboard with today's classes, attendance summary and assigned courses"></td>
    <td width="50%"><img src="docs/images/screenshots/teacher-register.webp" alt="Teacher class register listing students with present, late and absent controls"></td>
  </tr>
  <tr>
    <td><b>Dashboard.</b> Today's classes with their state (held, in progress, upcoming), quick cancel, and the courses they teach.</td>
    <td><b>Register.</b> Mark present, late or absent; only changed rows are sent. Editable for 7 days by default.</td>
  </tr>
  <tr>
    <td><img src="docs/images/screenshots/teacher-checkin-code.webp" alt="Full-screen check-in code dialog with a QR code and a six-digit code that changes every 30 seconds"></td>
    <td><img src="docs/images/screenshots/teacher-subject-analytics.webp" alt="Subject analytics with attendance records by status and students by attendance band"></td>
  </tr>
  <tr>
    <td><b>Check-in code.</b> A QR code and six-digit code for the classroom screen; it changes every 30 seconds, so checking in from outside the room doesn't work.</td>
    <td><b>Subject analytics.</b> Records by status, students in each policy band, and a per-student breakdown.</td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/images/screenshots/teacher-schedule.webp" alt="Teacher weekly timetable"><br><b>Schedule.</b> The teacher's week at a glance.</td>
  </tr>
</table>

### Admin portal

<table>
  <tr>
    <td width="50%"><img src="docs/images/screenshots/admin-dashboard.webp" alt="Admin dashboard with today's attendance, scheduler status, recent activity and students by faculty"></td>
    <td width="50%"><img src="docs/images/screenshots/admin-unrecorded.webp" alt="Unrecorded and review queue listing past classes nobody took attendance for, with Resolve as held and Not held actions"></td>
  </tr>
  <tr>
    <td><b>Dashboard.</b> Today's attendance as calculated by the server, the auto-absent scheduler's real status and the number of unrecorded classes.</td>
    <td><b>Unrecorded classes.</b> Past classes nobody recorded. Resolve each as held (with a register) or not held. They are never auto-absented.</td>
  </tr>
  <tr>
    <td><img src="docs/images/screenshots/admin-semester-setup.webp" alt="Semester setup listing terms with dates, exam windows and status"></td>
    <td><img src="docs/images/screenshots/admin-calendar.webp" alt="Academic calendar month view with a holiday and weekly days off"></td>
  </tr>
  <tr>
    <td><b>Semester setup.</b> Terms by date, with exam windows. The current term is worked out from today's date.</td>
    <td><b>Academic calendar.</b> Holidays, exams and cancellations; saving an event updates the class sessions it covers.</td>
  </tr>
  <tr>
    <td><img src="docs/images/screenshots/admin-students.webp" alt="Student management table with faculty, semester, batch and face registration status"></td>
    <td><img src="docs/images/screenshots/admin-analytics.webp" alt="Analytics with today, this week and this month attendance and subject-wise performance"></td>
  </tr>
  <tr>
    <td><b>Students.</b> Roster by faculty, semester and batch, with each student's face-registration status.</td>
    <td><b>Analytics.</b> Today, this week and this month, plus subject-wise performance and trends.</td>
  </tr>
</table>

### Dark mode and phones

The interface follows Microsoft Fluent 2 (the Teams look) and has a full dark theme. The landing page and the portals adapt to phone width (the portal navigation becomes a drawer).

<table>
  <tr>
    <td width="50%"><img src="docs/images/screenshots/landing-hero-dark.webp" alt="Landing page in dark mode"></td>
    <td width="50%"><img src="docs/images/screenshots/admin-dashboard-dark.webp" alt="Admin dashboard in dark mode"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/screenshots/teacher-register-dark.webp" alt="Teacher register in dark mode"></td>
    <td width="50%" align="center">
      <img src="docs/images/screenshots/landing-mobile.webp" alt="Landing page on a phone" width="45%">
      &nbsp;
      <img src="docs/images/screenshots/student-dashboard-mobile.webp" alt="Student dashboard on a phone" width="45%">
    </td>
  </tr>
</table>

---

## How a class gets recorded

Take a lecture timetabled 10:00–11:00 (the times below are the default policy; administrators can change them):

| Time | What happens |
|---|---|
| 09:50 | Check-in opens. The teacher shows the rotating classroom code; students enter it, look at the camera and turn their head. |
| 10:00 | Class starts. The teacher can take the register alongside check-ins. |
| 10:10 | From here, check-ins are recorded as **late**. |
| 10:20 | Check-in closes (or at the end of class, if that's sooner). |
| 11:00 | Class ends; a 15-minute grace period lets the register be finished. |
| 11:15 | **If anyone recorded attendance**, the class counts as held and the automatic run (every 10 minutes) marks enrolled students with no record as absent. **If nobody did**, the class goes on the admin's *unrecorded* list instead, and no absences are created. |

Teachers can correct their registers for 7 days; later changes go through an administrator, with a reason. Holidays and exam periods cancel the sessions they cover automatically. Sessions that already have records are flagged for review instead of being changed.

## Face verification

- **1:1 matching on your own server.** The browser (MediaPipe) only guides framing and the head-turn prompt. The backend compares the capture with that student's own enrolled templates using InsightFace. Nothing is sent to a third-party AI service.
- **Liveness and proof of presence.** Passive anti-spoofing (MiniFASNet), an active head turn, and the classroom code that rotates every 30 seconds. Each check can be switched in the face-verification settings.
- **Privacy.** Enrolment requires consent; only templates are stored, never images. Students can delete their face data, and students never see similarity scores. Repeated failures lock check-in temporarily, and every attempt is logged.

Spec: [`docs/system/face-verification.md`](docs/system/face-verification.md).

---

## Architecture

```
Browser: React SPA (Vite dev server :8080)
   │  /api/* proxied to the backend, JWT in the Authorization header
   ▼
FastAPI backend (uvicorn :8000) ──► PostgreSQL 17 (Asia/Kathmandu)
   │  routes → domain services → SQLAlchemy (async)
   ├─ face engine: InsightFace buffalo_l + MiniFASNet anti-spoofing (ONNX, CPU, worker threads)
   └─ in-process scheduler: creates class sessions and finalizes held ones every 10 minutes
```

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS with Fluent 2 design tokens, Radix/shadcn primitives, TanStack Query, Recharts, MediaPipe |
| Backend | Python 3.13, FastAPI, SQLAlchemy 2 (asyncpg), Alembic, InsightFace + onnxruntime, JWT (HS256) + bcrypt |
| Database | PostgreSQL 17 |

The attendance rules live in a handful of domain services: one writer of attendance, one place that computes percentages, one finalizer. Routes call them instead of re-implementing rules. More in [`docs/system/architecture.md`](docs/system/architecture.md).

## Repository layout

| Path | What's there |
|---|---|
| `frontend/` | React app: routes in `src/App.tsx`, the Teams-style shell in `src/components/layout/`, the landing page in `src/components/landing/`, screens in `src/pages/`, the API client in `src/integrations/api/client.ts` |
| `backend/app/` | FastAPI app: `api/routes/`, `services/` (attendance and face-verification rules), `models/`, `core/` (config, DB, security, clock) |
| `backend/alembic/` | Database migrations |
| `backend/tests/` | Pytest suite (domain rules, routes, face verification) |
| `backend/models/anti_spoof/` | MiniFASNet anti-spoofing ONNX models (Apache-2.0) |
| `docs/system/` | Current technical documentation |
| `AGENTS.md` | Orientation for developers and AI coding agents |

---

## Running it locally

You need **Python 3.13**, **Node 18+** (npm) and **PostgreSQL 17**.

### 1. Backend

```bash
cd backend
python -m venv venv
venv/Scripts/activate            # Windows (Git Bash); on Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`. These four are required; the rest have defaults (see [`architecture.md` → Configuration](docs/system/architecture.md#configuration-backendenv-settings)):

```ini
DATABASE_URL=postgresql+asyncpg://postgres:<password>@localhost:5432/attendancedb
DATABASE_URL_SYNC=postgresql://postgres:<password>@localhost:5432/attendancedb
SECRET_KEY=<a long random string>
ALLOWED_ORIGINS=["http://localhost:8080"]
```

**Database.** The migration chain can't build an empty database (it has several root migrations that assume existing tables). Build one the way the test suite does: create `attendancedb`, load `backend/tests/schema/baseline.sql` and `backend/tests/schema/seed_reference.sql`, then:

```bash
venv/Scripts/python.exe -m alembic stamp n20251103_payload_receipts
venv/Scripts/python.exe -m alembic upgrade head
```

There is no seed script for user accounts yet, so a fresh database has no logins; see [`docs/system/known-issues.md`](docs/system/known-issues.md).

Start the API (the first start downloads the InsightFace `buffalo_l` models to `~/.insightface`):

```bash
venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:8080, proxies /api to :8000
```

Classes only appear once a term covering today exists (Admin → Semester Setup).

## Tests

```bash
cd backend && venv/Scripts/python.exe -m pytest -q    # ~700 tests; builds a throwaway attendancedb_test database
cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm run lint && npm run build
```

The backend suite encodes the attendance and face-verification rules. See [`docs/system/testing.md`](docs/system/testing.md).

## Documentation

| Doc | Covers |
|---|---|
| [`docs/system/README.md`](docs/system/README.md) | Index of the technical docs |
| [`domain-rules.md`](docs/system/domain-rules.md) | The attendance rules (authoritative) |
| [`face-verification.md`](docs/system/face-verification.md) | Enrolment, check-in, liveness and presence codes |
| [`architecture.md`](docs/system/architecture.md) | Components, flows, auth and configuration |
| [`database.md`](docs/system/database.md) · [`api-reference.md`](docs/system/api-reference.md) · [`frontend.md`](docs/system/frontend.md) | Schema, endpoints and the React app |
| [`known-issues.md`](docs/system/known-issues.md) | Technical debt and current state |

## Credits and licences

- Landing-page photography from [Unsplash](https://unsplash.com) (Unsplash License): Vitaly Gariev, Allen Y and Sanket Mishra. Credits also appear in the site footer.
- Face recognition uses InsightFace's pretrained `buffalo_l` models, which are licensed for **non-commercial research only**. Anti-spoofing uses Minivision's Silent-Face MiniFASNet models (Apache-2.0, see `backend/models/anti_spoof/`).
- Icons: Fluent UI System Icons (MIT).
