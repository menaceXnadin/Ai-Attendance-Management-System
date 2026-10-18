import React, { useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Settings20Regular,
  Shield20Regular,
  Eye20Regular,
  Alert20Regular,
  Database20Regular,
  Server20Regular,
  Globe20Regular,
  Save20Regular,
  ArrowReset20Regular,
  Warning16Regular,
  ArrowDownload20Regular,
  ArrowUpload20Regular,
  Delete20Regular,
} from '@fluentui/react-icons';

interface SettingsState {
  general: {
    systemName: string;
    timezone: string;
    language: string;
    theme: 'dark' | 'light' | 'auto';
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number;
    passwordComplexity: boolean;
    loginAttempts: number;
  };
  faceRecognition: {
    enabled: boolean;
    accuracy: number;
    confidenceThreshold: number;
    antiSpoofing: boolean;
    multipleAngles: boolean;
    realTimeProcessing: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsAlerts: boolean;
    systemAlerts: boolean;
    attendanceReminders: boolean;
  };
  database: {
    autoBackup: boolean;
    backupFrequency: string;
    dataRetention: number;
    compressionEnabled: boolean;
  };
  performance: {
    cacheEnabled: boolean;
    maxConnections: number;
    queryTimeout: number;
    logLevel: string;
  };
}

/* ------------------------------------------------------------------ */
/* Presentational helpers (Teams settings pattern)                     */
/* ------------------------------------------------------------------ */

const selectClass =
  'h-9 w-full rounded-md border border-border-default border-b-border-strong bg-surface-default px-3 text-body text-text-primary transition-colors duration-150 ease-fluent-standard hover:border-border-strong focus-visible:outline-none focus-visible:border-b-2 focus-visible:border-b-brand';

const SettingsCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <Card className="border-0 shadow overflow-hidden">
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
      <div className="h-8 w-8 shrink-0 rounded-md bg-brand-subtle text-brand-foreground grid place-items-center">
        {icon}
      </div>
      <h2 className="text-subheading text-text-primary">{title}</h2>
    </div>
    <div className="divide-y divide-border-subtle">{children}</div>
  </Card>
);

const SettingRow: React.FC<{
  label: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  controlClassName?: string;
}> = ({ label, description, children, controlClassName }) => (
  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="text-body-strong text-text-primary">{label}</div>
      {description && <p className="text-caption text-text-muted mt-0.5">{description}</p>}
    </div>
    <div className={cn('shrink-0', controlClassName)}>{children}</div>
  </div>
);

const SliderControl: React.FC<{ display: React.ReactNode; children: React.ReactNode }> = ({ display, children }) => (
  <div className="flex w-full items-center gap-3 sm:w-72">
    <div className="flex-1">{children}</div>
    <span className="w-14 text-right text-body-strong tabular-nums text-text-primary">{display}</span>
  </div>
);

