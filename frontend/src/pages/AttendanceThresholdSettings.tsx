import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Settings20Regular,
  Save20Regular,
  ArrowCounterclockwise20Regular,
  DataPie16Regular,
  Warning16Filled,
  CheckmarkCircle20Regular,
  Info16Filled,
} from '@fluentui/react-icons';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { useQueryClient } from '@tanstack/react-query';

interface AttendanceThreshold {
  id: number;
  name: string;
  min_percentage: number;
  max_percentage: number | null;
  color: string;
  badge_style: string;
  label: string;
  description: string;
  order: number;
  is_active: boolean;
}

const messageBarClass =
  'flex items-start gap-2 rounded-md px-3 py-2 text-body text-text-primary';

const AttendanceThresholdSettings: React.FC = () => {
  const [thresholds, setThresholds] = useState<AttendanceThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchThresholds = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.systemSettings.getAttendanceThresholds();
      setThresholds(response.sort((a: AttendanceThreshold, b: AttendanceThreshold) => a.order - b.order));
    } catch (error) {
      console.error('Error fetching thresholds:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance thresholds",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  const handleThresholdChange = (id: number, field: string, value: string | number | boolean | null) => {
    setThresholds(prevThresholds =>
      prevThresholds.map(threshold =>
        threshold.id === id ? { ...threshold, [field]: value } : threshold
      )
    );
    setHasChanges(true);
  };

  const saveThresholds = async () => {
    try {
      setSaving(true);

      // Validate thresholds
      const errors = validateThresholds(thresholds);
      if (errors.length > 0) {
        toast({
          title: "Validation Error",
          description: errors.join('. '),
          variant: "destructive",
        });
        return;
      }

      // Save each threshold
      for (const threshold of thresholds) {
        await api.systemSettings.updateAttendanceThreshold(threshold.id, {
          min_percentage: threshold.min_percentage,
          max_percentage: threshold.max_percentage,
          label: threshold.label,
          description: threshold.description,
        });
      }

      api.attendancePolicy.invalidate();
      void queryClient.invalidateQueries({ queryKey: ['attendance-policy'] });
      toast({
        title: "Success",
        description: "Attendance thresholds updated successfully",
      });
      setHasChanges(false);
      await fetchThresholds();
    } catch (error) {
      console.error('Error saving thresholds:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance thresholds",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all thresholds to default values? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await api.systemSettings.resetAttendanceThresholds();
      setThresholds(response.sort((a: AttendanceThreshold, b: AttendanceThreshold) => a.order - b.order));
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Thresholds reset to default values",
      });
    } catch (error) {
      console.error('Error resetting thresholds:', error);
      toast({
        title: "Error",
        description: "Failed to reset thresholds",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const validateThresholds = (thresholds: AttendanceThreshold[]): string[] => {
    const errors: string[] = [];

    // Check for overlapping ranges
    for (let i = 0; i < thresholds.length; i++) {
      for (let j = i + 1; j < thresholds.length; j++) {
        const t1 = thresholds[i];
        const t2 = thresholds[j];

        if (
          (t1.min_percentage <= t2.min_percentage &&
           (t1.max_percentage === null || t1.max_percentage >= t2.min_percentage)) ||
          (t2.min_percentage <= t1.min_percentage &&
           (t2.max_percentage === null || t2.max_percentage >= t1.min_percentage))
        ) {
          errors.push(`Overlapping ranges detected between ${t1.label} and ${t2.label}`);
        }
      }
    }

    // Check for gaps
    const sortedThresholds = [...thresholds].sort((a, b) => a.min_percentage - b.min_percentage);
    for (let i = 0; i < sortedThresholds.length - 1; i++) {
      const current = sortedThresholds[i];
      const next = sortedThresholds[i + 1];

      if (current.max_percentage !== null && current.max_percentage + 0.01 < next.min_percentage) {
        errors.push(`Gap detected between ${current.label} (${current.max_percentage}%) and ${next.label} (${next.min_percentage}%)`);
      }
    }

    // Check for invalid values
    thresholds.forEach(threshold => {
      if (threshold.min_percentage < 0 || threshold.min_percentage > 100) {
        errors.push(`${threshold.label}: min_percentage must be between 0 and 100`);
      }
      if (threshold.max_percentage !== null && (threshold.max_percentage < 0 || threshold.max_percentage > 100)) {
        errors.push(`${threshold.label}: max_percentage must be between 0 and 100`);
      }
      if (threshold.max_percentage !== null && threshold.min_percentage > threshold.max_percentage) {
        errors.push(`${threshold.label}: min_percentage cannot be greater than max_percentage`);
      }
    });

    return errors;
  };

  // Threshold color names from the API -> Fluent status tokens
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-status-info',
      green: 'bg-status-success',
      yellow: 'bg-status-warning',
      red: 'bg-status-error',
    };
    return colorMap[color] || 'bg-presence-offline';
  };

  const getTextColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'text-status-info',
      green: 'text-status-success',
      yellow: 'text-status-warning',
      red: 'text-status-error',
    };
    return colorMap[color] || 'text-text-secondary';
  };

  const getBadgeVariant = (color: string): 'info' | 'success' | 'warning' | 'destructive' | 'secondary' => {
    const variantMap: Record<string, 'info' | 'success' | 'warning' | 'destructive'> = {
      blue: 'info',
      green: 'success',
      yellow: 'warning',
      red: 'destructive',
    };
    return variantMap[color] || 'secondary';
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden></div>
          <p className="text-caption text-text-muted">Loading thresholds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-page-title text-text-primary">
          <Settings20Regular className="shrink-0 text-brand-foreground" aria-hidden />
          Attendance Threshold Settings
        </h1>
        <p className="text-body text-text-muted mt-1">
          Configure the attendance percentage thresholds for student performance categories
        </p>
      </div>

      {/* Info MessageBar */}
      <Alert className={`${messageBarClass} border-status-info-border bg-status-info-subtle`}>
        <span className="mt-0.5 shrink-0 text-status-info" aria-hidden><Info16Filled className="block" /></span>
        <AlertDescription className="text-body text-text-primary">
          Changes to attendance thresholds will be applied immediately across all dashboards and reports.
          Ensure percentage ranges don't overlap and cover all possible values (0-100%).
        </AlertDescription>
      </Alert>

      {/* Warning if changes exist */}
      {hasChanges && (
        <Alert className={`${messageBarClass} border-status-warning-border bg-status-warning-subtle`}>
          <span className="mt-0.5 shrink-0 text-status-warning" aria-hidden><Warning16Filled className="block" /></span>
          <AlertDescription className="text-body text-text-primary">
            You have unsaved changes. Click "Save Changes" to apply your modifications.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Threshold Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {thresholds.map((threshold) => (
            <Card key={threshold.id} className="border-0 shadow overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border-subtle px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-8 w-8 shrink-0 rounded-md ${getColorClass(threshold.color)} grid place-items-center text-text-inverse`}>
                    <DataPie16Regular aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-subheading text-text-primary">{threshold.label}</CardTitle>
                    <CardDescription className="text-caption text-text-muted">
                      Order: {threshold.order}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={getBadgeVariant(threshold.color)} shape="pill">
                  {threshold.label}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`min-${threshold.id}`} className="text-body-strong text-text-primary">
                      Minimum %
                    </Label>
                    <Input
                      id={`min-${threshold.id}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={threshold.min_percentage}
                      onChange={(e) => handleThresholdChange(threshold.id, 'min_percentage', parseFloat(e.target.value))}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`max-${threshold.id}`} className="text-body-strong text-text-primary">
                      Maximum % {threshold.max_percentage === null && <span className="font-normal text-text-muted">(No limit)</span>}
                    </Label>
                    <Input
                      id={`max-${threshold.id}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={threshold.max_percentage ?? ''}
                      onChange={(e) => handleThresholdChange(threshold.id, 'max_percentage', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="No upper limit"
                      className="tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`label-${threshold.id}`} className="text-body-strong text-text-primary">
                    Display Label
                  </Label>
                  <Input
                    id={`label-${threshold.id}`}
                    value={threshold.label}
                    onChange={(e) => handleThresholdChange(threshold.id, 'label', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`desc-${threshold.id}`} className="text-body-strong text-text-primary">
                    Description
                  </Label>
                  <Input
                    id={`desc-${threshold.id}`}
                    value={threshold.description}
                    onChange={(e) => handleThresholdChange(threshold.id, 'description', e.target.value)}
                  />
                </div>

                {/* Visual Range Indicator */}
                <div className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2">
                  <span className="text-caption text-text-muted">Range:</span>
                  <span className={`text-body-strong tabular-nums ${getTextColorClass(threshold.color)}`}>
                    {threshold.min_percentage}%
                    {threshold.max_percentage !== null ? ` - ${threshold.max_percentage}%` : '+'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Current Configuration Preview */}
        <Card className="h-fit border-0 shadow overflow-hidden lg:sticky lg:top-4">
          <CardHeader className="space-y-0.5 border-b border-border-subtle px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
              <CheckmarkCircle20Regular className="shrink-0 text-status-success" aria-hidden />
              Current Configuration
            </CardTitle>
            <CardDescription className="text-caption text-text-muted">Preview of how thresholds will be applied</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* 0-100% scale */}
            <div className="px-5 pt-4" aria-hidden>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                {thresholds.map((threshold) => {
                  const start = Math.max(0, Math.min(100, threshold.min_percentage || 0));
                  const end = Math.max(start, Math.min(100, threshold.max_percentage ?? 100));
                  return (
                    <div
                      key={threshold.id}
                      className={`absolute inset-y-0 ${getColorClass(threshold.color)}`}
                      style={{ left: `${start}%`, width: `${end - start}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-caption text-text-muted tabular-nums">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="divide-y divide-border-subtle py-2">
              {thresholds.map((threshold) => (
                <div key={threshold.id} className="flex items-center justify-between px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${getColorClass(threshold.color)}`}></div>
                    <span className="text-body text-text-primary">{threshold.label}</span>
                  </div>
                  <span className="text-caption text-text-muted tabular-nums">
                    {threshold.min_percentage}%{threshold.max_percentage !== null ? ` - ${threshold.max_percentage}%` : '+'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-lg border-t border-border-subtle bg-surface-default px-5 py-3 shadow-md">
        <Button
          onClick={resetToDefaults}
          variant="outline"
          disabled={saving}
        >
          <ArrowCounterclockwise20Regular aria-hidden />
          Reset to Defaults
        </Button>

        <Button
          onClick={saveThresholds}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-on border-t-transparent" aria-hidden></span>
              Saving...
            </>
          ) : (
            <>
              <Save20Regular aria-hidden />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AttendanceThresholdSettings;
