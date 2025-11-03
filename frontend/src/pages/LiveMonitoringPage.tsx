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
    <div className="p-6 md:p-8">
      <div className="w-full space-y-6">
        <Tabs defaultValue="monitoring" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger 
              value="monitoring"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
            >
              Live Monitoring
            </TabsTrigger>
            <TabsTrigger 
              value="status"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500"
            >
              System Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring" className="mt-6">
            <LiveMonitoring />
          </TabsContent>

          <TabsContent value="status" className="mt-6 space-y-6">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LiveMonitoringPage;