const navTriggerClass =
  'group relative flex h-9 shrink-0 items-center gap-3 rounded-md px-3 text-body text-text-secondary whitespace-nowrap transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-surface-selected data-[state=active]:font-semibold data-[state=active]:text-text-primary';

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>({
    general: {
      systemName: 'Attendance Management System',
      timezone: 'UTC+05:45',
      language: 'English',
      theme: 'dark'
    },
    security: {
      twoFactorAuth: true,
      sessionTimeout: 30,
      passwordComplexity: true,
      loginAttempts: 3
    },
    faceRecognition: {
      enabled: true,
      accuracy: 95,
      confidenceThreshold: 85,
      antiSpoofing: true,
      multipleAngles: false,
      realTimeProcessing: true
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      smsAlerts: false,
      systemAlerts: true,
      attendanceReminders: true
    },
    database: {
      autoBackup: true,
      backupFrequency: 'daily',
      dataRetention: 365,
      compressionEnabled: true
    },
    performance: {
      cacheEnabled: true,
      maxConnections: 100,
      queryTimeout: 30,
      logLevel: 'info'
    }
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateSetting = (category: keyof SettingsState, key: string, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  const saveSettings = () => {
    // Simulate saving
    console.log('Saving settings:', settings);
    setHasUnsavedChanges(false);
    // Show success message
  };

  const resetToDefaults = () => {
    // Reset to default values
    setHasUnsavedChanges(true);
  };

  const categories = [
    { value: 'general', label: 'General', icon: Globe20Regular },
    { value: 'security', label: 'Security', icon: Shield20Regular },
    { value: 'face-recognition', label: 'Face Recognition', icon: Eye20Regular },
    { value: 'notifications', label: 'Notifications', icon: Alert20Regular },
    { value: 'database', label: 'Database', icon: Database20Regular },
    { value: 'performance', label: 'Performance', icon: Server20Regular },
  ];

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        <Tabs defaultValue="general" orientation="vertical" className="flex flex-col gap-6 md:flex-row">
          {/* Left: settings category list */}
          <aside className="md:w-60 md:shrink-0">
            <div className="mb-3 flex items-start gap-3 px-1 md:px-3">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-section-title text-text-primary">
                  <Settings20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                  System Settings
                </h1>
                <p className="text-caption text-text-muted mt-0.5">Configure your attendance management system</p>
              </div>
            </div>
            <TabsPrimitive.List
              aria-label="System settings categories"
              className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0"
            >
              {categories.map(({ value, label, icon: Icon }) => (
                <TabsPrimitive.Trigger key={value} value={value} className={navTriggerClass}>
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand opacity-0 transition-opacity duration-150 group-data-[state=active]:opacity-100"
                  />
                  <Icon className="shrink-0 text-text-muted group-data-[state=active]:text-brand-foreground" aria-hidden />
                  {label}
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>
          </aside>

          {/* Right: content */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* General Settings */}
            <TabsContent value="general" className="mt-0 space-y-4">
              <SettingsCard title="General Configuration" icon={<Globe20Regular />}>
                <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="sys-name" className="text-body-strong text-text-primary">System Name</label>
                    <Input
                      id="sys-name"
                      type="text"
                      value={settings.general.systemName}
                      onChange={(e) => updateSetting('general', 'systemName', e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sys-timezone" className="text-body-strong text-text-primary">Timezone</label>
                    <select
                      id="sys-timezone"
                      value={settings.general.timezone}
                      onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
                      className={selectClass}
                    >
                      <option value="UTC+05:45">Nepal (UTC+05:45)</option>
                      <option value="UTC+05:30">India (UTC+05:30)</option>
                      <option value="UTC+00:00">UTC (UTC+00:00)</option>
                      <option value="UTC+08:00">Singapore (UTC+08:00)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sys-language" className="text-body-strong text-text-primary">Language</label>
                    <select
                      id="sys-language"
                      value={settings.general.language}
                      onChange={(e) => updateSetting('general', 'language', e.target.value)}
                      className={selectClass}
                    >
                      <option value="English">English</option>
                      <option value="Nepali">नेपाली</option>
                      <option value="Hindi">हिन्दी</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sys-theme" className="text-body-strong text-text-primary">Theme</label>
                    <select
                      id="sys-theme"
                      value={settings.general.theme}
                      onChange={(e) => updateSetting('general', 'theme', e.target.value)}
                      className={selectClass}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                </div>
              </SettingsCard>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security" className="mt-0 space-y-4">
              <SettingsCard title="Security Configuration" icon={<Shield20Regular />}>
                <SettingRow label="Two-Factor Authentication" description="Add an extra layer of security">
                  <Switch
                    checked={settings.security.twoFactorAuth}
                    onCheckedChange={(checked) => updateSetting('security', 'twoFactorAuth', checked)}
                  />
                </SettingRow>

                <SettingRow label="Password Complexity" description="Enforce strong passwords">
                  <Switch
                    checked={settings.security.passwordComplexity}
                    onCheckedChange={(checked) => updateSetting('security', 'passwordComplexity', checked)}
                  />
                </SettingRow>

                <SettingRow label="Session Timeout (minutes)" controlClassName="w-full sm:w-auto">
                  <SliderControl display={settings.security.sessionTimeout}>
                    <Slider
                      value={[settings.security.sessionTimeout]}
                      onValueChange={(value) => updateSetting('security', 'sessionTimeout', value[0])}
                      max={120}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                  </SliderControl>
                </SettingRow>

                <SettingRow label="Max Login Attempts" controlClassName="w-full sm:w-auto">
                  <SliderControl display={settings.security.loginAttempts}>
                    <Slider
                      value={[settings.security.loginAttempts]}
                      onValueChange={(value) => updateSetting('security', 'loginAttempts', value[0])}
                      max={10}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </SliderControl>
                </SettingRow>
              </SettingsCard>
            </TabsContent>

            {/* Face Recognition Settings */}
            <TabsContent value="face-recognition" className="mt-0 space-y-4">
              <SettingsCard title="Face Recognition Configuration" icon={<Eye20Regular />}>
                <SettingRow label="Face Recognition Enabled" description="Enable face-based attendance">
                  <Switch
                    checked={settings.faceRecognition.enabled}
                    onCheckedChange={(checked) => updateSetting('faceRecognition', 'enabled', checked)}
                  />
                </SettingRow>

                <SettingRow label="Anti-Spoofing" description="Detect fake faces and photos">
                  <Switch
                    checked={settings.faceRecognition.antiSpoofing}
                    onCheckedChange={(checked) => updateSetting('faceRecognition', 'antiSpoofing', checked)}
                  />
                </SettingRow>

                <SettingRow label="Multiple Angles" description="Support various face angles">
                  <Switch
                    checked={settings.faceRecognition.multipleAngles}
                    onCheckedChange={(checked) => updateSetting('faceRecognition', 'multipleAngles', checked)}
                  />
                </SettingRow>

                <SettingRow label="Real-time Processing" description="Process faces in real-time">
                  <Switch
                    checked={settings.faceRecognition.realTimeProcessing}
                    onCheckedChange={(checked) => updateSetting('faceRecognition', 'realTimeProcessing', checked)}
                  />
                </SettingRow>

                <SettingRow label="Accuracy Threshold" controlClassName="w-full sm:w-auto">
                  <SliderControl display={`${settings.faceRecognition.accuracy}%`}>
                    <Slider
                      value={[settings.faceRecognition.accuracy]}
                      onValueChange={(value) => updateSetting('faceRecognition', 'accuracy', value[0])}
                      max={99}
                      min={70}
                      step={1}
                      className="w-full"
                    />
                  </SliderControl>
                </SettingRow>

                <SettingRow label="Confidence Threshold" controlClassName="w-full sm:w-auto">
                  <SliderControl display={`${settings.faceRecognition.confidenceThreshold}%`}>
                    <Slider
                      value={[settings.faceRecognition.confidenceThreshold]}
                      onValueChange={(value) => updateSetting('faceRecognition', 'confidenceThreshold', value[0])}
                      max={95}
                      min={50}
                      step={5}
                      className="w-full"
                    />
                  </SliderControl>
                </SettingRow>
              </SettingsCard>
            </TabsContent>

            {/* Notifications Settings */}
            <TabsContent value="notifications" className="mt-0 space-y-4">
              <SettingsCard title="Notification Preferences" icon={<Alert20Regular />}>
                <SettingRow label="Email Notifications" description="Receive updates via email">
                  <Switch
                    checked={settings.notifications.emailNotifications}
                    onCheckedChange={(checked) => updateSetting('notifications', 'emailNotifications', checked)}
                  />
                </SettingRow>

                <SettingRow label="Push Notifications" description="Browser push notifications">
                  <Switch
                    checked={settings.notifications.pushNotifications}
                    onCheckedChange={(checked) => updateSetting('notifications', 'pushNotifications', checked)}
                  />
                </SettingRow>

                <SettingRow label="SMS Alerts" description="Critical alerts via SMS">
                  <Switch
                    checked={settings.notifications.smsAlerts}
                    onCheckedChange={(checked) => updateSetting('notifications', 'smsAlerts', checked)}
                  />
                </SettingRow>

                <SettingRow label="System Alerts" description="System status notifications">
                  <Switch
                    checked={settings.notifications.systemAlerts}
                    onCheckedChange={(checked) => updateSetting('notifications', 'systemAlerts', checked)}
                  />
                </SettingRow>

                <SettingRow label="Attendance Reminders" description="Daily attendance reminders">
                  <Switch
                    checked={settings.notifications.attendanceReminders}
                    onCheckedChange={(checked) => updateSetting('notifications', 'attendanceReminders', checked)}
                  />
                </SettingRow>
              </SettingsCard>
            </TabsContent>

            {/* Database Settings */}
            <TabsContent value="database" className="mt-0 space-y-4">
              <SettingsCard title="Database Management" icon={<Database20Regular />}>
                <SettingRow label="Auto Backup" description="Automatic database backups">
                  <Switch
                    checked={settings.database.autoBackup}
                    onCheckedChange={(checked) => updateSetting('database', 'autoBackup', checked)}
                  />
                </SettingRow>

                <SettingRow label="Compression" description="Compress backup files">
                  <Switch
                    checked={settings.database.compressionEnabled}
                    onCheckedChange={(checked) => updateSetting('database', 'compressionEnabled', checked)}
                  />
                </SettingRow>

                <SettingRow label="Backup Frequency" controlClassName="w-full sm:w-72">
                  <select
                    aria-label="Backup Frequency"
                    value={settings.database.backupFrequency}
                    onChange={(e) => updateSetting('database', 'backupFrequency', e.target.value)}
                    className={selectClass}
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </SettingRow>

                <SettingRow label="Data Retention (days)" controlClassName="w-full sm:w-auto">
                  <SliderControl display={settings.database.dataRetention}>
                    <Slider
                      value={[settings.database.dataRetention]}
                      onValueChange={(value) => updateSetting('database', 'dataRetention', value[0])}
                      max={1825}
                      min={30}
                      step={30}
                      className="w-full"
                    />
                  </SliderControl>
                </SettingRow>

                <div className="flex flex-wrap gap-2 px-5 py-4">
                  <Button variant="outline">
                    <ArrowDownload20Regular aria-hidden />
                    Export Data
                  </Button>
                  <Button variant="outline">
                    <ArrowUpload20Regular aria-hidden />
                    Import Data
                  </Button>
                  <Button
                    variant="outline"
                    className="border-status-error-border text-status-error hover:bg-status-error-subtle"
                  >
                    <Delete20Regular aria-hidden />
                    Clean Old Data
                  </Button>
                </div>
              </SettingsCard>
            </TabsContent>

            {/* Performance Settings */}
            <TabsContent value="performance" className="mt-0 space-y-4">
              <SettingsCard title="Performance Optimization" icon={<Server20Regular />}>
                <SettingRow label="Cache Enabled" description="Enable system-wide caching">
                  <Switch
                    checked={settings.performance.cacheEnabled}
                    onCheckedChange={(checked) => updateSetting('performance', 'cacheEnabled', checked)}
                  />
                </SettingRow>

                <SettingRow label="Max Database Connections" controlClassName="w-full sm:w-auto">
                  <SliderControl display={settings.performance.maxConnections}>
                    <Slider
                      value={[settings.performance.maxConnections]}
                      onValueChange={(value) => updateSetting('performance', 'maxConnections', value[0])}
                      max={500}
                      min={10}
                      step={10}
                      className="w-full"
                    />
                  </SliderControl>
                </SettingRow>

                <SettingRow label="Query Timeout (seconds)" controlClassName="w-full sm:w-auto">
                  <SliderControl display={settings.performance.queryTimeout}>
                    <Slider
                      value={[settings.performance.queryTimeout]}
                      onValueChange={(value) => updateSetting('performance', 'queryTimeout', value[0])}
                      max={120}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                  </SliderControl>
                </SettingRow>

                <SettingRow label="Log Level" controlClassName="w-full sm:w-72">
                  <select
                    aria-label="Log Level"
                    value={settings.performance.logLevel}
                    onChange={(e) => updateSetting('performance', 'logLevel', e.target.value)}
                    className={selectClass}
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </SettingRow>
              </SettingsCard>
            </TabsContent>

            {/* Sticky save bar */}
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border-t border-border-subtle bg-surface-default px-5 py-3 shadow-md">
              {hasUnsavedChanges && (
                <Badge variant="warning" shape="pill" className="gap-1">
                  <Warning16Regular aria-hidden />
                  Unsaved Changes
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={resetToDefaults}>
                  <ArrowReset20Regular aria-hidden />
                  Reset
                </Button>
                <Button onClick={saveSettings} disabled={!hasUnsavedChanges}>
                  <Save20Regular aria-hidden />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemSettings;
