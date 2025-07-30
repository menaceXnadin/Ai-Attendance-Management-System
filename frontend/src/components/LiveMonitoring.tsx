import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Users, 
  Camera, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Wifi, 
  Server,
  Database,
  Zap,
  Eye,
  RefreshCw,
  Play,
  Pause,
  Square
} from 'lucide-react';

interface LiveMetrics {
  activeUsers: number;
  currentDetections: number;
  systemLoad: number;
  faceRecognitionAccuracy: number;
  databaseConnections: number;
  apiResponseTime: number;
  todayAttendance: number;
  cameraStatus: { online: number; offline: number; total: number };
}

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

const LiveMonitoring: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    activeUsers: 12,
    currentDetections: 3,
    systemLoad: 23,
    faceRecognitionAccuracy: 98.7,
    databaseConnections: 15,
    apiResponseTime: 145,
    todayAttendance: 87,
    cameraStatus: { online: 8, offline: 1, total: 9 }
  });

  const [alerts, setAlerts] = useState<SystemAlert[]>([
    {
      id: '1',
      type: 'warning',
      message: 'Camera offline in Classroom 3B',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      resolved: false
    },
    {
      id: '2',
      type: 'info',
      message: 'System backup completed successfully',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      resolved: true
    },
    {
      id: '3',
      type: 'error',
      message: 'High database response time detected',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      resolved: false
    }
  ]);

  // Simulate real-time data updates
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        activeUsers: Math.max(1, prev.activeUsers + Math.floor(Math.random() * 6 - 3)),
        currentDetections: Math.max(0, Math.floor(Math.random() * 8)),
        systemLoad: Math.max(10, Math.min(90, prev.systemLoad + Math.floor(Math.random() * 10 - 5))),
        faceRecognitionAccuracy: Math.max(95, Math.min(99.9, prev.faceRecognitionAccuracy + (Math.random() * 0.4 - 0.2))),
        databaseConnections: Math.max(5, prev.databaseConnections + Math.floor(Math.random() * 4 - 2)),
        apiResponseTime: Math.max(50, Math.min(500, prev.apiResponseTime + Math.floor(Math.random() * 50 - 25))),
        todayAttendance: Math.max(0, Math.min(100, prev.todayAttendance + Math.floor(Math.random() * 4 - 2)))
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [isMonitoring]);

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'bg-green-500';
    if (value >= thresholds.warning) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, resolved: true } : alert
    ));
  };

  const unreadAlerts = alerts.filter(alert => !alert.resolved);

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live System Monitoring</h2>
          <p className="text-slate-400">Real-time attendance system performance and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className={`${isMonitoring ? 'bg-green-500/20 text-green-300 border-green-400/30' : 'bg-red-500/20 text-red-300 border-red-400/30'}`}
          >
            <div className={`h-2 w-2 rounded-full mr-2 ${isMonitoring ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            {isMonitoring ? 'Live' : 'Paused'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            {isMonitoring ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isMonitoring ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Users */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Users</p>
                <div className="text-2xl font-bold text-blue-400">
                  {metrics.activeUsers}
                </div>
                <p className="text-xs text-slate-500">Currently online</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Face Detections */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Live Detections</p>
                <div className="text-2xl font-bold text-green-400">
                  {metrics.currentDetections}
                </div>
                <p className="text-xs text-slate-500">Face scans in progress</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Camera className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Load */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-orange-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">System Load</p>
                <div className={`text-2xl font-bold ${getStatusColor(100 - metrics.systemLoad, { good: 70, warning: 40 })}`}>
                  {metrics.systemLoad}%
                </div>
                <p className="text-xs text-slate-500">CPU utilization</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Server className="h-6 w-6 text-yellow-400" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={metrics.systemLoad} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Recognition Accuracy */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Recognition Accuracy</p>
                <div className="text-2xl font-bold text-purple-400">
                  {metrics.faceRecognitionAccuracy.toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500">AI model performance</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Eye className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Performance */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              System Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Database Connections</span>
                <span className="text-sm font-medium text-white">{metrics.databaseConnections}/50</span>
              </div>
              <Progress value={(metrics.databaseConnections / 50) * 100} className="h-2" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">API Response Time</span>
                <span className={`text-sm font-medium ${getStatusColor(500 - metrics.apiResponseTime, { good: 350, warning: 200 })}`}>
                  {metrics.apiResponseTime}ms
                </span>
              </div>
              <Progress value={(metrics.apiResponseTime / 500) * 100} className="h-2" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Today's Attendance Progress</span>
                <span className="text-sm font-medium text-white">{metrics.todayAttendance}%</span>
              </div>
              <Progress value={metrics.todayAttendance} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                System Alerts
              </CardTitle>
              {unreadAlerts.length > 0 && (
                <Badge className="bg-red-500/20 text-red-300">{unreadAlerts.length} active</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>All systems operating normally</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.type === 'error' ? 'border-red-500 bg-red-500/10' :
                    alert.type === 'warning' ? 'border-amber-500 bg-amber-500/10' :
                    'border-blue-500 bg-blue-500/10'
                  } ${alert.resolved ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {alert.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-400" />}
                        {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                        {alert.type === 'info' && <CheckCircle className="h-4 w-4 text-blue-400" />}
                        <span className={`text-sm font-medium ${alert.resolved ? 'line-through text-slate-500' : 'text-white'}`}>
                          {alert.message}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span className="text-xs text-slate-500">
                          {alert.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    {!alert.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveAlert(alert.id)}
                        className="ml-2 h-6 text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Camera Status Overview */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Camera className="h-5 w-5 text-green-400" />
            Camera Network Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {metrics.cameraStatus.online}
              </div>
              <div className="flex items-center justify-center gap-2 text-green-300">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">Online</span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400 mb-2">
                {metrics.cameraStatus.offline}
              </div>
              <div className="flex items-center justify-center gap-2 text-red-300">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">Offline</span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">
                {metrics.cameraStatus.total}
              </div>
              <div className="flex items-center justify-center gap-2 text-slate-300">
                <Camera className="h-4 w-4" />
                <span className="text-sm">Total Cameras</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Network Health</span>
              <span className="text-sm font-medium text-white">
                {Math.round((metrics.cameraStatus.online / metrics.cameraStatus.total) * 100)}%
              </span>
            </div>
            <Progress 
              value={(metrics.cameraStatus.online / metrics.cameraStatus.total) * 100} 
              className="h-3"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveMonitoring;
