import React from 'react';
import LiveMonitoring from '@/components/LiveMonitoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/useAuth';
import {
  Person20Regular,
  Shield16Regular,
  CheckmarkCircle16Filled,
  HeartPulse20Regular,
  Desktop20Regular,
  Server20Regular,
  LockClosed20Regular,
  ScanPerson20Regular,
} from '@fluentui/react-icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LiveMonitoringPage: React.FC = () => {
  const { user } = useAuth();

  const components = [
    { name: 'Frontend (Vite)', status: 'Running', icon: Desktop20Regular },
    { name: 'Backend (FastAPI)', status: 'Running', icon: Server20Regular },
    { name: 'Role-based Access Control', status: 'Active', icon: LockClosed20Regular },
    { name: 'Biometric Analytics', status: 'Operational', icon: ScanPerson20Regular },
  ];

  return (
    <div className="w-full space-y-4">
      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList>
          <TabsTrigger value="monitoring">Live Monitoring</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="mt-4">
          <LiveMonitoring />
        </TabsContent>

        <TabsContent value="status" className="mt-4 space-y-4">
          {/* User Information */}
          <Card className="border-0 shadow overflow-hidden">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <Person20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                Current User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="grid grid-cols-1 divide-y divide-border-subtle md:grid-cols-2 md:divide-y-0">
                <div className="px-5 py-3 md:border-b md:border-border-subtle">
                  <dt className="text-caption text-text-muted">Name</dt>
                  <dd className="text-body-strong text-text-primary mt-0.5">{user?.name || 'N/A'}</dd>
                </div>
                <div className="px-5 py-3 md:border-b md:border-l md:border-border-subtle">
                  <dt className="text-caption text-text-muted">Email</dt>
                  <dd className="text-body-strong text-text-primary mt-0.5 break-all">{user?.email || 'N/A'}</dd>
                </div>
                <div className="px-5 py-3">
                  <dt className="text-caption text-text-muted">Role</dt>
                  <dd className="mt-1">
                    <Badge
                      variant={user?.role === 'admin' ? 'default' : 'secondary'}
                      shape="pill"
                      className="gap-1 capitalize"
                    >
                      <Shield16Regular aria-hidden />
                      {user?.role || 'N/A'}
                    </Badge>
                  </dd>
                </div>
                <div className="px-5 py-3 md:border-l md:border-border-subtle">
                  <dt className="text-caption text-text-muted">User ID</dt>
                  <dd className="font-mono text-caption text-text-primary mt-1">{user?.id || 'N/A'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* System Status (M365 service health list) */}
          <Card className="border-0 shadow overflow-hidden">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <HeartPulse20Regular className="shrink-0 text-status-success" aria-hidden />
                System Components Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-border-subtle bg-surface-subtle px-5 py-2 text-caption-strong text-text-secondary">
                <span>Component</span>
                <span>Health</span>
              </div>
              <ul className="divide-y divide-border-subtle">
                {components.map(({ name, status, icon: Icon }) => (
                  <li
                    key={name}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <span className="flex min-w-0 items-center gap-3 text-body text-text-primary">
                      <Icon className="shrink-0 text-text-muted" aria-hidden />
                      <span className="truncate">{name}</span>
                    </span>
                    <Badge variant="success" shape="pill" className="gap-1">
                      <CheckmarkCircle16Filled aria-hidden />
                      {status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LiveMonitoringPage;
