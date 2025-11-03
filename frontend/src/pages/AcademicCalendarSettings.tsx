import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  AlertTriangle, 
  RefreshCw, 
  Info, 
  CheckCircle,
  Save,
  X
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

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
      const response = await axios.get<CurrentConfig>(
        'http://localhost:8000/api/admin/academic-calendar/current',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      setCurrentConfig(response.data);
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
      await axios.post(
        'http://localhost:8000/api/admin/academic-calendar/override',
        {
          fall_start: { month: formData.fallStartMonth, day: formData.fallStartDay },
          fall_end: { month: formData.fallEndMonth, day: formData.fallEndDay },
          spring_start: { month: formData.springStartMonth, day: formData.springStartDay },
          spring_end: { month: formData.springEndMonth, day: formData.springEndDay },
          reason: formData.reason,
          effective_from: formData.effectiveFrom,
          effective_until: formData.effectiveUntil || null,
          is_emergency_override: formData.isEmergency,
          emergency_contact_email: formData.emergencyEmail || null
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      toast.success('Emergency calendar override activated');
      setShowOverrideForm(false);
      fetchCurrentConfig();
    } catch (error: any) {
      console.error('Failed to create override:', error);
      toast.error(error.response?.data?.detail || 'Failed to create override');
    }
  };

  const handleResetToDefaults = async () => {
    if (!currentConfig?.override_details) return;
    
    if (!confirm('Reset to default calendar dates? This will affect the entire system.')) {
      return;
    }

    try {
      await axios.delete(
        `http://localhost:8000/api/admin/academic-calendar/override/${currentConfig.override_details.id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
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
      <div className="flex items-center justify-center py-12">
        <div className="text-white">Loading calendar configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Configuration */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Active Calendar Configuration
            </span>
            {currentConfig?.is_override_active && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Override Active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Fall Semester */}
              <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg">
                <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                  <div className="h-3 w-3 bg-orange-400 rounded-full"></div>
                  Fall Semester
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Start:</span>
                    <span className="font-medium text-white">
                      {currentConfig && formatMonthDay(currentConfig.fall_start)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">End:</span>
                    <span className="font-medium text-white">
                      {currentConfig && formatMonthDay(currentConfig.fall_end)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Spring Semester */}
              <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg">
                <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-400 rounded-full"></div>
                  Spring Semester
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Start:</span>
                    <span className="font-medium text-white">
                      {currentConfig && formatMonthDay(currentConfig.spring_start)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">End:</span>
                    <span className="font-medium text-white">
                      {currentConfig && formatMonthDay(currentConfig.spring_end)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Override Details */}
            {currentConfig?.override_details && (
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <h4 className="font-semibold text-amber-300 mb-2">Override Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Reason:</span>
                    <span className="text-white">{currentConfig.override_details.reason}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Effective From:</span>
                    <span className="text-white">
                      {new Date(currentConfig.override_details.effective_from).toLocaleDateString()}
                    </span>
                  </div>
                  {currentConfig.override_details.effective_until && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Expires:</span>
                      <span className="text-white">
                        {new Date(currentConfig.override_details.effective_until).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowOverrideForm(!showOverrideForm)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Create Emergency Override
              </Button>

              {currentConfig?.is_override_active && (
                <Button
                  variant="outline"
                  onClick={handleResetToDefaults}
                  className="border-green-500 text-green-400 hover:bg-green-500/20"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Override Form */}
        {showOverrideForm && (
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Create Emergency Calendar Override</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOverrideForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-6">
                {/* Fall Dates */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-white">Fall Semester</h3>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Start Date</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.fallStartMonth}
                        onChange={(e) => setFormData({ ...formData, fallStartMonth: parseInt(e.target.value) })}
                        className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={idx} value={idx + 1}>{month}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.fallStartDay}
                        onChange={(e) => setFormData({ ...formData, fallStartDay: parseInt(e.target.value) })}
                        className="w-20 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">End Date</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.fallEndMonth}
                        onChange={(e) => setFormData({ ...formData, fallEndMonth: parseInt(e.target.value) })}
                        className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={idx} value={idx + 1}>{month}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.fallEndDay}
                        onChange={(e) => setFormData({ ...formData, fallEndDay: parseInt(e.target.value) })}
                        className="w-20 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Spring Dates */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-white">Spring Semester</h3>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Start Date</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.springStartMonth}
                        onChange={(e) => setFormData({ ...formData, springStartMonth: parseInt(e.target.value) })}
                        className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={idx} value={idx + 1}>{month}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.springStartDay}
                        onChange={(e) => setFormData({ ...formData, springStartDay: parseInt(e.target.value) })}
                        className="w-20 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">End Date</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.springEndMonth}
                        onChange={(e) => setFormData({ ...formData, springEndMonth: parseInt(e.target.value) })}
                        className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={idx} value={idx + 1}>{month}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.springEndDay}
                        onChange={(e) => setFormData({ ...formData, springEndDay: parseInt(e.target.value) })}
                        className="w-20 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Reason for Override (minimum 10 characters)</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., COVID-19 pandemic adjustment - delayed start by 4 weeks"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500"
                />
              </div>

              {/* Effective Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Effective From</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Effective Until (optional)</label>
                  <input
                    type="date"
                    value={formData.effectiveUntil}
                    onChange={(e) => setFormData({ ...formData, effectiveUntil: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Emergency Flag */}
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <input
                  type="checkbox"
                  id="isEmergency"
                  checked={formData.isEmergency}
                  onChange={(e) => setFormData({ ...formData, isEmergency: e.target.checked })}
                  className="h-5 w-5"
                />
                <label htmlFor="isEmergency" className="text-white cursor-pointer">
                  Mark as Emergency Override (COVID-19, natural disaster, etc.)
                </label>
              </div>

              {/* Emergency Email */}
              {formData.isEmergency && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Emergency Contact Email</label>
                  <input
                    type="email"
                    value={formData.emergencyEmail}
                    onChange={(e) => setFormData({ ...formData, emergencyEmail: e.target.value })}
                    placeholder="emergency@university.edu"
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCreateOverride}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Activate Override
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowOverrideForm(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Default Values Reference */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-blue-300 flex items-center gap-2">
              <Info className="h-5 w-5" />
              Default Calendar Dates (Standard Configuration)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-400" />
                <div>
                  <strong className="text-white">Fall:</strong>{' '}
                  <span className="text-gray-300">
                    {currentConfig && formatMonthDay(currentConfig.defaults.fall_start)} -{' '}
                    {currentConfig && formatMonthDay(currentConfig.defaults.fall_end)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-400" />
                <div>
                  <strong className="text-white">Spring:</strong>{' '}
                  <span className="text-gray-300">
                    {currentConfig && formatMonthDay(currentConfig.defaults.spring_start)} -{' '}
                    {currentConfig && formatMonthDay(currentConfig.defaults.spring_end)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-3">
              These default dates are used when no override is active. They represent
              the standard academic calendar for most North American institutions.
            </p>
          </CardContent>
        </Card>
    </div>
  );
};

export default AcademicCalendarSettings;
