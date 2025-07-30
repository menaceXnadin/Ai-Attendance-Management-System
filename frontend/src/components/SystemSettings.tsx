import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings as SettingsIcon,
  User,
  Shield,
  Camera,
  Bell,
  Database,
  Server,
  Eye,
  Lock,
  Globe,
  Palette,
  Monitor,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Download,
  Upload,
  Trash2,
  Edit
} from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <SettingsIcon className="h-6 w-6 text-white" />
              </div>
              System Settings
            </h1>
            <p className="text-slate-400 mt-2">Configure your attendance management system</p>
          </div>
          
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-400/30">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved Changes
              </Badge>
            )}
            
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            
            <Button
              onClick={saveSettings}
              disabled={!hasUnsavedChanges}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger value="general" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500">
              <Globe className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="face-recognition" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500">
              <Eye className="h-4 w-4 mr-2" />
              Face Recognition
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="database" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500">
              <Database className="h-4 w-4 mr-2" />
              Database
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500">
              <Server className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-400" />
                  General Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">System Name</label>
                    <input
                      type="text"
                      value={settings.general.systemName}
                      onChange={(e) => updateSetting('general', 'systemName', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Timezone</label>
                    <select
                      value={settings.general.timezone}
                      onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="UTC+05:45">Nepal (UTC+05:45)</option>
                      <option value="UTC+05:30">India (UTC+05:30)</option>
                      <option value="UTC+00:00">UTC (UTC+00:00)</option>
                      <option value="UTC+08:00">Singapore (UTC+08:00)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Language</label>
                    <select
                      value={settings.general.language}
                      onChange={(e) => updateSetting('general', 'language', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="English">English</option>
                      <option value="Nepali">नेपाली</option>
                      <option value="Hindi">हिन्दी</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Theme</label>
                    <select
                      value={settings.general.theme}
                      onChange={(e) => updateSetting('general', 'theme', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-400" />
                  Security Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Two-Factor Authentication</div>
                      <div className="text-sm text-slate-400">Add an extra layer of security</div>
                    </div>
                    <Switch
                      checked={settings.security.twoFactorAuth}
                      onCheckedChange={(checked) => updateSetting('security', 'twoFactorAuth', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Password Complexity</div>
                      <div className="text-sm text-slate-400">Enforce strong passwords</div>
                    </div>
                    <Switch
                      checked={settings.security.passwordComplexity}
                      onCheckedChange={(checked) => updateSetting('security', 'passwordComplexity', checked)}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Session Timeout (minutes): {settings.security.sessionTimeout}
                    </label>
                    <Slider
                      value={[settings.security.sessionTimeout]}
                      onValueChange={(value) => updateSetting('security', 'sessionTimeout', value[0])}
                      max={120}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Max Login Attempts: {settings.security.loginAttempts}
                    </label>
                    <Slider
                      value={[settings.security.loginAttempts]}
                      onValueChange={(value) => updateSetting('security', 'loginAttempts', value[0])}
                      max={10}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Face Recognition Settings */}
          <TabsContent value="face-recognition" className="space-y-6">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-400" />
                  Face Recognition Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Face Recognition Enabled</div>
                      <div className="text-sm text-slate-400">Enable face-based attendance</div>
                    </div>
                    <Switch
                      checked={settings.faceRecognition.enabled}
                      onCheckedChange={(checked) => updateSetting('faceRecognition', 'enabled', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Anti-Spoofing</div>
                      <div className="text-sm text-slate-400">Detect fake faces and photos</div>
                    </div>
                    <Switch
                      checked={settings.faceRecognition.antiSpoofing}
                      onCheckedChange={(checked) => updateSetting('faceRecognition', 'antiSpoofing', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Multiple Angles</div>
                      <div className="text-sm text-slate-400">Support various face angles</div>
                    </div>
                    <Switch
                      checked={settings.faceRecognition.multipleAngles}
                      onCheckedChange={(checked) => updateSetting('faceRecognition', 'multipleAngles', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Real-time Processing</div>
                      <div className="text-sm text-slate-400">Process faces in real-time</div>
                    </div>
                    <Switch
                      checked={settings.faceRecognition.realTimeProcessing}
                      onCheckedChange={(checked) => updateSetting('faceRecognition', 'realTimeProcessing', checked)}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Accuracy Threshold: {settings.faceRecognition.accuracy}%
                    </label>
                    <Slider
                      value={[settings.faceRecognition.accuracy]}
                      onValueChange={(value) => updateSetting('faceRecognition', 'accuracy', value[0])}
                      max={99}
                      min={70}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Confidence Threshold: {settings.faceRecognition.confidenceThreshold}%
                    </label>
                    <Slider
                      value={[settings.faceRecognition.confidenceThreshold]}
                      onValueChange={(value) => updateSetting('faceRecognition', 'confidenceThreshold', value[0])}
                      max={95}
                      min={50}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-400" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Email Notifications</div>
                      <div className="text-sm text-slate-400">Receive updates via email</div>
                    </div>
                    <Switch
                      checked={settings.notifications.emailNotifications}
                      onCheckedChange={(checked) => updateSetting('notifications', 'emailNotifications', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Push Notifications</div>
                      <div className="text-sm text-slate-400">Browser push notifications</div>
                    </div>
                    <Switch
                      checked={settings.notifications.pushNotifications}
                      onCheckedChange={(checked) => updateSetting('notifications', 'pushNotifications', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">SMS Alerts</div>
                      <div className="text-sm text-slate-400">Critical alerts via SMS</div>
                    </div>
                    <Switch
                      checked={settings.notifications.smsAlerts}
                      onCheckedChange={(checked) => updateSetting('notifications', 'smsAlerts', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">System Alerts</div>
                      <div className="text-sm text-slate-400">System status notifications</div>
                    </div>
                    <Switch
                      checked={settings.notifications.systemAlerts}
                      onCheckedChange={(checked) => updateSetting('notifications', 'systemAlerts', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Attendance Reminders</div>
                      <div className="text-sm text-slate-400">Daily attendance reminders</div>
                    </div>
                    <Switch
                      checked={settings.notifications.attendanceReminders}
                      onCheckedChange={(checked) => updateSetting('notifications', 'attendanceReminders', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Settings */}
          <TabsContent value="database" className="space-y-6">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-cyan-400" />
                  Database Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Auto Backup</div>
                      <div className="text-sm text-slate-400">Automatic database backups</div>
                    </div>
                    <Switch
                      checked={settings.database.autoBackup}
                      onCheckedChange={(checked) => updateSetting('database', 'autoBackup', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                    <div>
                      <div className="font-medium text-white">Compression</div>
                      <div className="text-sm text-slate-400">Compress backup files</div>
                    </div>
                    <Switch
                      checked={settings.database.compressionEnabled}
                      onCheckedChange={(checked) => updateSetting('database', 'compressionEnabled', checked)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Backup Frequency</label>
                    <select
                      value={settings.database.backupFrequency}
                      onChange={(e) => updateSetting('database', 'backupFrequency', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Data Retention (days): {settings.database.dataRetention}
                    </label>
                    <Slider
                      value={[settings.database.dataRetention]}
                      onValueChange={(value) => updateSetting('database', 'dataRetention', value[0])}
                      max={1825}
                      min={30}
                      step={30}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </Button>
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </Button>
                  <Button variant="outline" className="border-red-600 text-red-300 hover:bg-red-800/20">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clean Old Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Settings */}
          <TabsContent value="performance" className="space-y-6">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Server className="h-5 w-5 text-orange-400" />
                  Performance Optimization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg">
                  <div>
                    <div className="font-medium text-white">Cache Enabled</div>
                    <div className="text-sm text-slate-400">Enable system-wide caching</div>
                  </div>
                  <Switch
                    checked={settings.performance.cacheEnabled}
                    onCheckedChange={(checked) => updateSetting('performance', 'cacheEnabled', checked)}
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Max Database Connections: {settings.performance.maxConnections}
                    </label>
                    <Slider
                      value={[settings.performance.maxConnections]}
                      onValueChange={(value) => updateSetting('performance', 'maxConnections', value[0])}
                      max={500}
                      min={10}
                      step={10}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Query Timeout (seconds): {settings.performance.queryTimeout}
                    </label>
                    <Slider
                      value={[settings.performance.queryTimeout]}
                      onValueChange={(value) => updateSetting('performance', 'queryTimeout', value[0])}
                      max={120}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Log Level</label>
                  <select
                    value={settings.performance.logLevel}
                    onChange={(e) => updateSetting('performance', 'logLevel', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemSettings;
