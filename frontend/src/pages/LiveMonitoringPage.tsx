import React from 'react';
import LiveMonitoring from '@/components/LiveMonitoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/useAuth';
import { User, Shield, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LiveMonitoringPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="w-full space-y-6">
      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList className="grid w-full sm:w-80 grid-cols-2 bg-surface-subtle border border-border-subtle p-1 rounded-lg">
          <TabsTrigger 
            value="monitoring"
            className="text-text-secondary data-[state=active]:bg-surface-default data-[state=active]:text-text-primary data-[state=active]:shadow-xs rounded-md text-xs font-medium"
          >
            Live Monitoring
          </TabsTrigger>
          <TabsTrigger 
            value="status"
            className="text-text-secondary data-[state=active]:bg-surface-default data-[state=active]:text-text-primary data-[state=active]:shadow-xs rounded-md text-xs font-medium"
          >
            System Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="mt-6">
          <LiveMonitoring />
        </TabsContent>

        <TabsContent value="status" className="mt-6 space-y-6">
          {/* User Information */}
          <Card className="bg-surface-default border-border-subtle shadow-card">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <CardTitle className="text-base text-text-primary flex items-center gap-2">
                <User className="h-4 w-4 text-action-primary" />
                Current User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-text-muted font-medium">Name</label>
                  <p className="text-text-primary font-semibold text-sm mt-0.5">{user?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-text-muted font-medium">Email</label>
                  <p className="text-text-primary font-semibold text-sm mt-0.5">{user?.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-text-muted font-medium">Role</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge 
                      variant={user?.role === 'admin' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      {user?.role || 'N/A'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-text-muted font-medium">User ID</label>
                  <p className="text-text-primary font-mono text-xs mt-0.5">{user?.id || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="bg-surface-default border-border-subtle shadow-card">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <CardTitle className="text-base text-text-primary flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-status-success" />
                System Components Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
                  <span className="text-xs font-medium text-text-primary">Frontend (Vite)</span>
                  <Badge variant="success" className="text-[11px]">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Running
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
                  <span className="text-xs font-medium text-text-primary">Backend (FastAPI)</span>
                  <Badge variant="success" className="text-[11px]">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Running
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
                  <span className="text-xs font-medium text-text-primary">Role-based Access Control</span>
                  <Badge variant="success" className="text-[11px]">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
                  <span className="text-xs font-medium text-text-primary">Biometric Analytics</span>
                  <Badge variant="success" className="text-[11px]">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LiveMonitoringPage;
