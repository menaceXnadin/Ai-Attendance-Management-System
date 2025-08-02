import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { LogOut, User, Shield, CheckCircle } from 'lucide-react';

const SystemStatusPage: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">System Status</h1>
            <p className="text-slate-400">Current application status and user information</p>
          </div>
          <Button 
            onClick={signOut}
            variant="outline" 
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* User Information */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" />
              Current User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">Name</label>
                <p className="text-white font-medium">{user?.name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Email</label>
                <p className="text-white font-medium">{user?.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Role</label>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`${
                      user?.role === 'admin' 
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' 
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                    }`}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {user?.role || 'N/A'}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400">User ID</label>
                <p className="text-white font-medium">{user?.id || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              System Components Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Frontend (Vite)</span>
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Running
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Backend (FastAPI)</span>
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Running
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Role-based Access Control</span>
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Student Personal Analytics</span>
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Implemented
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role-specific Features */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white">Available Features by Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.role === 'admin' ? (
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-purple-400">Admin Features</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>System-wide Analytics</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Live Monitoring</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>User Management</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>System Settings</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-blue-400">Student Features</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Personal Analytics</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Attendance Reports</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Grade Reports</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Profile Management</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Button 
                onClick={() => window.location.href = user?.role === 'admin' ? '/app' : '/student-dashboard'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Go to Dashboard
              </Button>
              {user?.role === 'admin' && (
                <>
                  <Button 
                    onClick={() => window.location.href = '/app/analytics'}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    System Analytics
                  </Button>
                  <Button 
                    onClick={() => window.location.href = '/app/monitoring'}
                    className="bg-green-600 hover:bg-green-700"
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
