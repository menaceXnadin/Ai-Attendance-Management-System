
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Save, 
  Bell, 
  Printer, 
  FileText, 
  Users, 
  Eye, 
  Sliders,
  Settings as SettingsIcon,
  Check,
  ArrowRight,
  Shield,
  Lock,
  Upload,
  Download,
  ChevronRight
} from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [reportFormat, setReportFormat] = useState('excel');

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

  return (
    <div className="p-6 md:p-8">
      <div className="w-full">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your preferences and system configuration
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="general" className="space-y-6">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 p-2">
            <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 gap-2 bg-transparent">
              <TabsTrigger 
                value="general" 
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-50 data-[state=active]:to-blue-100/50 dark:data-[state=active]:from-blue-950/50 dark:data-[state=active]:to-blue-900/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-md transition-all duration-200 rounded-xl"
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger 
                value="system"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-50 data-[state=active]:to-purple-100/50 dark:data-[state=active]:from-purple-950/50 dark:data-[state=active]:to-purple-900/30 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 data-[state=active]:shadow-md transition-all duration-200 rounded-xl"
              >
                <Sliders className="h-4 w-4 mr-2" />
                System
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-50 data-[state=active]:to-amber-100/50 dark:data-[state=active]:from-amber-950/50 dark:data-[state=active]:to-amber-900/30 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:shadow-md transition-all duration-200 rounded-xl"
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="reports"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-50 data-[state=active]:to-emerald-100/50 dark:data-[state=active]:from-emerald-950/50 dark:data-[state=active]:to-emerald-900/30 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:shadow-md transition-all duration-200 rounded-xl"
              >
                <FileText className="h-4 w-4 mr-2" />
                Reports
              </TabsTrigger>
              <TabsTrigger 
                value="account"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-50 data-[state=active]:to-rose-100/50 dark:data-[state=active]:from-rose-950/50 dark:data-[state=active]:to-rose-900/30 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-300 data-[state=active]:shadow-md transition-all duration-200 rounded-xl col-span-2 md:col-span-1"
              >
                <Users className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
            </TabsList>
          </div>
        
        <TabsContent value="general" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
            <CardHeader className="relative border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <SettingsIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">General Settings</CardTitle>
                  <CardDescription className="mt-1">
                    Configure general application preferences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-6 md:p-8 space-y-6">
              <div className="space-y-6">
                <Separator className="bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
                
                <div className="group flex items-center justify-between p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 hover:shadow-md hover:border-emerald-300/50 dark:hover:border-emerald-700/50 transition-all duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg group-hover:scale-110 transition-transform duration-200">
                      <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <Label htmlFor="auto-save" className="text-base font-semibold cursor-pointer">Auto Save</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Automatically save changes as you work</p>
                    </div>
                  </div>
                  <Switch id="auto-save" defaultChecked className="data-[state=checked]:bg-emerald-600" />
                </div>
                
                <Separator className="bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
                
                <div className="space-y-4 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <Label className="text-base font-semibold">Items Per Page</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Number of items to display in tables</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {[10, 25, 50, 100].map((value) => (
                      <Button 
                        key={value}
                        variant={itemsPerPage === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setItemsPerPage(value)}
                        className={itemsPerPage === value 
                          ? "bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40" 
                          : "hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-700"
                        }
                      >
                        {value}
                        {itemsPerPage === value && <Check className="ml-2 h-3 w-3" />}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 pointer-events-none" />
            <CardHeader className="relative border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Sliders className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">System Configuration</CardTitle>
                  <CardDescription className="mt-1">
                    Configure system-wide settings and thresholds
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-6 md:p-8 space-y-4">
              {/* Attendance Thresholds - Active */}
              <Link to="/app/settings/attendance-thresholds" className="block group">
                <div className="relative overflow-hidden p-6 rounded-xl border-2 border-purple-200 dark:border-purple-800/50 bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/30 dark:via-slate-900 dark:to-pink-950/30 hover:shadow-xl hover:shadow-purple-500/20 dark:hover:shadow-purple-500/10 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 hover:scale-[1.02]">
                  <div className="absolute -right-8 -top-8 h-32 w-32 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/30 group-hover:shadow-xl group-hover:shadow-purple-500/40 transition-all duration-300 group-hover:scale-110">
                        <Sliders className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Attendance Thresholds
                          </h3>
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                            Active
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                          Configure attendance status thresholds (Excellent, Good, Warning, Critical)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 group-hover:border-purple-400 dark:group-hover:border-purple-600 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        Configure
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
              
              <Separator className="bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent my-6" />
              
              {/* Coming Soon Items */}
              <div className="space-y-4">
                {[
                  { 
                    icon: <FileText className="h-5 w-5" />, 
                    title: "Academic Calendar", 
                    description: "Configure semester dates and academic periods",
                    color: "blue"
                  },
                  { 
                    icon: <Shield className="h-5 w-5" />, 
                    title: "Grading System", 
                    description: "Configure grading thresholds and letter grades",
                    color: "emerald"
                  }
                ].map((item, index) => (
                  <div 
                    key={index}
                    className="relative overflow-hidden p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-2.5 bg-${item.color}-100 dark:bg-${item.color}-900/30 rounded-lg`}>
                          {item.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {item.title}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              Coming Soon
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled
                        className="gap-2 opacity-50"
                      >
                        Configure
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
            <CardHeader className="relative border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Notification Settings</CardTitle>
                  <CardDescription className="mt-1">
                    Configure how you receive notifications
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-6 md:p-8 space-y-6">
              <div className="space-y-6">
                {[
                  { 
                    icon: <Bell className="h-5 w-5" />, 
                    title: "Email Notifications", 
                    description: "Receive important updates via email",
                    id: "email-notif",
                    defaultChecked: true,
                    color: "amber"
                  },
                  { 
                    icon: <Users className="h-5 w-5" />, 
                    title: "Student Absence Alerts", 
                    description: "Get notified when a student is marked absent",
                    id: "absence-alerts",
                    defaultChecked: true,
                    color: "rose"
                  },
                  { 
                    icon: <Download className="h-5 w-5" />, 
                    title: "System Updates", 
                    description: "Receive notifications about system updates and maintenance",
                    id: "system-updates",
                    defaultChecked: false,
                    color: "blue"
                  }
                ].map((item, index) => (
                  <div key={index} className="group flex items-center justify-between p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 hover:shadow-md hover:border-amber-300/50 dark:hover:border-amber-700/50 transition-all duration-200">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 bg-${item.color}-100 dark:bg-${item.color}-900/30 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                        {item.icon}
                      </div>
                      <div>
                        <Label htmlFor={item.id} className="text-base font-semibold cursor-pointer">{item.title}</Label>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                    <Switch 
                      id={item.id} 
                      defaultChecked={item.defaultChecked}
                      className="data-[state=checked]:bg-amber-600"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
            <CardHeader className="relative border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Report Settings</CardTitle>
                  <CardDescription className="mt-1">
                    Configure report generation options
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-6 md:p-8 space-y-8">
              {/* Report Format Selection */}
              <div className="space-y-4 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <Label className="text-base font-semibold">Report Format</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Choose your preferred export format</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  {[
                    { value: 'pdf', label: 'PDF', icon: <FileText className="h-4 w-4" /> },
                    { value: 'excel', label: 'Excel', icon: <FileText className="h-4 w-4" /> },
                    { value: 'csv', label: 'CSV', icon: <FileText className="h-4 w-4" /> }
                  ].map((format) => (
                    <Button
                      key={format.value}
                      variant={reportFormat === format.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReportFormat(format.value)}
                      className={reportFormat === format.value
                        ? "gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
                        : "gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700"
                      }
                    >
                      {format.icon}
                      {format.label}
                      {reportFormat === format.value && <Check className="ml-1 h-3 w-3" />}
                    </Button>
                  ))}
                </div>
              </div>
              
              <Separator className="bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
              
              {/* School Logo Upload */}
              <div className="space-y-4 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="school-logo" className="text-base font-semibold">School Logo</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Upload your institution logo for reports (PNG, JPG, max 2MB)</p>
                  </div>
                </div>
                <div className="relative mt-4">
                  <Input 
                    id="school-logo" 
                    type="file" 
                    accept="image/*"
                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300 dark:hover:file:bg-blue-900/50"
                  />
                </div>
              </div>
              
              <Separator className="bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
              
              {/* Additional Options */}
              <div className="space-y-4">
                <div className="group flex items-center justify-between p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 hover:shadow-md hover:border-purple-300/50 dark:hover:border-purple-700/50 transition-all duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform duration-200">
                      <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <Label htmlFor="signature" className="text-base font-semibold cursor-pointer">Include Digital Signature</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Add authorized signature to generated reports</p>
                    </div>
                  </div>
                  <Switch id="signature" defaultChecked className="data-[state=checked]:bg-purple-600" />
                </div>
                
                <div className="space-y-3 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                      <Printer className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="printer-settings" className="text-base font-semibold">Default Printer</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Set your preferred printer for quick access</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Input 
                      id="printer-settings" 
                      placeholder="Select printer" 
                      defaultValue="HP LaserJet 4200"
                      className="flex-1"
                    />
                    <Button variant="outline" size="icon" className="shrink-0 hover:bg-teal-50 dark:hover:bg-teal-950/30">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="account" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-pink-500/5 pointer-events-none" />
            <CardHeader className="relative border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Account Settings</CardTitle>
                  <CardDescription className="mt-1">
                    Manage your account information and security
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-6 md:p-8 space-y-8">
              {/* Profile Information */}
              <div className="space-y-5 p-6 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 via-white/50 to-blue-50/30 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-blue-950/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold">Profile Information</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                    <Input 
                      id="email" 
                      value={user?.email || ''} 
                      disabled 
                      className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name" className="text-sm font-semibold">First Name</Label>
                      <Input 
                        id="first-name" 
                        placeholder="Enter your first name"
                        className="border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name" className="text-sm font-semibold">Last Name</Label>
                      <Input 
                        id="last-name" 
                        placeholder="Enter your last name"
                        className="border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator className="bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
              
              {/* Password Change */}
              <div className="space-y-5 p-6 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 via-white/50 to-rose-50/30 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-rose-950/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                    <Lock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h3 className="text-lg font-semibold">Change Password</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password" className="text-sm font-semibold">Current Password</Label>
                    <PasswordInput 
                      id="current-password" 
                      placeholder="Enter current password"
                      className="border-slate-300 dark:border-slate-700 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-rose-500/20"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-sm font-semibold">New Password</Label>
                      <PasswordInput 
                        id="new-password" 
                        placeholder="Enter new password"
                        className="border-slate-300 dark:border-slate-700 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-rose-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-sm font-semibold">Confirm Password</Label>
                      <PasswordInput 
                        id="confirm-password" 
                        placeholder="Confirm new password"
                        className="border-slate-300 dark:border-slate-700 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-2">
                    <Button className="gap-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40">
                      <Save className="h-4 w-4" />
                      Update Password
                    </Button>
                  </div>
                </div>
              </div>
              
              <Separator className="bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
              
              {/* Security Settings */}
              <div className="space-y-4">
                <div className="group flex items-center justify-between p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 hover:shadow-md hover:border-emerald-300/50 dark:hover:border-emerald-700/50 transition-all duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg group-hover:scale-110 transition-transform duration-200">
                      <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <Label htmlFor="2fa" className="text-base font-semibold cursor-pointer">Two-Factor Authentication</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Add an extra layer of security to your account</p>
                    </div>
                  </div>
                  <Switch id="2fa" className="data-[state=checked]:bg-emerald-600" />
                </div>
                
                <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 hover:shadow-md hover:border-blue-300/50 dark:hover:border-blue-700/50 transition-all duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-base font-semibold">Data Privacy</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Manage how your data is collected and used</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700"
                  >
                    <Eye className="h-4 w-4" />
                    Manage
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
    </div>
  );
};

export default SettingsPage;
