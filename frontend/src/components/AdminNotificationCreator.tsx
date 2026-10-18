import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { notificationService, type CreateNotificationRequest, type Faculty } from '@/services/notificationService';
import {
  Send20Regular,
  Globe16Regular,
  PeopleTeam16Regular,
  Person16Regular,
  Warning16Regular,
  Info16Regular,
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
  Megaphone16Regular,
  Checkmark16Regular,
  Eye16Regular,
} from '@fluentui/react-icons';

const AdminNotificationCreator: React.FC = () => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<CreateNotificationRequest>({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
    scope: 'global_scope',
    target_faculty_id: '',
    target_user_id: ''
  });

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFaculties, setIsLoadingFaculties] = useState(false);

  // Load faculties when component mounts
  useEffect(() => {
    const loadFaculties = async () => {
      setIsLoadingFaculties(true);
      try {
        const facultiesData = await notificationService.getFaculties();
        setFaculties(facultiesData);
      } catch (error) {
        console.error('Failed to load faculties:', error);
        toast({
          title: "Error",
          description: "Failed to load faculties",
          variant: "destructive"
        });
      } finally {
        setIsLoadingFaculties(false);
      }
    };

    loadFaculties();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and message are required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await notificationService.createNotification(formData);
      
      toast({
        title: "Notification Sent!",
        description: `${result.message} (${result.recipients_count} recipients)`,
        variant: "default"
      });
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        type: 'info',
        priority: 'medium',
        scope: 'global_scope',
        target_faculty_id: '',
        target_user_id: ''
      });
      
    } catch (error) {
      console.error('Error creating notification:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send notification",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info16Regular aria-hidden />;
      case 'warning': return <Warning16Regular aria-hidden />;
      case 'success': return <CheckmarkCircle16Regular aria-hidden />;
      case 'danger': return <ErrorCircle16Regular aria-hidden />;
      case 'announcement': return <Megaphone16Regular aria-hidden />;
      default: return <Info16Regular aria-hidden />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'text-status-info bg-status-info-subtle border-status-info-border';
      case 'warning': return 'text-status-warning bg-status-warning-subtle border-status-warning-border';
      case 'success': return 'text-status-success bg-status-success-subtle border-status-success-border';
      case 'danger': return 'text-status-error bg-status-error-subtle border-status-error-border';
      case 'announcement': return 'text-brand-foreground bg-brand-subtle border-brand-stroke';
      default: return 'text-status-info bg-status-info-subtle border-status-info-border';
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'global': return <Globe16Regular aria-hidden />;
      case 'faculty_specific': return <PeopleTeam16Regular aria-hidden />;
      case 'individual': return <Person16Regular aria-hidden />;
      default: return <Globe16Regular aria-hidden />;
    }
  };

  // Priority chips use Fluent status tokens (urgent=error, high=warning, medium=info, low=neutral)
  const priorityOptions: Array<{ value: CreateNotificationRequest['priority']; label: string; selected: string }> = [
    { value: 'low', label: 'Low', selected: 'border-border-strong bg-surface-selected text-text-primary' },
    { value: 'medium', label: 'Medium', selected: 'border-status-info-border bg-status-info-subtle text-status-info' },
    { value: 'high', label: 'High', selected: 'border-status-warning-border bg-status-warning-subtle text-status-warning' },
    { value: 'urgent', label: 'Urgent', selected: 'border-status-error-border bg-status-error-subtle text-status-error' },
  ];

  const scopeOptions: Array<{ value: CreateNotificationRequest['scope']; label: string; icon: React.ReactNode }> = [
    { value: 'global_scope', label: 'All Students', icon: <Globe16Regular aria-hidden /> },
    { value: 'faculty_specific', label: 'Specific Faculty', icon: <PeopleTeam16Regular aria-hidden /> },
    { value: 'individual', label: 'Individual Student', icon: <Person16Regular aria-hidden /> },
  ];

  const chipBase =
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body transition-colors duration-150 ease-fluent-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const chipIdle = 'border-border-default bg-surface-default text-text-secondary hover:bg-surface-hover hover:text-text-primary';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-0 shadow overflow-hidden">
        <CardHeader className="border-b border-border-subtle px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <Send20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Send Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 p-5">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-body-strong text-text-primary">
                  Title <span className="text-status-error">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter notification title"
                  maxLength={200}
                />
                <p className="text-right text-caption text-text-muted tabular-nums">{formData.title.length}/200 characters</p>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-body-strong text-text-primary">
                  Message <span className="text-status-error">*</span>
                </Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter your message"
                  rows={4}
                  className="resize-none"
                  maxLength={2000}
                />
                <p className="text-right text-caption text-text-muted tabular-nums">{formData.message.length}/2000 characters</p>
              </div>

              {/* Type */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-body-strong text-text-primary">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: CreateNotificationRequest['type']) =>
                      setFormData(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info16Regular className="text-status-info" aria-hidden />
                          Information
                        </div>
                      </SelectItem>
                      <SelectItem value="warning">
                        <div className="flex items-center gap-2">
                          <Warning16Regular className="text-status-warning" aria-hidden />
                          Warning
                        </div>
                      </SelectItem>
                      <SelectItem value="success">
                        <div className="flex items-center gap-2">
                          <CheckmarkCircle16Regular className="text-status-success" aria-hidden />
                          Success
                        </div>
                      </SelectItem>
                      <SelectItem value="danger">
                        <div className="flex items-center gap-2">
                          <ErrorCircle16Regular className="text-status-error" aria-hidden />
                          Danger
                        </div>
                      </SelectItem>
                      <SelectItem value="announcement">
                        <div className="flex items-center gap-2">
                          <Megaphone16Regular className="text-brand-foreground" aria-hidden />
                          Announcement
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority (status chips) */}
                <div className="space-y-1.5">
                  <Label id="priority-label" className="text-body-strong text-text-primary">Priority</Label>
                  <div role="radiogroup" aria-labelledby="priority-label" className="flex flex-wrap gap-2">
                    {priorityOptions.map((option) => {
                      const selected = formData.priority === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setFormData(prev => ({ ...prev, priority: option.value }))}
                          className={`${chipBase} ${selected ? `${option.selected} font-semibold` : chipIdle}`}
                        >
                          {selected && <Checkmark16Regular aria-hidden />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Scope (audience chips) */}
              <div className="space-y-1.5">
                <Label id="audience-label" className="text-body-strong text-text-primary">Target Audience</Label>
                <div role="radiogroup" aria-labelledby="audience-label" className="flex flex-wrap gap-2">
                  {scopeOptions.map((option) => {
                    const selected = formData.scope === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setFormData(prev => ({ ...prev, scope: option.value, target_faculty_id: '', target_user_id: '' }))
                        }
                        className={`${chipBase} ${
                          selected ? 'border-brand-stroke bg-brand-subtle font-semibold text-brand-foreground' : chipIdle
                        }`}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faculty Selection (when faculty_specific is selected) */}
              {formData.scope === 'faculty_specific' && (
                <div className="space-y-1.5">
                  <Label className="text-body-strong text-text-primary">Select Faculty</Label>
                  <Select
                    value={formData.target_faculty_id || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, target_faculty_id: value }))}
                    disabled={isLoadingFaculties}
                  >
                    <SelectTrigger className="md:max-w-md">
                      <SelectValue placeholder={isLoadingFaculties ? "Loading faculties..." : "Select a faculty"} />
                    </SelectTrigger>
                    <SelectContent>
                      {faculties.map((faculty) => (
                        <SelectItem key={faculty.id} value={faculty.id.toString()}>
                          <div className="flex w-full items-center justify-between">
                            <span>{faculty.name}</span>
                            <span className="ml-2 text-caption text-text-muted">({faculty.student_count} students)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end border-t border-border-subtle bg-surface-subtle px-5 py-3">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={isLoading || !formData.title.trim() || !formData.message.trim()}
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-on border-t-transparent" aria-hidden></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send20Regular aria-hidden />
                    Send Notification
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview (Teams activity card) */}
      <Card className="h-fit border-0 shadow overflow-hidden lg:sticky lg:top-4">
        <CardHeader className="border-b border-border-subtle px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <Eye16Regular className="shrink-0 text-text-muted" aria-hidden />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-default p-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${getTypeColor(formData.type)}`}>
              {getTypeIcon(formData.type)}
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="break-words text-body-strong text-text-primary">{formData.title || 'Notification Title'}</h5>
              <p className="mt-0.5 break-words text-body text-text-secondary">
                {formData.message || 'Your notification message will appear here...'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge shape="pill" className={`gap-1 border ${getTypeColor(formData.type)}`}>
                  {getTypeIcon(formData.type)}
                  <span className="capitalize">{formData.type}</span>
                </Badge>
                <Badge variant="outline" shape="pill" className="gap-1 text-text-secondary">
                  {getScopeIcon(formData.scope)}
                  <span className="capitalize">{formData.scope.replace('_', ' ')}</span>
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotificationCreator;
