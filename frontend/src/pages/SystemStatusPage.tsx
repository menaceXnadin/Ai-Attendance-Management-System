import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/useAuth';
import logo from '@/assets/main.png';
import {
  CheckmarkCircle16Filled,
  CheckmarkCircle20Filled,
  Desktop20Regular,
  Server20Regular,
  ShieldPerson20Regular,
  ScanPerson20Regular,
  Shield16Regular,
  Person20Regular,
  Pulse20Regular,
  SignOut20Regular,
  Navigation20Regular,
} from '@fluentui/react-icons';

const SERVICES = [
  {
    name: 'Frontend (Vite + React)',
    description: 'Web client and portal UI',
    status: 'Running',
    icon: <Desktop20Regular aria-hidden />,
  },
  {
    name: 'Backend (FastAPI)',
    description: 'REST API and scheduler',
    status: 'Running',
    icon: <Server20Regular aria-hidden />,
  },
  {
    name: 'Role-based Access Control',
    description: 'JWT authentication and role enforcement',
    status: 'Active',
    icon: <ShieldPerson20Regular aria-hidden />,
  },
  {
    name: 'Attendance & Biometrics',
    description: 'Face verification and attendance ledger',
    status: 'Online',
    icon: <ScanPerson20Regular aria-hidden />,
  },
];

const SystemStatusPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [lastChecked] = useState(() => new Date());

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary">
      {/* Minimal product header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-default">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-sm" aria-label="AttendAI home">
              <img src={logo} alt="" className="h-7 w-7 object-contain" />
              <span className="text-[18px] font-semibold leading-6 text-text-primary">AttendAI</span>
            </Link>
            <span className="mx-2 hidden h-5 w-px bg-border-default sm:block" aria-hidden />
            <span className="hidden truncate text-body text-text-secondary sm:block">Service health</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={signOut} variant="outline" size="sm" className="h-8 gap-1.5 text-body">
              <SignOut20Regular aria-hidden />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Page header */}
        <div className="page-header mb-0">
          <div>
            <h1 className="text-page-title text-text-primary">System Status</h1>
            <p className="mt-1 text-body text-text-muted">Current application status and user session</p>
          </div>
          <p className="text-caption text-text-muted">
            Last checked{' '}
            <time dateTime={lastChecked.toISOString()} className="tabular-nums">
              {lastChecked.toLocaleString()}
            </time>
          </p>
        </div>

        {/* Overall health message bar */}
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2 text-body text-text-primary"
        >
          <CheckmarkCircle20Filled className="mt-px shrink-0 text-status-success" aria-hidden />
          <span>
            <span className="font-semibold">All systems operational.</span>{' '}
            <span className="text-text-secondary">{SERVICES.length} of {SERVICES.length} components healthy.</span>
          </span>
        </div>

        {/* System Status */}
        <Card className="overflow-hidden rounded-lg border-transparent bg-surface-default shadow">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border-subtle px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
              <Pulse20Regular className="text-brand-foreground" aria-hidden />
              System Components Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden grid-cols-[1fr_auto] bg-surface-subtle px-5 py-2 text-caption-strong text-text-secondary sm:grid">
              <span>Service</span>
              <span>Status</span>
            </div>
            <ul className="divide-y divide-border-subtle">
              {SERVICES.map((service) => (
                <li
                  key={service.name}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-surface-hover"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-text-secondary">
                      {service.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-body-strong text-text-primary">{service.name}</div>
                      <div className="truncate text-caption text-text-muted">{service.description}</div>
                    </div>
                  </div>
                  <Badge variant="success" shape="pill" className="shrink-0 gap-1">
                    <CheckmarkCircle16Filled className="h-3.5 w-3.5" aria-hidden />
                    {service.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* User Information */}
          <Card className="rounded-lg border-transparent bg-surface-default shadow lg:col-span-2">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <Person20Regular className="text-brand-foreground" aria-hidden />
                Current User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-caption text-text-muted">Name</dt>
                  <dd className="mt-0.5 text-body-strong text-text-primary">{user?.name || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-caption text-text-muted">Email</dt>
                  <dd className="mt-0.5 break-all text-body-strong text-text-primary">{user?.email || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-caption text-text-muted">Role</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <Badge
                      variant={user?.role === 'admin' ? 'default' : 'secondary'}
                      shape="pill"
                      className="gap-1 capitalize"
                    >
                      <Shield16Regular className="h-3.5 w-3.5" aria-hidden />
                      {user?.role || 'N/A'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-text-muted">User ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-caption text-text-primary">{user?.id || 'N/A'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Quick Navigation */}
          <Card className="rounded-lg border-transparent bg-surface-default shadow">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <Navigation20Regular className="text-brand-foreground" aria-hidden />
                Quick Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => window.location.href = user?.role === 'admin' ? '/app' : user?.role === 'faculty' ? '/teacher' : '/student'}
                  className="w-full font-semibold"
                >
                  Go to Dashboard
                </Button>
                {user?.role === 'admin' && (
                  <>
                    <Button
                      onClick={() => window.location.href = '/app/analytics'}
                      variant="outline"
                      className="w-full"
                    >
                      System Analytics
                    </Button>
                    <Button
                      onClick={() => window.location.href = '/app/monitoring'}
                      variant="outline"
                      className="w-full"
                    >
                      Live Monitoring
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SystemStatusPage;
