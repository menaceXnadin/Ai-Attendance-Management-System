import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PlayFilledAlt, 
  Renew, 
  CheckmarkFilled, 
  CloseFilled, 
  Time, 
  UserMultiple, 
  Book, 
  WarningAlt,
  Information,
  Activity,
  Calendar,
  Settings
} from '@carbon/icons-react';
import { apiClient } from '@/integrations/api/client';

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
  const [status, setStatus] = useState<AutoAbsentStatus | null>(null);
  const [lastTrigger, setLastTrigger] = useState<TriggerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch status on component mount and periodically
  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<AutoAbsentStatus>('/auto-absent/status');
      setStatus(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch auto-absent status');
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoAbsent = async () => {
    setTriggerLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiClient.post<TriggerResponse>('/auto-absent/trigger');
      setLastTrigger(response.data);
      setSuccess(response.data.message);
      setTimeout(() => void fetchStatus(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger auto-absent process');
    } finally {
      setTriggerLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Activity size={24} className="text-action-primary" />
            Auto-Absent Automation
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Monitor and execute scheduled automated absent tracking for completed classes
          </p>
        </div>
        <Button 
          onClick={fetchStatus}
          variant="outline"
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Renew size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Status</span>
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs">
          <WarningAlt size={16} />
          <AlertDescription className="ml-2 font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border border-status-success/30 bg-status-success/10 text-status-success text-xs">
          <CheckmarkFilled size={16} />
          <AlertDescription className="ml-2 font-medium">{success}</AlertDescription>
        </Alert>
      )}

      {/* System Status Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Automation Rule</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {status?.auto_absent_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center">
                {status?.auto_absent_enabled ? (
                  <CheckmarkFilled size={20} className="text-status-success" />
                ) : (
                  <CloseFilled size={20} className="text-status-danger" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Schedule Window</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {status?.in_schedule_window ? 'Active' : 'Inactive'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{status?.schedule_window || '—'}</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                <Time size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Pending Classes</p>
                <p className="text-xl font-bold text-text-primary tabular-nums mt-1">
                  {status?.expired_classes_ready_to_process ?? '—'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">Ready for processing</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-status-warning">
                <Book size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Last Batch Records</p>
                <p className="text-xl font-bold text-text-primary tabular-nums mt-1">
                  {lastTrigger ? lastTrigger.records_created : '—'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">Absents created</p>
              </div>
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-text-muted">
                <UserMultiple size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Status Details */}
      <Card className="border border-border-default bg-surface-default shadow-none">
        <CardHeader className="py-4 border-b border-border-subtle">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Information size={16} className="text-action-primary" />
            Active Schedule Runtime
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Telemetry from the background worker and schedule orchestrator
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-surface-subtle rounded-md border border-border-subtle">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Current Clock</span>
                <Calendar size={14} className="text-text-muted" />
              </div>
              <p className="text-sm font-mono font-medium text-text-primary">
                {status?.current_time || 'Synchronizing...'}
              </p>
            </div>

            <div className="p-3 bg-surface-subtle rounded-md border border-border-subtle">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Next Run</span>
                <Time size={14} className="text-text-muted" />
              </div>
              <p className="text-sm font-mono font-medium text-text-primary">
                {status?.next_scheduled_run || 'Synchronizing...'}
              </p>
            </div>
          </div>

          <div className="p-3 bg-surface-subtle rounded-md border border-border-subtle">
            <div className="flex items-center gap-1.5 mb-1">
              <Settings size={14} className="text-text-muted" />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Daemon Policy Configuration</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {status?.notes || 'Loading policy specifications...'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Trigger Section */}
      <Card className="border border-border-default bg-surface-default shadow-none">
        <CardHeader className="py-4 border-b border-border-subtle">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
            <PlayFilledAlt size={16} className="text-action-primary" />
            Manual Execution Trigger
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Immediately trigger the auto-absent worker without waiting for the next cron interval
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="p-3 rounded-md bg-surface-subtle border border-border-subtle text-xs text-text-secondary flex items-start gap-2.5">
            <Information size={16} className="text-action-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This routine scans all courses whose scheduled periods have concluded. Enrolled students without an existing attendance entry for today are marked as absent. Scheduled institutional holidays and authorized class cancellations are respected and skipped.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={triggerAutoAbsent}
              disabled={triggerLoading || !status?.auto_absent_enabled}
              className="flex items-center gap-2"
            >
              {triggerLoading ? (
                <>
                  <Renew size={14} className="animate-spin" />
                  <span>Processing Classes...</span>
                </>
              ) : (
                <>
                  <PlayFilledAlt size={14} />
                  <span>Run Auto-Absent Routine</span>
                </>
              )}
            </Button>

            <div className="text-xs text-text-muted">
              {status?.expired_classes_ready_to_process ? (
                <span className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs text-status-warning border-status-warning/30 bg-status-warning/10">
                    {status.expired_classes_ready_to_process} classes
                  </Badge>
                  eligible for immediate processing
                </span>
              ) : (
                <span>No ended classes awaiting processing</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Trigger Results */}
      {lastTrigger && (
        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardHeader className="py-4 border-b border-border-subtle">
            <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
              <CheckmarkFilled size={16} className="text-status-success" />
              Latest Execution Output
            </CardTitle>
            <CardDescription className="text-xs text-text-muted">
              Summary report generated from the most recent run
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-surface-subtle rounded-md border border-border-subtle">
                <p className="text-xs text-text-muted mb-1">Execution Status</p>
                <div className="flex items-center gap-1.5">
                  {lastTrigger.success ? (
                    <>
                      <CheckmarkFilled size={16} className="text-status-success" />
                      <span className="text-sm font-semibold text-status-success">Success</span>
                    </>
                  ) : (
                    <>
                      <CloseFilled size={16} className="text-status-danger" />
                      <span className="text-sm font-semibold text-status-danger">Failed</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 bg-surface-subtle rounded-md border border-border-subtle">
                <p className="text-xs text-text-muted mb-1">Courses Processed</p>
                <p className="text-xl font-bold text-text-primary tabular-nums">
                  {lastTrigger.expired_classes_processed}
                </p>
              </div>

              <div className="p-3 bg-surface-subtle rounded-md border border-border-subtle">
                <p className="text-xs text-text-muted mb-1">Absents Generated</p>
                <p className="text-xl font-bold text-text-primary tabular-nums">
                  {lastTrigger.records_created}
                </p>
              </div>
            </div>

            {lastTrigger.records_created === 0 && Boolean(lastTrigger.students_already_marked) && (
              <div className="p-3 rounded-md bg-surface-subtle border border-border-subtle text-xs text-text-secondary">
                <strong className="text-text-primary">No new entries needed: </strong>
                {lastTrigger.students_already_marked} student records were already recorded earlier today. Duplicate prevention ensured integrity.
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-text-muted gap-2 pt-2 border-t border-border-subtle">
              <span>{lastTrigger.message}</span>
              <span className="font-mono">{new Date(lastTrigger.timestamp).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works Guidelines */}
      <Card className="border border-border-default bg-surface-default shadow-none">
        <CardHeader className="py-4 border-b border-border-subtle">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Information size={16} className="text-text-muted" />
            Automation Rules & Safeguards
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
                <Time size={16} />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-text-primary">Strict Class Periods</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Classes expire precisely when their scheduled end time passes. Attendance must be logged during the active session.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-status-success shrink-0">
                <Calendar size={16} />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-text-primary">Academic Calendar Sync</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Recognized holidays and teacher-cancelled sessions are automatically bypassed to protect student records.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
                <Activity size={16} />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-text-primary">Periodic Polling</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  The automated task executes every 30 minutes within operational operational campus hours (07:00 – 20:00).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-status-warning shrink-0">
                <UserMultiple size={16} />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-text-primary">Idempotent Recording</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Only students with zero recorded status for the target session receive an absent entry, preventing overwrites.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoAbsentManagementPage;
