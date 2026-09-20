import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { LogOut, User, Shield, CheckCircle } from 'lucide-react';

const SystemStatusPage: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-surface-canvas p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1">System Status</h1>
            <p className="text-xs sm:text-sm text-text-muted">Current application status and user session</p>
          </div>
          <Button 
            onClick={signOut}
            variant="outline" 
            size="sm"
            className="border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

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
                <span className="text-xs font-medium text-text-primary">Frontend (Vite + React)</span>
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
                <span className="text-xs font-medium text-text-primary">Attendance & Biometrics</span>
                <Badge variant="success" className="text-[11px]">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <Card className="bg-surface-default border-border-subtle shadow-card">
          <CardHeader className="pb-3 border-b border-border-subtle">
            <CardTitle className="text-base text-text-primary">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex gap-3 flex-wrap">
              <Button 
                onClick={() => window.location.href = user?.role === 'admin' ? '/app' : user?.role === 'faculty' ? '/teacher' : '/student'}
                size="sm"
                className="bg-action-primary hover:bg-action-primary-hover text-white"
              >
                Go to Dashboard
              </Button>
              {user?.role === 'admin' && (
                <>
                  <Button 
                    onClick={() => window.location.href = '/app/analytics'}
                    size="sm"
                    variant="outline"
                    className="border-border-default hover:bg-surface-subtle"
                  >
                    System Analytics
                  </Button>
                  <Button 
                    onClick={() => window.location.href = '/app/monitoring'}
                    size="sm"
                    variant="outline"
                    className="border-border-default hover:bg-surface-subtle"
                  >
                    Live Monitoring
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemStatusPage;
