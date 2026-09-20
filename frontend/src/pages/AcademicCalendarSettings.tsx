import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  WarningAlt, 
  Renew, 
  Information, 
  CheckmarkFilled,
  Save,
  Close
} from '@carbon/icons-react';
import { toast } from 'sonner';
import { apiClient } from '@/integrations/api/client';

interface DateBoundary {
  month: number;
  day: number;
}

interface CalendarOverride {
  id: number;
  fall_start: DateBoundary;
  fall_end: DateBoundary;
  spring_start: DateBoundary;
  spring_end: DateBoundary;
  is_override_active: boolean;
  reason: string;
  effective_from: string;
  effective_until: string | null;
  is_emergency_override: boolean;
  emergency_contact_email: string | null;
  created_at: string;
}

interface CurrentConfig {
  fall_start: [number, number];
  fall_end: [number, number];
  spring_start: [number, number];
  spring_end: [number, number];
  is_override_active: boolean;
  defaults: {
    fall_start: [number, number];
    fall_end: [number, number];
    spring_start: [number, number];
    spring_end: [number, number];
  };
  override_details: CalendarOverride | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AcademicCalendarSettings: React.FC = () => {
  const [currentConfig, setCurrentConfig] = useState<CurrentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    fallStartMonth: 8,
    fallStartDay: 1,
    fallEndMonth: 12,
    fallEndDay: 15,
    springStartMonth: 1,
    springStartDay: 15,
    springEndMonth: 5,
    springEndDay: 30,
    reason: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveUntil: '',
    isEmergency: false,
    emergencyEmail: ''
  });

  useEffect(() => {
    fetchCurrentConfig();
  }, []);

  const fetchCurrentConfig = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<CurrentConfig>('/admin/academic-calendar/current');
      setCurrentConfig(res.data);
    } catch (error) {
      console.error('Failed to fetch calendar config:', error);
      toast.error('Failed to load calendar configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOverride = async () => {
    if (formData.reason.length < 10) {
      toast.error('Reason must be at least 10 characters');
      return;
    }

    try {
      await apiClient.post('/admin/academic-calendar/override', {
        fall_start: { month: formData.fallStartMonth, day: formData.fallStartDay },
        fall_end: { month: formData.fallEndMonth, day: formData.fallEndDay },
        spring_start: { month: formData.springStartMonth, day: formData.springStartDay },
        spring_end: { month: formData.springEndMonth, day: formData.springEndDay },
        reason: formData.reason,
        effective_from: formData.effectiveFrom,
        effective_until: formData.effectiveUntil || null,
        is_emergency_override: formData.isEmergency,
        emergency_contact_email: formData.emergencyEmail || null
      });
      
      toast.success('Emergency calendar override activated');
      setShowOverrideForm(false);
      fetchCurrentConfig();
    } catch (error: unknown) {
      console.error('Failed to create override:', error);
      const message = error instanceof Error ? error.message : 'Failed to create override';
      toast.error(message);
    }
  };

  const handleResetToDefaults = async () => {
    if (!currentConfig?.override_details) return;
    
    if (!confirm('Reset to default calendar dates? This will affect the entire system.')) {
      return;
    }

    try {
      await apiClient.delete(`/admin/academic-calendar/override/${currentConfig.override_details.id}`);
      toast.success('Calendar reset to defaults');
      fetchCurrentConfig();
    } catch (error) {
      console.error('Failed to reset calendar:', error);
      toast.error('Failed to reset calendar');
    }
  };

  const formatMonthDay = (tuple: [number, number]) => {
    return `${MONTHS[tuple[0] - 1]} ${tuple[1]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <Renew className="w-5 h-5 animate-spin text-action-primary" />
          <span>Loading academic calendar configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Configuration */}
      <Card className="border border-border-subtle shadow-card bg-surface-default">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="flex items-center justify-between text-base font-semibold text-text-primary">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-action-primary" />
              Active Academic Calendar Configuration
            </span>
            {currentConfig?.is_override_active ? (
              <Badge variant="warning" className="flex items-center gap-1.5 px-2.5 py-1">
                <WarningAlt className="w-3.5 h-3.5" />
                Override Active
              </Badge>
            ) : (
              <Badge variant="success" className="flex items-center gap-1.5 px-2.5 py-1">
                <CheckmarkFilled className="w-3.5 h-3.5" />
                Default Configuration
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fall Semester */}
            <div className="space-y-4 p-4 bg-surface-canvas rounded-lg border border-border-subtle">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-warning"></span>
                  Fall Semester
                </h3>
                <span className="text-xs font-mono text-text-muted">TERM 1</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
                  <span className="text-text-muted">Semester Start:</span>
                  <span className="font-medium text-text-primary">
                    {currentConfig && formatMonthDay(currentConfig.fall_start)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-text-muted">Semester End:</span>
                  <span className="font-medium text-text-primary">
                    {currentConfig && formatMonthDay(currentConfig.fall_end)}
                  </span>
                </div>
              </div>
            </div>

            {/* Spring Semester */}
            <div className="space-y-4 p-4 bg-surface-canvas rounded-lg border border-border-subtle">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-success"></span>
                  Spring Semester
                </h3>
                <span className="text-xs font-mono text-text-muted">TERM 2</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
                  <span className="text-text-muted">Semester Start:</span>
                  <span className="font-medium text-text-primary">
                    {currentConfig && formatMonthDay(currentConfig.spring_start)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-text-muted">Semester End:</span>
                  <span className="font-medium text-text-primary">
                    {currentConfig && formatMonthDay(currentConfig.spring_end)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Override Details */}
          {currentConfig?.override_details && (
            <div className="mt-6 p-4 bg-status-warning/5 border border-status-warning/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-status-warning font-semibold text-sm">
                <WarningAlt className="w-4 h-4" />
                Active Override Information
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-text-muted">Reason:</span>
                  <span className="text-text-primary font-medium text-right">{currentConfig.override_details.reason}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Effective From:</span>
                  <span className="text-text-primary font-mono text-xs">
                    {new Date(currentConfig.override_details.effective_from).toLocaleDateString()}
                  </span>
                </div>
                {currentConfig.override_details.effective_until && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Expires:</span>
                    <span className="text-text-primary font-mono text-xs">
                      {new Date(currentConfig.override_details.effective_until).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border-subtle">
            <Button
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              variant={showOverrideForm ? 'secondary' : 'default'}
              size="sm"
            >
              <WarningAlt className="w-4 h-4 mr-1.5" />
              {showOverrideForm ? 'Close Override Form' : 'Create Emergency Override'}
            </Button>

            {currentConfig?.is_override_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefaults}
              >
                <Renew className="w-4 h-4 mr-1.5" />
                Reset to Defaults
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Override Form */}
      {showOverrideForm && (
        <Card className="border border-border-subtle shadow-card bg-surface-default">
          <CardHeader className="border-b border-border-subtle pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                <WarningAlt className="w-5 h-5 text-status-warning" />
                Create Emergency Calendar Override
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowOverrideForm(false)}
                aria-label="Close form"
              >
                <Close className="w-4 h-4 text-text-muted" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Date Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fall Dates */}
              <div className="space-y-4 p-4 rounded-lg border border-border-subtle bg-surface-canvas">
                <h3 className="font-semibold text-sm text-text-primary">Fall Semester Schedule</h3>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted">Start Date</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.fallStartMonth}
                      onChange={(e) => setFormData({ ...formData, fallStartMonth: parseInt(e.target.value) })}
                      className="flex-1 h-9 px-3 rounded-md bg-surface-default border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-action-primary"
                    >
                      {MONTHS.map((month, idx) => (
                        <option key={idx} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.fallStartDay}
                      onChange={(e) => setFormData({ ...formData, fallStartDay: parseInt(e.target.value) })}
                      className="w-20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted">End Date</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.fallEndMonth}
                      onChange={(e) => setFormData({ ...formData, fallEndMonth: parseInt(e.target.value) })}
                      className="flex-1 h-9 px-3 rounded-md bg-surface-default border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-action-primary"
                    >
                      {MONTHS.map((month, idx) => (
                        <option key={idx} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.fallEndDay}
                      onChange={(e) => setFormData({ ...formData, fallEndDay: parseInt(e.target.value) })}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>

              {/* Spring Dates */}
              <div className="space-y-4 p-4 rounded-lg border border-border-subtle bg-surface-canvas">
                <h3 className="font-semibold text-sm text-text-primary">Spring Semester Schedule</h3>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted">Start Date</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.springStartMonth}
                      onChange={(e) => setFormData({ ...formData, springStartMonth: parseInt(e.target.value) })}
                      className="flex-1 h-9 px-3 rounded-md bg-surface-default border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-action-primary"
                    >
                      {MONTHS.map((month, idx) => (
                        <option key={idx} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.springStartDay}
                      onChange={(e) => setFormData({ ...formData, springStartDay: parseInt(e.target.value) })}
                      className="w-20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted">End Date</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.springEndMonth}
                      onChange={(e) => setFormData({ ...formData, springEndMonth: parseInt(e.target.value) })}
                      className="flex-1 h-9 px-3 rounded-md bg-surface-default border border-border-subtle text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-action-primary"
                    >
                      {MONTHS.map((month, idx) => (
                        <option key={idx} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.springEndDay}
                      onChange={(e) => setFormData({ ...formData, springEndDay: parseInt(e.target.value) })}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted">Reason for Override (minimum 10 characters)</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Unscheduled emergency delay, revised institutional calendar requirement"
                rows={3}
                className="w-full p-3 rounded-md bg-surface-default border border-border-subtle text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
              />
            </div>

            {/* Effective Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted">Effective From</label>
                <Input
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted">Effective Until (optional)</label>
                <Input
                  type="date"
                  value={formData.effectiveUntil}
                  onChange={(e) => setFormData({ ...formData, effectiveUntil: e.target.value })}
                />
              </div>
            </div>

            {/* Emergency Flag */}
            <div className="flex items-center gap-3 p-3 bg-surface-canvas border border-border-subtle rounded-md">
              <input
                type="checkbox"
                id="isEmergency"
                checked={formData.isEmergency}
                onChange={(e) => setFormData({ ...formData, isEmergency: e.target.checked })}
                className="h-4 w-4 rounded border-border-subtle text-action-primary focus:ring-action-primary"
              />
              <label htmlFor="isEmergency" className="text-sm font-medium text-text-primary cursor-pointer">
                Mark as Emergency Override (Severe weather, emergency disruption, etc.)
              </label>
            </div>

            {/* Emergency Email */}
            {formData.isEmergency && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-muted">Emergency Contact Email</label>
                <Input
                  type="email"
                  value={formData.emergencyEmail}
                  onChange={(e) => setFormData({ ...formData, emergencyEmail: e.target.value })}
                  placeholder="emergency@institution.edu"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCreateOverride}
                size="sm"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Activate Override
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOverrideForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Default Values Reference */}
      <Card className="border border-border-subtle shadow-card bg-surface-default">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Information className="w-4 h-4 text-action-primary" />
            Standard Academic Calendar Baseline (Reference)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2.5 p-3 rounded-md bg-surface-canvas border border-border-subtle">
              <CheckmarkFilled className="w-4 h-4 text-status-success flex-shrink-0" />
              <div>
                <span className="font-medium text-text-primary">Fall Semester:</span>{' '}
                <span className="text-text-secondary">
                  {currentConfig && formatMonthDay(currentConfig.defaults.fall_start)} –{' '}
                  {currentConfig && formatMonthDay(currentConfig.defaults.fall_end)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-md bg-surface-canvas border border-border-subtle">
              <CheckmarkFilled className="w-4 h-4 text-status-success flex-shrink-0" />
              <div>
                <span className="font-medium text-text-primary">Spring Semester:</span>{' '}
                <span className="text-text-secondary">
                  {currentConfig && formatMonthDay(currentConfig.defaults.spring_start)} –{' '}
                  {currentConfig && formatMonthDay(currentConfig.defaults.spring_end)}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-3">
            These default dates are preserved by the system when no active calendar override is present.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademicCalendarSettings;
