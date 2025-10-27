import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, RefreshCw, Trash2, Settings, CheckCircle, AlertTriangle } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            Automatic Calendar Generator
          </CardTitle>
          <CardDescription className="text-slate-400">
            Automatically generates class events based on your class schedules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Section */}
          {status && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={
                        status.status === 'active' 
                          ? 'bg-green-500/20 text-green-300 border-green-400/30'
                          : status.status === 'warning'
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'
                          : 'bg-red-500/20 text-red-300 border-red-400/30'
                      }
                    >
                      {status.status === 'active' ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      {status.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300">{status.message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchStatus}
                  className="text-slate-400 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {status.semester && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <p className="text-xs text-slate-400 mb-1">Current Semester</p>
                    <p className="text-lg font-semibold text-white">{status.semester.name}</p>
                    <p className="text-sm text-slate-400">
                      {new Date(status.semester.start_date).toLocaleDateString()} - {new Date(status.semester.end_date).toLocaleDateString()}
                    </p>
                  </div>

                  {status.coverage && (
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <p className="text-xs text-slate-400 mb-1">Upcoming Coverage</p>
                      <p className="text-lg font-semibold text-white">
                        {status.coverage.events_next_30_days} events
                      </p>
                      <p className="text-sm text-slate-400">
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
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-400/30">
              <p className="text-sm font-semibold text-blue-300 mb-2">Last Generation Results</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Events Created</p>
                  <p className="text-xl font-bold text-green-400">{lastStats.events_created}</p>
                </div>
                <div>
                  <p className="text-slate-400">Class Days</p>
                  <p className="text-xl font-bold text-blue-400">{lastStats.class_days}</p>
                </div>
                <div>
                  <p className="text-slate-400">Already Existing</p>
                  <p className="text-xl font-bold text-yellow-400">{lastStats.events_skipped}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-2" />
              )}
              Generate Next 30 Days
            </Button>

            <Button
              onClick={handleGenerateSemester}
              disabled={isGeneratingSemester}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              {isGeneratingSemester ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Generate Full Semester
            </Button>

            <Button
              onClick={handleCleanup}
              disabled={isCleaning}
              variant="outline"
              className="w-full border-red-600 text-red-400 hover:bg-red-950"
            >
              {isCleaning ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Cleanup Old Events (90+ days)
            </Button>
          </div>

          {/* Info Section */}
          <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/50">
            <div className="flex items-start gap-2">
              <Settings className="h-5 w-5 text-slate-400 mt-0.5" />
              <div className="space-y-2 text-sm text-slate-400">
                <p className="font-semibold text-slate-300">How It Works:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Generates CLASS events based on your class_schedules table</li>
                  <li>Automatically skips weekends and holidays</li>
                  <li>Prevents duplicate events</li>
                  <li>Should be run daily via scheduled task for best results</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarGeneratorControl;
