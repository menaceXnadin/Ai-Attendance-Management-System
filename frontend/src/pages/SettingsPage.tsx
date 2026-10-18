
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import FacePolicySettingsCard from '@/components/face-admin/FacePolicySettingsCard';
import {
  Save20Regular,
  Alert20Regular,
  Print20Regular,
  Document20Regular,
  People20Regular,
  Person20Regular,
  Eye20Regular,
  Options20Regular,
  Settings20Regular,
  Checkmark16Regular,
  Shield20Regular,
  LockClosed20Regular,
  ArrowUpload20Regular,
  ArrowDownload20Regular,
  ChevronRight16Regular,
  CalendarLtr20Regular,
  Ribbon20Regular,
  ScanPerson20Regular,
} from '@fluentui/react-icons';

/* ------------------------------------------------------------------ */
/* Presentational helpers (Teams settings pattern)                     */
/* ------------------------------------------------------------------ */

const SettingsCard: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, children }) => (
  <Card className="border-0 shadow overflow-hidden">
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle">
      {icon && (
        <div className="h-8 w-8 shrink-0 rounded-md bg-brand-subtle text-brand-foreground grid place-items-center">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="text-subheading text-text-primary">{title}</h2>
        {description && <p className="text-caption text-text-muted mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="divide-y divide-border-subtle">{children}</div>
  </Card>
);

const SettingRow: React.FC<{
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  stacked?: boolean;
  className?: string;
}> = ({ label, description, htmlFor, icon, children, stacked = false, className }) => (
  <div
    className={cn(
      'px-5 py-4',
      stacked ? 'space-y-3' : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
      className
    )}
  >
    <div className="flex items-start gap-3 min-w-0">
      {icon && <span className="mt-0.5 shrink-0 text-text-muted">{icon}</span>}
      <div className="min-w-0">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-body-strong text-text-primary cursor-pointer">
            {label}
          </Label>
        ) : (
          <div className="text-body-strong text-text-primary">{label}</div>
        )}
        {description && <p className="text-caption text-text-muted mt-0.5">{description}</p>}
      </div>
    </div>
    {children && <div className={cn(stacked ? '' : 'shrink-0', icon && stacked ? 'sm:pl-8' : '')}>{children}</div>}
  </div>
);

const navTriggerClass =
  'group relative flex h-9 shrink-0 items-center gap-3 rounded-md px-3 text-body text-text-secondary whitespace-nowrap transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-surface-selected data-[state=active]:font-semibold data-[state=active]:text-text-primary';

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [reportFormat, setReportFormat] = useState('excel');
  const [activeTab, setActiveTab] = useState('general');

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save operation
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    }, 1000);
  };

  const categories = [
    { value: 'general', label: 'General', icon: Settings20Regular },
    { value: 'system', label: 'System', icon: Options20Regular },
    { value: 'face', label: 'Face verification', icon: ScanPerson20Regular },
    { value: 'notifications', label: 'Notifications', icon: Alert20Regular },
    { value: 'reports', label: 'Reports', icon: Document20Regular },
    { value: 'account', label: 'Account', icon: People20Regular },
  ];

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="vertical"
          className="flex flex-col gap-6 md:flex-row"
        >
          {/* Left: Teams-style settings category list */}
          <aside className="md:w-60 md:shrink-0">
            <div className="mb-3 px-1 md:px-3">
              <h1 className="text-section-title text-text-primary">Settings</h1>
              <p className="text-caption text-text-muted mt-0.5">
                Manage your preferences and system configuration
              </p>
            </div>
            <TabsPrimitive.List
              aria-label="Settings categories"
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

          {/* Right: content panel */}
          <div className="min-w-0 flex-1 space-y-4">
            <TabsContent value="general" className="mt-0 space-y-4 animate-fade-in-up">
              <SettingsCard
                title="General Settings"
                description="Configure general application preferences"
                icon={<Settings20Regular />}
              >
                <SettingRow
                  htmlFor="auto-save"
                  label="Auto Save"
                  description="Automatically save changes as you work"
                >
                  <Switch id="auto-save" defaultChecked />
                </SettingRow>

                <SettingRow label="Items Per Page" description="Number of items to display in tables">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Items per page">
                    {[10, 25, 50, 100].map((value) => (
                      <Button
                        key={value}
                        variant={itemsPerPage === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setItemsPerPage(value)}
                        className="min-w-[56px] tabular-nums"
                        aria-pressed={itemsPerPage === value}
                      >
                        {value}
                        {itemsPerPage === value && <Checkmark16Regular aria-hidden />}
                      </Button>
                    ))}
                  </div>
                </SettingRow>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="system" className="mt-0 space-y-4 animate-fade-in-up">
              <SettingsCard
                title="System Configuration"
                description="Configure system-wide settings and thresholds"
                icon={<Options20Regular />}
              >
                {/* Attendance Thresholds - Active */}
                <Link
                  to="/app/settings/attendance-thresholds"
                  className="group flex flex-col gap-3 px-5 py-4 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 shrink-0 text-brand-foreground">
                      <Options20Regular aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body-strong text-text-primary">Attendance Thresholds</span>
                        <Badge variant="success" shape="pill">Active</Badge>
                      </div>
                      <p className="text-caption text-text-muted mt-0.5">
                        Configure attendance status thresholds (Excellent, Good, Warning, Critical)
                      </p>
                    </div>
                  </div>
                  <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}>
                    Configure
                    <ChevronRight16Regular aria-hidden />
                  </span>
                </Link>

                {/* Coming Soon Items */}
                {[
                  {
                    icon: <CalendarLtr20Regular aria-hidden />,
                    title: "Academic Calendar",
                    description: "Configure semester dates and academic periods",
                  },
                  {
                    icon: <Ribbon20Regular aria-hidden />,
                    title: "Grading System",
                    description: "Configure grading thresholds and letter grades",
                  }
                ].map((item, index) => (
                  <SettingRow
                    key={index}
                    icon={item.icon}
                    label={
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-text-secondary">{item.title}</span>
                        <Badge variant="secondary" shape="pill">Coming Soon</Badge>
                      </span>
                    }
                    description={item.description}
                  >
                    <Button variant="outline" size="sm" disabled>
                      Configure
                      <ChevronRight16Regular aria-hidden />
                    </Button>
                  </SettingRow>
                ))}
              </SettingsCard>
            </TabsContent>

            <TabsContent value="face" className="mt-0 space-y-4 animate-fade-in-up">
              {/* Saves itself (only changed keys) — the page's save bar below is hidden on this tab. */}
              <FacePolicySettingsCard />
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-4 animate-fade-in-up">
              <SettingsCard
                title="Notification Settings"
                description="Configure how you receive notifications"
                icon={<Alert20Regular />}
              >
                {[
                  {
                    icon: <Alert20Regular aria-hidden />,
                    title: "Email Notifications",
                    description: "Receive important updates via email",
                    id: "email-notif",
                    defaultChecked: true,
                  },
                  {
                    icon: <People20Regular aria-hidden />,
                    title: "Student Absence Alerts",
                    description: "Get notified when a student is marked absent",
                    id: "absence-alerts",
                    defaultChecked: true,
                  },
                  {
                    icon: <ArrowDownload20Regular aria-hidden />,
                    title: "System Updates",
                    description: "Receive notifications about system updates and maintenance",
                    id: "system-updates",
                    defaultChecked: false,
                  }
                ].map((item, index) => (
                  <SettingRow
                    key={index}
                    icon={item.icon}
                    htmlFor={item.id}
                    label={item.title}
                    description={item.description}
                  >
                    <Switch id={item.id} defaultChecked={item.defaultChecked} />
                  </SettingRow>
                ))}
              </SettingsCard>
            </TabsContent>

            <TabsContent value="reports" className="mt-0 space-y-4 animate-fade-in-up">
              <SettingsCard
                title="Report Settings"
                description="Configure report generation options"
                icon={<Document20Regular />}
              >
                {/* Report Format Selection */}
                <SettingRow
                  icon={<Document20Regular aria-hidden />}
                  label="Report Format"
                  description="Choose your preferred export format"
                >
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Report format">
                    {[
                      { value: 'pdf', label: 'PDF' },
                      { value: 'excel', label: 'Excel' },
                      { value: 'csv', label: 'CSV' }
                    ].map((format) => (
                      <Button
                        key={format.value}
                        variant={reportFormat === format.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setReportFormat(format.value)}
                        aria-pressed={reportFormat === format.value}
                      >
                        <Document20Regular aria-hidden />
                        {format.label}
                        {reportFormat === format.value && <Checkmark16Regular aria-hidden />}
                      </Button>
                    ))}
                  </div>
                </SettingRow>

                {/* School Logo Upload */}
                <SettingRow
                  stacked
                  icon={<ArrowUpload20Regular aria-hidden />}
                  htmlFor="school-logo"
                  label="School Logo"
                  description="Upload your institution logo for reports (PNG, JPG, max 2MB)"
                >
                  <Input
                    id="school-logo"
                    type="file"
                    accept="image/*"
                    className="h-10 max-w-md cursor-pointer py-1.5 file:mr-3 file:rounded file:border-0 file:bg-brand-subtle file:px-3 file:py-1 file:text-caption-strong file:text-brand-foreground hover:file:bg-brand-subtle-hover"
                  />
                </SettingRow>

                {/* Additional Options */}
                <SettingRow
                  icon={<Document20Regular aria-hidden />}
                  htmlFor="signature"
                  label="Include Digital Signature"
                  description="Add authorized signature to generated reports"
                >
                  <Switch id="signature" defaultChecked />
                </SettingRow>

                <SettingRow
                  stacked
                  icon={<Print20Regular aria-hidden />}
                  htmlFor="printer-settings"
                  label="Default Printer"
                  description="Set your preferred printer for quick access"
                >
                  <div className="flex max-w-md items-center gap-2">
                    <Input
                      id="printer-settings"
                      placeholder="Select printer"
                      defaultValue="HP LaserJet 4200"
                      className="flex-1"
                    />
                    <Button variant="outline" size="icon" className="shrink-0" aria-label="Printer">
                      <Print20Regular aria-hidden />
                    </Button>
                  </div>
                </SettingRow>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="account" className="mt-0 space-y-4 animate-fade-in-up">
              {/* Profile Information */}
              <SettingsCard
                title="Profile Information"
                description="Manage your account information and security"
                icon={<Person20Regular />}
              >
                <div className="grid gap-4 px-5 py-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-body-strong text-text-primary">Email Address</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-surface-subtle"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name" className="text-body-strong text-text-primary">First Name</Label>
                      <Input id="first-name" placeholder="Enter your first name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last-name" className="text-body-strong text-text-primary">Last Name</Label>
                      <Input id="last-name" placeholder="Enter your last name" />
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* Password Change */}
              <SettingsCard title="Change Password" icon={<LockClosed20Regular />}>
                <div className="grid gap-4 px-5 py-4">
                  <div className="space-y-1.5 md:max-w-[calc(50%-0.5rem)]">
                    <Label htmlFor="current-password" className="text-body-strong text-text-primary">Current Password</Label>
                    <PasswordInput id="current-password" placeholder="Enter current password" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-body-strong text-text-primary">New Password</Label>
                      <PasswordInput id="new-password" placeholder="Enter new password" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="text-body-strong text-text-primary">Confirm Password</Label>
                      <PasswordInput id="confirm-password" placeholder="Confirm new password" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end px-5 py-3">
                  <Button variant="outline">
                    <Save20Regular aria-hidden />
                    Update Password
                  </Button>
                </div>
              </SettingsCard>

              {/* Security Settings */}
              <SettingsCard title="Security & Privacy" icon={<Shield20Regular />}>
                <SettingRow
                  icon={<Shield20Regular aria-hidden />}
                  htmlFor="2fa"
                  label="Two-Factor Authentication"
                  description="Add an extra layer of security to your account"
                >
                  <Switch id="2fa" />
                </SettingRow>

                <SettingRow
                  icon={<Eye20Regular aria-hidden />}
                  label="Data Privacy"
                  description="Manage how your data is collected and used"
                >
                  <Button variant="outline" size="sm">
                    <Eye20Regular aria-hidden />
                    Manage
                  </Button>
                </SettingRow>
              </SettingsCard>
            </TabsContent>

            {/* Sticky save bar (not for the face verification card, which has its own Save) */}
            <div
              className={cn(
                'sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-lg border-t border-border-subtle bg-surface-default px-5 py-3 shadow-md',
                activeTab === 'face' && 'hidden'
              )}
            >
              <p className="hidden text-caption text-text-muted sm:block">
                Review your changes, then save to apply them.
              </p>
              <Button onClick={handleSave} disabled={isSaving} className="ml-auto">
                {isSaving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-on border-t-transparent" aria-hidden />
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
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
