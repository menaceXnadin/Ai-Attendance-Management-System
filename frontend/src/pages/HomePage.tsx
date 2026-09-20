import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  ArrowRight,
  CheckmarkOutline,
  CheckmarkFilled,
  Security,
  Locked,
  Time,
  Analytics,
  UserMultiple,
  Education,
  Dashboard,
  DataStructured,
  FaceActivated,
  Chip,
  Terminal,
  Calendar,
  SettingsAdjust,
  Checkmark,
  User,
  Information
} from '@carbon/icons-react';

const HomePage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'faculty' | 'student'>('admin');
  const [cockpitView, setCockpitView] = useState<'live' | 'vectors'>('live');

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary flex flex-col selection:bg-action-primary selection:text-white">
      <Navbar />

      {/* 1. Hero Section */}
      <section className="relative pt-12 sm:pt-16 md:pt-20 pb-16 md:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Operational Readiness Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium border border-border-subtle bg-surface-default text-text-secondary shadow-2xs mb-6">
              <span className="w-2 h-2 rounded-full bg-status-success" />
              <span>SYSTEM READY</span>
              <span className="text-border-strong">•</span>
              <span className="text-text-muted">v2.4 Academic Biometrics Engine</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary leading-[1.15]">
              Institutional Attendance Telemetry & Biometric Verification
            </h1>

            {/* Subheading with controlled line length */}
            <p className="mt-5 text-sm sm:text-base md:text-lg text-text-secondary leading-relaxed max-w-prose mx-auto">
              Engineered for academic departments, colleges, and polytechnics. AttendAI combines in-browser MediaPipe landmark telemetry with server-side InsightFace ArcFace embeddings for continuous, audit-compliant classroom attendance tracking.
            </p>

            {/* Action Bar */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="default" className="w-full sm:w-auto h-10 px-5 text-xs font-semibold gap-2 shadow-2xs">
                  <span>Access Academic Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#architecture" className="w-full sm:w-auto">
                <Button variant="outline" size="default" className="w-full sm:w-auto h-10 px-5 text-xs font-medium gap-2">
                  <Terminal className="w-4 h-4 text-text-muted" />
                  <span>Technical Specification</span>
                </Button>
              </a>
            </div>
          </div>

          {/* Institutional Telemetry Strip - Clean single-border grid */}
          <div className="mt-14 max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border-subtle border-y border-border-subtle py-4">
              <div className="p-3 sm:p-4">
                <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">Vector Precision</div>
                <div className="text-xl sm:text-2xl font-bold text-text-primary font-mono tracking-tight">512-D</div>
                <div className="text-xs text-text-secondary mt-1">ArcFace embedding matrices</div>
              </div>
              <div className="p-3 sm:p-4">
                <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">Edge Latency</div>
                <div className="text-xl sm:text-2xl font-bold text-text-primary font-mono tracking-tight">&lt; 120ms</div>
                <div className="text-xs text-text-secondary mt-1">Client WebAssembly inference</div>
              </div>
              <div className="p-3 sm:p-4">
                <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">Audit Ledger</div>
                <div className="text-xl sm:text-2xl font-bold text-text-primary font-mono tracking-tight">100%</div>
                <div className="text-xs text-text-secondary mt-1">UTC & device-tagged trace</div>
              </div>
              <div className="p-3 sm:p-4">
                <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">Access Model</div>
                <div className="text-xl sm:text-2xl font-bold text-text-primary font-mono tracking-tight">3-Tier</div>
                <div className="text-xs text-text-secondary mt-1">Admin, Faculty & Student RBAC</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="w-full h-px bg-border-subtle" />

      {/* 2. Cockpit Preview: Classroom Lecture In-Situ Architecture */}
      <section className="py-14 sm:py-20 bg-surface-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <div className="text-xs font-mono uppercase tracking-wider text-action-primary font-semibold mb-1">
              Operational Telemetry
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              Live In-Classroom Session Monitor
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-prose">
              Demonstrating concurrent edge landmark tracking, anti-spoofing liveness verification, and immediate ledger synchronization.
            </p>
          </div>

          {/* Cockpit Window Header as flat top-bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-border-strong/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-border-strong/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-border-strong/60" />
              </div>
              <span className="font-mono text-xs text-text-secondary font-medium">
                session://tu-ioe/bct/sem-7/comp-401 [Active Lecture 08:00 - 09:30]
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCockpitView('live')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  cockpitView === 'live' 
                    ? 'bg-action-primary text-white shadow-2xs' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Edge Video Stream
              </button>
              <button
                type="button"
                onClick={() => setCockpitView('vectors')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  cockpitView === 'vectors' 
                    ? 'bg-action-primary text-white shadow-2xs' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Vector Telemetry
              </button>
              <span className="h-3 w-px bg-border-subtle mx-1" />
              <span className="px-2 py-0.5 rounded border border-status-success/30 text-status-success bg-status-success/5 text-xs font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                <span>INSPECTION ACTIVE</span>
              </span>
            </div>
          </div>

          {/* Cockpit Content Split: Left stream monitor and Right roster ledger as two parallel modular panels */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Viewport (Stream Simulation) - Unnested monitor panel */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              {cockpitView === 'live' ? (
                <div>
                  <div className="relative aspect-video rounded-md bg-neutral-950 border border-neutral-800 overflow-hidden flex items-center justify-center p-4">
                    {/* Corner crosshair indicators */}
                    <span className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-action-primary/60" />
                    <span className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-action-primary/60" />
                    <span className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-action-primary/60" />
                    <span className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-action-primary/60" />

                    {/* Simulated bounding box with explicit dark HUD styling */}
                    <span className="relative border-2 border-action-primary rounded-md p-3 sm:p-5 flex flex-col items-center">
                      <FaceActivated className="w-16 h-16 sm:w-20 sm:h-20 text-action-primary/80" />
                      <span className="mt-3 px-2.5 py-0.5 rounded bg-neutral-900 text-neutral-100 border border-neutral-700 text-xs font-mono">
                        P. Acharya [Roll 077BCT048]
                      </span>
                      <span className="text-xs font-mono text-emerald-400 mt-1 flex items-center gap-1">
                        <Checkmark className="w-3 h-3" />
                        <span>Liveness 0.992 • Conf 98.6%</span>
                      </span>
                    </span>

                    {/* Live HUD Overlays */}
                    <span className="absolute top-3 left-8 font-mono text-xs text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      CAM_01 • 1080P @ 30FPS • WEBRTC
                    </span>
                    <span className="absolute bottom-3 right-3 font-mono text-xs text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      MODEL: InsightFace ArcFace-r100
                    </span>
                  </div>

                  {/* Stream Diagnostics - In-flow flat telemetry strip */}
                  <div className="mt-4 grid grid-cols-3 divide-x divide-border-subtle border-t border-border-subtle pt-3 text-xs font-mono">
                    <div className="pr-3">
                      <div className="text-text-muted text-xs">INFERENCE TIME</div>
                      <div className="text-text-primary font-semibold mt-0.5">74 ms</div>
                    </div>
                    <div className="px-3">
                      <div className="text-text-muted text-xs">COSINE SIMILARITY</div>
                      <div className="text-status-success font-semibold mt-0.5">0.824 &gt; 0.650</div>
                    </div>
                    <div className="pl-3">
                      <div className="text-text-muted text-xs">ANTI-SPOOF ENGINE</div>
                      <div className="text-text-primary font-semibold mt-0.5">PASSED</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col justify-between">
                  <div className="p-4 rounded-lg bg-surface-canvas font-mono text-xs text-text-secondary space-y-2">
                    <div className="text-text-muted text-xs">// ARC_FACE VECTOR EMBEDDING BUFFER (EXTRACT 512D)</div>
                    <div className="p-3 bg-surface-default rounded border border-border-subtle text-xs leading-relaxed text-text-primary overflow-x-auto">
                      [-0.04218, 0.08941, -0.01235, 0.14502, -0.09841, 0.03419, 0.22104, -0.01844, ... +504 dimensions]
                    </div>
                    <div className="pt-2 text-xs text-text-secondary">
                      <strong>Distance Metric:</strong> Cosine Similarity Threshold (<code className="text-action-primary">τ = 0.65</code>). Normalized L2 Euclidean distance verification.
                    </div>
                  </div>
                  <div className="mt-4 p-3 rounded bg-surface-canvas text-xs text-text-secondary">
                    <strong className="text-text-primary">Database Match:</strong> Identified student record <code className="text-text-primary font-mono">UUID #9d3f-42a1</code> matching enrolled baseline with 98.6% confidence rating.
                  </div>
                </div>
              )}
            </div>

            {/* Right Roster Ledger (Real-time Database Sync) */}
            <div className="lg:col-span-5 rounded-lg border border-border-subtle bg-surface-default p-4 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Active Class Roster</div>
                    <div className="text-xs text-text-secondary">COMP-401 • Room 302</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-text-primary">41 / 45 Present</div>
                    <div className="text-xs text-status-success font-medium">91.1% Attendance</div>
                  </div>
                </div>

                {/* Progress Bar without outer border */}
                <div className="w-full bg-surface-canvas h-1.5 rounded-full overflow-hidden my-3">
                  <div className="bg-action-primary h-full rounded-full" style={{ width: '91.1%' }} />
                </div>

                {/* Recent Verifications Feed - In-flow list */}
                <div className="mt-4">
                  <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">
                    Recent Biometric Check-ins
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {[
                      { name: 'Prashant Acharya', roll: '077BCT048', time: '08:14:22 AM', method: 'Biometric Edge', status: 'Verified' },
                      { name: 'Samikshya Gautam', roll: '077BCT052', time: '08:13:58 AM', method: 'Biometric Edge', status: 'Verified' },
                      { name: 'Rohan Shrestha', roll: '077BCT061', time: '08:13:10 AM', method: 'Biometric Edge', status: 'Verified' },
                      { name: 'Anjali Sharma', roll: '077BCT012', time: '08:12:45 AM', method: 'Biometric Edge', status: 'Verified' },
                    ].map((entry) => (
                      <div key={entry.roll} className="flex items-center justify-between py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckmarkFilled className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
                          <div>
                            <div className="font-medium text-text-primary">{entry.name}</div>
                            <div className="text-xs font-mono text-text-muted">{entry.roll}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-text-secondary">{entry.time}</div>
                          <span className="text-xs text-text-muted font-mono">
                            {entry.method}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Auto-Absent Footer */}
              <div className="mt-6 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                  <Time className="w-3.5 h-3.5 text-action-primary" />
                  <span>Grace Period: <strong className="text-text-primary font-mono">14m 20s remaining</strong></span>
                </div>
                <span className="text-xs font-mono">Auto-Absent: ENABLED</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="w-full h-px bg-border-subtle" />

      {/* 3. Three-Tier Academic Role Workflows */}
      <section id="roles" className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-mono uppercase tracking-wider text-action-primary font-semibold mb-1">
              Access Hierarchies
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              Role-Tailored Operational Portals
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-prose mx-auto">
              Granular capabilities designed for department administrators, teaching faculty, and enrolled students.
            </p>

            {/* Segmented Switcher - Clean track without card border/shadow */}
            <div className="inline-flex p-1 rounded-lg bg-surface-subtle mt-6">
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`btn px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  selectedRole === 'admin'
                    ? 'bg-action-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Department Admin
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('faculty')}
                className={`btn px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  selectedRole === 'faculty'
                    ? 'bg-action-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Faculty / Teacher
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('student')}
                className={`btn px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  selectedRole === 'student'
                    ? 'bg-action-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Enrolled Student
              </button>
            </div>
          </div>

          {/* Role Detail Cards - Flattened icon-in-flow headers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Admin */}
            <div className={`p-6 rounded-xl border transition-all ${
              selectedRole === 'admin' 
                ? 'border-action-primary bg-surface-default shadow-xs ring-1 ring-action-primary/20' 
                : 'border-border-subtle bg-surface-default hover:border-border-default'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Dashboard className="w-5 h-5 text-action-primary flex-shrink-0" />
                <h3 className="text-base font-semibold text-text-primary">Department Administration</h3>
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-3">Administrative Control</div>
              <p className="text-xs text-text-secondary leading-relaxed mb-5 max-w-prose">
                Centralized oversight over faculty rosters, batch assignments, timetable definitions, and automated absence policies.
              </p>
              <ul className="space-y-2.5 text-xs text-text-secondary mb-6">
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Configure semesters, subjects, and teacher-class assignments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Manage automated absence cron triggers and grace thresholds</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Execute biometric facial model batch re-indexes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Generate department-wide accreditation audit reports</span>
                </li>
              </ul>
              <Link to="/login">
                <Button variant="outline" size="sm" className="w-full text-xs h-8">
                  <span>Open Admin Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>

            {/* Card 2: Faculty */}
            <div className={`p-6 rounded-xl border transition-all ${
              selectedRole === 'faculty' 
                ? 'border-action-primary bg-surface-default shadow-xs ring-1 ring-action-primary/20' 
                : 'border-border-subtle bg-surface-default hover:border-border-default'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Education className="w-5 h-5 text-action-primary flex-shrink-0" />
                <h3 className="text-base font-semibold text-text-primary">Faculty & Instructors</h3>
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-3">Course Instruction</div>
              <p className="text-xs text-text-secondary leading-relaxed mb-5 max-w-prose">
                Turnkey classroom attendance execution with real-time biometric tracking, manual exception handling, and analytics.
              </p>
              <ul className="space-y-2.5 text-xs text-text-secondary mb-6">
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Launch scheduled lecture sessions with 1-click verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Live visual verification HUD with instant student match confirmation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Manual override & medical leave adjustment with audit remarks</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Student engagement telemetry and chronic absence flags</span>
                </li>
              </ul>
              <Link to="/login">
                <Button variant="outline" size="sm" className="w-full text-xs h-8">
                  <span>Open Teacher Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>

            {/* Card 3: Student */}
            <div className={`p-6 rounded-xl border transition-all ${
              selectedRole === 'student' 
                ? 'border-action-primary bg-surface-default shadow-xs ring-1 ring-action-primary/20' 
                : 'border-border-subtle bg-surface-default hover:border-border-default'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-action-primary flex-shrink-0" />
                <h3 className="text-base font-semibold text-text-primary">Enrolled Students</h3>
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-3">Self-Service Portal</div>
              <p className="text-xs text-text-secondary leading-relaxed mb-5 max-w-prose">
                Self-service biometric registration, daily attendance ledger visibility, and institutional requirement compliance.
              </p>
              <ul className="space-y-2.5 text-xs text-text-secondary mb-6">
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Multi-angle biometric onboarding with real-time quality validation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Subject-by-subject attendance progress against the 75% quorum</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Personal lecture history log with verification timestamps</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckmarkOutline className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
                  <span>Self-service mobile attendance check-in for registered locations</span>
                </li>
              </ul>
              <Link to="/login">
                <Button variant="outline" size="sm" className="w-full text-xs h-8">
                  <span>Open Student Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="w-full h-px bg-border-subtle" />

      {/* 4. Technical Pipeline Architecture */}
      <section id="architecture" className="py-14 sm:py-20 bg-surface-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-xs font-mono uppercase tracking-wider text-action-primary font-semibold mb-1">
              Engineering Specification
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              The AttendAI Biometric Pipeline
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-prose">
              A dual-stage edge-and-server architecture designed for zero biometric cloud leak and sub-second matching.
            </p>
          </div>

          {/* 4 Pipeline Stages - Using h3 for valid heading hierarchy */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-lg bg-surface-default border border-border-subtle shadow-2xs relative">
              <div className="text-xs font-mono text-action-primary font-bold mb-2">01 / ENROLLMENT</div>
              <h3 className="text-sm font-semibold text-text-primary mb-1.5">Triangulation & Vectorization</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Students register 3 distinct face angles. The backend computes normalized 512-dimension ArcFace vectors saved in PostgreSQL with pgvector.
              </p>
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted">
                <span>Model: InsightFace</span>
                <span>Storage: Local DB</span>
              </div>
            </div>

            <div className="p-5 rounded-lg bg-surface-default border border-border-subtle shadow-2xs relative">
              <div className="text-xs font-mono text-action-primary font-bold mb-2">02 / EDGE DETECTION</div>
              <h3 className="text-sm font-semibold text-text-primary mb-1.5">MediaPipe Client Telemetry</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                In-browser WebAssembly detects 468 facial mesh landmarks directly on the client camera feed, filtering out invalid angles before network transmission.
              </p>
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted">
                <span>Latency: &lt; 120ms</span>
                <span>Hardware: Local GPU</span>
              </div>
            </div>

            <div className="p-5 rounded-lg bg-surface-default border border-border-subtle shadow-2xs relative">
              <div className="text-xs font-mono text-action-primary font-bold mb-2">03 / VERIFICATION</div>
              <h3 className="text-sm font-semibold text-text-primary mb-1.5">Cosine Matrix Matching</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Extracted vector is compared against the specific lecture roster using normalized cosine distance matrices with anti-spoof liveness validation.
              </p>
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted">
                <span>Threshold: τ = 0.65</span>
                <span>Speed: ~40ms</span>
              </div>
            </div>

            <div className="p-5 rounded-lg bg-surface-default border border-border-subtle shadow-2xs relative">
              <div className="text-xs font-mono text-action-primary font-bold mb-2">04 / LEDGER & CRON</div>
              <h3 className="text-sm font-semibold text-text-primary mb-1.5">Transactional Persistence</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Attendance records are committed with immutable UTC stamps. Once the lecture cutoff passes, the automated cron scheduler marks missing students absent.
              </p>
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted">
                <span>Engine: FastAPI</span>
                <span>Cron: Configurable</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="w-full h-px bg-border-subtle" />

      {/* 5. Enterprise Security & Compliance Grid - In-flow icons, valid h3 headings */}
      <section className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-xs font-mono uppercase tracking-wider text-action-primary font-semibold mb-1">
              Institutional Standards
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              Security, Privacy & Infrastructure Governance
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-prose">
              Designed to satisfy higher-education IT requirements and regulatory compliance standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-lg border border-border-subtle bg-surface-default shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <Security className="w-4 h-4 text-action-primary flex-shrink-0" />
                <h3 className="text-sm font-semibold text-text-primary">On-Premises Privacy</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed max-w-prose">
                Biometric embeddings remain strictly inside your departmental servers without transmission to public commercial AI vendors.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border-subtle bg-surface-default shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <Time className="w-4 h-4 text-action-primary flex-shrink-0" />
                <h3 className="text-sm font-semibold text-text-primary">Statutory Audit Logs</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed max-w-prose">
                Every verified check-in records UTC timestamp, hardware identifier, verification mode, and confidence scores for compliance audits.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border-subtle bg-surface-default shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <SettingsAdjust className="w-4 h-4 text-action-primary flex-shrink-0" />
                <h3 className="text-sm font-semibold text-text-primary">Automated Auto-Absent</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed max-w-prose">
                Configurable grace windows automatically mark absent records when the lecture window closes, preventing administrative backlogs.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border-subtle bg-surface-default shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <Locked className="w-4 h-4 text-action-primary flex-shrink-0" />
                <h3 className="text-sm font-semibold text-text-primary">JWT Role Enforcement</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed max-w-prose">
                Endpoints are guarded with cryptographically signed JSON Web Tokens, enforcing strict principle of least privilege between roles.
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="w-full h-px bg-border-subtle" />

      {/* 6. Institutional Call-to-Action - Clean full-width institutional ribbon */}
      <section className="py-16 sm:py-24 bg-surface-default text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium border border-border-subtle bg-surface-canvas text-text-secondary mb-4">
            <Education className="w-3.5 h-3.5 text-action-primary" />
            <span>Higher Education Attendance Platform</span>
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-text-primary mb-3">
            Deploy Modern Biometric Attendance in Your Department
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary max-w-prose mx-auto mb-8 leading-relaxed">
            Equip instructors and students with seamless facial recognition attendance, accurate automated ledgers, and institutional analytics.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="default" className="w-full sm:w-auto h-10 px-6 text-xs font-semibold gap-2 shadow-2xs">
                <span>Sign In to Institutional Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/about" className="w-full sm:w-auto">
              <Button variant="outline" size="default" className="w-full sm:w-auto h-10 px-6 text-xs font-medium gap-2">
                <Information className="w-4 h-4" />
                <span>About AttendAI Architecture</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;

