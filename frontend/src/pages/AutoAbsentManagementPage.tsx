import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/useAuth';
import { 
  PlayCircle, 
  RefreshCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  BookOpen, 
  AlertTriangle,
  Info,
  Activity,
  Calendar,
  Settings
} from 'lucide-react';

interface AutoAbsentStatus {
  auto_absent_enabled: boolean;
  current_time: string;
  in_schedule_window: boolean;
  schedule_window: string;
  expired_classes_ready_to_process: number;
  next_scheduled_run: string;
  notes: string;
}

interface TriggerResponse {
  success: boolean;
  message: string;
  records_created: number;
  expired_classes_processed: number;
  students_already_marked?: number;
  timestamp: string;
}

const AutoAbsentManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<AutoAbsentStatus | null>(null);
  const [lastTrigger, setLastTrigger] = useState<TriggerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const API_BASE = 'http://localhost:8000/api';

  // Fetch status on component mount and periodically
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/auto-absent/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      console.error('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoAbsent = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    setTriggerLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`${API_BASE}/auto-absent/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger auto-absent: ${response.statusText}`);
      }

      const data: TriggerResponse = await response.json();
      setLastTrigger(data);
      setSuccess(data.message);
      
      // Refresh status after triggering
      setTimeout(() => fetchStatus(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger auto-absent');
      console.error('Trigger error:', err);
    } finally {
      setTriggerLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="w-full">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-400" />
              Auto-Absent Management
            </h1>
            <p className="text-slate-400">Monitor and control the automatic absent marking system</p>
          </div>
          <Button 
            onClick={fetchStatus}
            variant="outline"
            disabled={loading}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="bg-red-500/10 border-red-500/50 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert className="bg-green-500/10 border-green-500/50 text-green-400">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* System Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">System Status</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {status?.auto_absent_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${status?.auto_absent_enabled ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {status?.auto_absent_enabled ? (
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-400" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Schedule Window</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {status?.in_schedule_window ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{status?.schedule_window}</p>
                </div>
                <div className={`p-3 rounded-lg ${status?.in_schedule_window ? 'bg-blue-500/20' : 'bg-slate-500/20'}`}>
                  <Clock className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Expired Classes</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {status?.expired_classes_ready_to_process ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Ready to process</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/20">
                  <BookOpen className="h-6 w-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Last Trigger</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {lastTrigger ? `${lastTrigger.records_created}` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Records created</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <Users className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Status Details */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-400" />
              Current System Status
            </CardTitle>
            <CardDescription className="text-slate-400">
              Real-time information about the auto-absent system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Current Time</span>
                  <Calendar className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-lg font-semibold text-white">
                  {status?.current_time || 'Loading...'}
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Next Scheduled Run</span>
                  <Clock className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-lg font-semibold text-white">
                  {status?.next_scheduled_run || 'Loading...'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-400">System Configuration</span>
              </div>
              <p className="text-sm text-slate-300">
                {status?.notes || 'Loading system configuration...'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Manual Trigger Section */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-blue-400" />
              Manual Trigger
            </CardTitle>
            <CardDescription className="text-slate-400">
              Immediately process all expired classes and mark absent students
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-500/10 border-blue-500/50 text-blue-400">
              <Info className="h-4 w-4" />
              <AlertDescription>
                This will process all classes that have ended (past their end time) and automatically 
                mark students as absent if they haven't marked attendance. The system respects 
                holidays and cancellations.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-4">
              <Button
                onClick={triggerAutoAbsent}
                disabled={triggerLoading || !status?.auto_absent_enabled}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {triggerLoading ? (
                  <>
                    <RefreshCcw className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Trigger Auto-Absent Now
                  </>
                )}
              </Button>

              <div className="text-sm text-slate-400">
                {status?.expired_classes_ready_to_process ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                      {status.expired_classes_ready_to_process} classes
                    </Badge>
                    ready to process
                  </span>
                ) : (
                  <span className="text-slate-500">No expired classes to process</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Trigger Results */}
        {lastTrigger && (
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                Last Trigger Results
              </CardTitle>
              <CardDescription className="text-slate-400">
                Results from the most recent manual trigger
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    {lastTrigger.success ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-lg font-semibold text-green-400">Success</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="text-lg font-semibold text-red-400">Failed</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Classes Processed</p>
                  <p className="text-2xl font-bold text-white">
                    {lastTrigger.expired_classes_processed}
                  </p>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">New Records Created</p>
                  <p className="text-2xl font-bold text-white">
                    {lastTrigger.records_created}
                  </p>
                </div>
              </div>

              {/* Show already marked info if no new records */}
              {lastTrigger.records_created === 0 && lastTrigger.students_already_marked && (
                <Alert className="mt-4 bg-blue-500/10 border-blue-500/50 text-blue-400">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>No duplicates created.</strong> {lastTrigger.students_already_marked} students 
                    already had attendance records from previous processing (either manual attendance or 
                    previous auto-absent runs). The system prevents duplicate records.
                  </AlertDescription>
                </Alert>
              )}

              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Message</p>
                <p className="text-sm text-slate-300">{lastTrigger.message}</p>
              </div>

              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Timestamp</p>
                <p className="text-sm text-slate-300">
                  {new Date(lastTrigger.timestamp).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information Section */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-slate-400" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg mt-0.5">
                <Clock className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">No Grace Period</h4>
                <p className="text-sm text-slate-400">
                  Attendance must be marked within the class period. Classes expire exactly at their end time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg mt-0.5">
                <Calendar className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">Holiday Awareness</h4>
                <p className="text-sm text-slate-400">
                  Full-day holidays are automatically skipped. Subject-specific cancellations are excluded.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg mt-0.5">
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">Automatic Schedule</h4>
                <p className="text-sm text-slate-400">
                  Runs automatically every 30 minutes between 07:00 and 20:00 when enabled.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg mt-0.5">
                <Users className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">Smart Processing</h4>
                <p className="text-sm text-slate-400">
                  Only marks students who don't have any attendance record for the class. Prevents duplicates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default AutoAbsentManagementPage;
