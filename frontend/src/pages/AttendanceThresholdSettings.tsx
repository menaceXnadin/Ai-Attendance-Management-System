import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Percent, 
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';

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

const AttendanceThresholdSettings: React.FC = () => {
  const [thresholds, setThresholds] = useState<AttendanceThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

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

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
    };
    return colorMap[color] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          <Settings className="h-8 w-8 text-blue-400" />
          Attendance Threshold Settings
        </h1>
        <p className="text-slate-400 mt-2">
          Configure the attendance percentage thresholds for student performance categories
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6 bg-blue-500/10 border-blue-500/30">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-300">
          Changes to attendance thresholds will be applied immediately across all dashboards and reports.
          Ensure percentage ranges don't overlap and cover all possible values (0-100%).
        </AlertDescription>
      </Alert>

      {/* Warning if changes exist */}
      {hasChanges && (
        <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/30">
          <AlertTriangle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-yellow-300">
            You have unsaved changes. Click "Save Changes" to apply your modifications.
          </AlertDescription>
        </Alert>
      )}

      {/* Threshold Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {thresholds.map((threshold) => (
          <Card key={threshold.id} className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg ${getColorClass(threshold.color)} flex items-center justify-center`}>
                    <Percent className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-100">{threshold.label}</CardTitle>
                    <CardDescription className="text-slate-400 text-sm">
                      Order: {threshold.order}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={threshold.badge_style}>
                  {threshold.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`min-${threshold.id}`} className="text-slate-300">
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
                    className="bg-slate-700/50 border-slate-600 text-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor={`max-${threshold.id}`} className="text-slate-300">
                    Maximum % {threshold.max_percentage === null && '(No limit)'}
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
                    className="bg-slate-700/50 border-slate-600 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`label-${threshold.id}`} className="text-slate-300">
                  Display Label
                </Label>
                <Input
                  id={`label-${threshold.id}`}
                  value={threshold.label}
                  onChange={(e) => handleThresholdChange(threshold.id, 'label', e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-slate-100"
                />
              </div>

              <div>
                <Label htmlFor={`desc-${threshold.id}`} className="text-slate-300">
                  Description
                </Label>
                <Input
                  id={`desc-${threshold.id}`}
                  value={threshold.description}
                  onChange={(e) => handleThresholdChange(threshold.id, 'description', e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-slate-100"
                />
              </div>

              {/* Visual Range Indicator */}
              <div className="pt-2">
                <div className="text-xs text-slate-400 mb-1">Range:</div>
                <div className="h-8 bg-slate-700/30 rounded-lg flex items-center justify-center">
                  <span className={`text-sm font-medium text-${threshold.color}-300`}>
                    {threshold.min_percentage}% 
                    {threshold.max_percentage !== null ? ` - ${threshold.max_percentage}%` : '+'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          onClick={resetToDefaults}
          variant="outline"
          disabled={saving}
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>

        <Button
          onClick={saveThresholds}
          disabled={!hasChanges || saving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Current Configuration Preview */}
      <Card className="mt-6 bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            Current Configuration
          </CardTitle>
          <CardDescription>Preview of how thresholds will be applied</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {thresholds.map((threshold) => (
              <div key={threshold.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${getColorClass(threshold.color)}`}></div>
                  <span className="text-slate-200 font-medium">{threshold.label}</span>
                </div>
                <span className="text-slate-400 text-sm">
                  {threshold.min_percentage}%{threshold.max_percentage !== null ? ` - ${threshold.max_percentage}%` : '+'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceThresholdSettings;
