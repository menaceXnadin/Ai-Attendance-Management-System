import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowSync16Regular,
  ArrowSync20Regular,
  CalendarLtr20Regular,
  CheckmarkCircle12Filled,
  Clock20Regular,
  Delete20Regular,
  Lightbulb20Regular,
  Warning12Filled
} from '@fluentui/react-icons';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';

interface CalendarGeneratorStats {
  total_days: number;
  class_days: number;
  holiday_days: number;
  events_created: number;
  events_skipped: number;
  errors: number;
}

interface GeneratorStatus {
  status: string;
  message: string;
  semester: {
    name: string;
    number: number;
    academic_year: number;
    start_date: string;
    end_date: string;
    is_current: boolean;
  } | null;
  coverage: {
    events_next_30_days: number;
    last_check: string;
    recommendation: string;
  } | null;
}

const CalendarGeneratorControl = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSemester, setIsGeneratingSemester] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [status, setStatus] = useState<GeneratorStatus | null>(null);
  const [lastStats, setLastStats] = useState<CalendarGeneratorStats | null>(null);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/calendar-generator/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  React.useEffect(() => {
    fetchStatus();
  }, []);

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/calendar-generator/auto-generate?days_ahead=30', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate calendar');
      }

      const data = await response.json();
      setLastStats(data.statistics);
      
      toast({
        title: "Calendar Generated Successfully",
        description: `Created ${data.statistics.events_created} events for the next 30 days`,
      });

      await fetchStatus();
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSemester = async () => {
    if (!confirm('This will generate events for the entire semester. Continue?')) {
      return;
    }

    setIsGeneratingSemester(true);
    try {
      const response = await fetch('/api/calendar-generator/generate-semester', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate semester calendar');
      }

      const data = await response.json();
      setLastStats(data.statistics);
      
      toast({
        title: "Full Semester Generated",
        description: `Created ${data.statistics.events_created} events for the entire semester`,
      });

      await fetchStatus();
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingSemester(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('This will remove events older than 90 days. Continue?')) {
      return;
    }

    setIsCleaning(true);
    try {
      const response = await fetch('/api/calendar-generator/cleanup-old-events?days_old=90', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup events');
      }

      const data = await response.json();
      
      toast({
        title: "Cleanup Complete",
        description: `Removed ${data.deleted_count} old events`,
      });

      await fetchStatus();
    } catch (error) {
      toast({
        title: "Cleanup Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const statusVariant: 'success' | 'warning' | 'destructive' =
    status?.status === 'active' ? 'success' : status?.status === 'warning' ? 'warning' : 'destructive';

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-surface-default shadow">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-border-subtle px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
            <CalendarLtr20Regular aria-hidden />
          </div>
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-subheading text-text-primary">
              Automatic Calendar Generator
            </CardTitle>
            <CardDescription className="text-body text-text-muted">
              Automatically generates class events based on your class schedules
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {/* Status Section */}
          {status && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-surface-subtle px-4 py-3">
                <div className="min-w-0 space-y-1.5">
                  <Badge variant={statusVariant} shape="pill" className="gap-1 capitalize">
                    {status.status === 'active' ? (
                      <CheckmarkCircle12Filled aria-hidden />
                    ) : (
                      <Warning12Filled aria-hidden />
                    )}
                    {status.status}
                  </Badge>
                  <p className="text-body text-text-secondary">{status.message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchStatus}
                  className="h-8 w-8 shrink-0 text-text-muted"
                  aria-label="Refresh generator status"
                  title="Refresh status"
                >
                  <ArrowSync20Regular aria-hidden />
                </Button>
              </div>

              {status.semester && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-md border border-border-subtle bg-surface-default p-4">
                    <p className="text-caption text-text-muted">Current Semester</p>
                    <p className="mt-0.5 text-subheading text-text-primary">{status.semester.name}</p>
                    <p className="text-caption tabular-nums text-text-secondary">
                      {new Date(status.semester.start_date).toLocaleDateString()} - {new Date(status.semester.end_date).toLocaleDateString()}
                    </p>
                  </div>

                  {status.coverage && (
                    <div className="rounded-md border border-border-subtle bg-surface-default p-4">
                      <p className="text-caption text-text-muted">Upcoming Coverage</p>
                      <p className="mt-0.5 text-subheading tabular-nums text-text-primary">
                        {status.coverage.events_next_30_days} events
                      </p>
                      <p className="text-caption text-text-secondary">
                        {status.coverage.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Last Generation Stats */}
          {lastStats && (
            <div className="rounded-md border border-status-info-border bg-status-info-subtle p-4">
              <p className="mb-3 text-body-strong text-text-primary">Last Generation Results</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <p className="flex items-center gap-1.5 text-caption text-text-muted">
                    <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden />
                    Events Created
                  </p>
                  <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{lastStats.events_created}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-caption text-text-muted">
                    <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                    Class Days
                  </p>
                  <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{lastStats.class_days}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-caption text-text-muted">
                    <span className="h-2 w-2 rounded-full bg-status-warning" aria-hidden />
                    Already Existing
                  </p>
                  <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{lastStats.events_skipped}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ArrowSync16Regular className="animate-spin" aria-hidden />
              ) : (
                <Clock20Regular aria-hidden />
              )}
              Generate Next 30 Days
            </Button>

            <Button
              onClick={handleGenerateSemester}
              disabled={isGeneratingSemester}
              variant="outline"
            >
              {isGeneratingSemester ? (
                <ArrowSync16Regular className="animate-spin" aria-hidden />
              ) : (
                <CalendarLtr20Regular aria-hidden />
              )}
              Generate Full Semester
            </Button>

            <Button
              onClick={handleCleanup}
              disabled={isCleaning}
              variant="outline"
              className="border-status-error-border text-status-error hover:bg-status-error-subtle hover:text-status-error"
            >
              {isCleaning ? (
                <ArrowSync16Regular className="animate-spin" aria-hidden />
              ) : (
                <Delete20Regular aria-hidden />
              )}
              Cleanup Old Events (90+ days)
            </Button>
          </div>

          {/* Info Section */}
          <div className="flex items-start gap-3 rounded-md bg-surface-subtle p-4">
            <Lightbulb20Regular className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
            <div className="space-y-1.5 text-body text-text-secondary">
              <p className="text-body-strong text-text-primary">How It Works:</p>
              <ul className="list-inside list-disc space-y-1 marker:text-text-muted">
                <li>Generates CLASS events based on your class_schedules table</li>
                <li>Automatically skips weekends and holidays</li>
                <li>Prevents duplicate events</li>
                <li>Should be run daily via scheduled task for best results</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarGeneratorControl;
