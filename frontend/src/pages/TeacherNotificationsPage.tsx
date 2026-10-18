import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import { cn } from '@/lib/utils';
import {
  Alert20Regular,
  Alert24Regular,
  ArrowSync20Regular,
  Book16Regular,
  Checkmark16Regular,
  CheckmarkCircle20Filled,
  Clock12Regular,
  Delete16Regular,
  Dismiss16Regular,
  DismissCircle20Filled,
  History20Regular,
  Info16Regular,
  Info20Filled,
  MailInbox20Regular,
  People16Regular,
  Send20Regular,
  Warning16Regular,
  Warning20Filled,
} from '@fluentui/react-icons';
import { api } from '@/integrations/api/client';

interface TeacherClass {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  semester: number;
  faculty_id: number;
  faculty_name: string;
  student_count: number;
}

interface SentNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  created_at: string;
  payload?: {
    subject_id?: number;
    semester?: number;
  };
}

interface InboxNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  scope: string;
  created_at: string;
  payload?: Record<string, unknown> | null;
  is_read: boolean;
}

const TeacherNotificationsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);

  // Form state
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [priority, setPriority] = useState<string>('medium');
  const [notificationType, setNotificationType] = useState<string>('info');

  // Fetch teacher's classes
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: async () => {
      const response = await api.teacher.getMyClasses();
      return response as TeacherClass[];
    }
  });

  // Fetch sent notifications
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['teacher-notifications'],
    queryFn: async () => {
      const response = await api.teacher.getNotifications();
      return response as SentNotification[];
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch inbox notifications for current teacher
  const { data: inbox = [], isLoading: inboxLoading } = useQuery({
    queryKey: ['teacher-inbox', { onlyUnread }],
    queryFn: async () => {
      const response = await api.teacher.getInbox(onlyUnread, 0, 20);
      return response as InboxNotification[];
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      message: string;
      subject_id: number;
      semester: number;
      priority: string;
      type: string;
    }) => {
      return await api.teacher.sendNotification(data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Notification sent successfully',
        variant: 'default',
      });
      // Reset form
      setTitle('');
      setMessage('');
      setPriority('medium');
      setNotificationType('info');
      setSelectedClass(null);
      // Refresh notifications list
      queryClient.invalidateQueries({ queryKey: ['teacher-notifications'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send notification',
        variant: 'destructive',
      });
    }
  });

  const handleSendNotification = () => {
    if (!selectedClass) {
      toast({
        title: 'Error',
        description: 'Please select a class',
        variant: 'destructive',
      });
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter both title and message',
        variant: 'destructive',
      });
      return;
    }

    sendNotificationMutation.mutate({
      title,
      message,
      subject_id: selectedClass.subject_id,
      semester: selectedClass.semester,
      priority,
      type: notificationType
    });
  };

  // Mutations for inbox actions
  const markReadMutation = useMutation({
    mutationFn: async (id: number) => api.teacher.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-inbox'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error?.message || 'Failed to mark as read', variant: 'destructive' });
    },
  });

  const clearOneMutation = useMutation({
    mutationFn: async (id: number) => api.teacher.clearOne(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-inbox'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error?.message || 'Failed to dismiss', variant: 'destructive' });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => api.teacher.clearAll(),
    onSuccess: () => {
      toast({ title: 'Cleared', description: 'All notifications dismissed', variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['teacher-inbox'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error?.message || 'Failed to clear all', variant: 'destructive' });
    },
  });

  const getPriorityIcon = (p: string) => {
    switch (p) {
      case 'high':
        return <Warning16Regular className="text-status-error" aria-hidden />;
      case 'low':
        return <Info16Regular className="text-text-muted" aria-hidden />;
      default:
        return <Alert20Regular className="h-4 w-4 text-status-warning" aria-hidden />;
    }
  };

  /** Activity-feed icon chip, tinted by notification type. */
  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'success':
        return (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-success-subtle text-status-success">
            <CheckmarkCircle20Filled aria-hidden />
          </span>
        );
      case 'warning':
        return (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-warning-subtle text-status-warning">
            <Warning20Filled aria-hidden />
          </span>
        );
      case 'danger':
        return (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-error-subtle text-status-error">
            <DismissCircle20Filled aria-hidden />
          </span>
        );
      default:
        return (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand-foreground">
            <Info20Filled aria-hidden />
          </span>
        );
    }
  };

  const getPriorityBadgeVariant = (p: string): 'destructive' | 'warning' | 'secondary' => {
    switch (p) {
      case 'high':
        return 'destructive';
      case 'low':
        return 'secondary';
      default:
        return 'warning';
    }
  };

  const inboxTotal = Array.isArray(inbox) ? inbox.length : 0;
  const inboxUnread = Array.isArray(inbox) ? inbox.filter(n => !n.is_read).length : 0;

  return (
    <TeacherSidebar>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="page-header !mb-0">
          <div>
            <h1 className="text-page-title text-text-primary">Notifications Center</h1>
            <p className="mt-1 text-body text-text-muted">
              Broadcast class announcements to students and monitor system alerts
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Activity feed (inbox) */}
          <section className="flex flex-col rounded-lg bg-surface-default shadow lg:col-span-3">
            <div className="border-b border-border-subtle px-5 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-subheading text-text-primary">
                    <MailInbox20Regular className="text-brand-foreground" aria-hidden />
                    Institutional Inbox
                  </h2>
                  <p className="mt-0.5 text-caption text-text-muted">
                    Total: <strong className="font-semibold text-text-primary tabular-nums">{inboxTotal}</strong>
                    <span className="mx-1.5" aria-hidden>·</span>
                    Unread: <strong className="font-semibold text-brand-foreground tabular-nums">{inboxUnread}</strong>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending || (Array.isArray(inbox) && inbox.length === 0)}
                  className="text-status-error hover:bg-status-error-subtle hover:text-status-error"
                >
                  <Delete16Regular aria-hidden />
                  Clear All
                </Button>
              </div>

              {/* Fluent tab filters */}
              <div role="tablist" aria-label="Inbox filter" className="mt-3 flex gap-1">
                {[
                  { label: 'All', active: !onlyUnread, value: false },
                  { label: 'Unread', active: onlyUnread, value: true },
                ].map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={tab.active}
                    onClick={() => setOnlyUnread(tab.value)}
                    className={cn(
                      'relative px-3 pb-2.5 pt-1 text-body transition-colors duration-150 ease-fluent-standard',
                      tab.active
                        ? 'font-semibold text-text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-brand'
                        : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-2">
              {inboxLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-body text-text-muted">
                  <ArrowSync20Regular className="animate-spin text-brand-foreground" aria-hidden />
                  <span>Loading notifications...</span>
                </div>
              ) : Array.isArray(inbox) && inbox.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                    <Alert24Regular aria-hidden />
                  </div>
                  <p className="text-subheading text-text-primary">No notifications to display</p>
                  {onlyUnread && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOnlyUnread(false)}
                      className="mt-4"
                    >
                      Show All Notifications
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="max-h-[560px] space-y-0.5 overflow-y-auto">
                  {inbox.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        'group relative flex gap-3 rounded-md px-3 py-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover',
                        !n.is_read && 'bg-brand-subtle/40'
                      )}
                    >
                      {/* Unread brand dot */}
                      <span
                        className={cn(
                          'absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full',
                          n.is_read ? 'bg-transparent' : 'bg-brand'
                        )}
                        aria-hidden
                      />
                      {getTypeIcon(n.type)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-body', n.is_read ? 'text-text-secondary' : 'font-semibold text-text-primary')}>
                            {n.title}
                            {!n.is_read && <span className="sr-only"> (unread)</span>}
                          </p>
                          <span className="flex shrink-0 items-center gap-1 text-caption text-text-muted tabular-nums">
                            <Clock12Regular aria-hidden />
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-body text-text-secondary">{n.message}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-caption text-text-muted">
                            <Badge variant={getPriorityBadgeVariant(n.priority)} shape="pill" className="px-2 py-0 text-overline capitalize">
                              {n.priority}
                            </Badge>
                            <span className="capitalize">{n.scope.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {!n.is_read && (
                              <button
                                type="button"
                                className="grid h-7 w-7 place-items-center rounded text-text-muted transition-colors hover:bg-surface-pressed hover:text-status-success"
                                onClick={() => markReadMutation.mutate(n.id)}
                                disabled={markReadMutation.isPending}
                                title="Mark as read"
                                aria-label="Mark as read"
                              >
                                <Checkmark16Regular aria-hidden />
                              </button>
                            )}
                            <button
                              type="button"
                              className="grid h-7 w-7 place-items-center rounded text-text-muted transition-colors hover:bg-surface-pressed hover:text-status-error"
                              onClick={() => clearOneMutation.mutate(n.id)}
                              disabled={clearOneMutation.isPending}
                              title="Dismiss notification"
                              aria-label="Dismiss notification"
                            >
                              <Dismiss16Regular aria-hidden />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Compose announcement */}
          <section className="rounded-lg bg-surface-default shadow lg:col-span-2">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="flex items-center gap-2 text-subheading text-text-primary">
                <Send20Regular className="text-brand-foreground" aria-hidden />
                Dispatch Announcement
              </h2>
              <p className="mt-0.5 text-caption text-text-muted">
                Create and broadcast an official notification to your enrolled class
              </p>
            </div>
            <div className="space-y-4 p-5">
              {/* Class Selection */}
              <div className="space-y-1.5">
                <Label className="text-body-strong text-text-primary">Assigned Class</Label>
                <Select
                  value={selectedClass ? `${selectedClass.subject_id}:${selectedClass.semester}` : ''}
                  onValueChange={(value) => {
                    const [sid, sem] = value.split(":");
                    const sidNum = Number(sid);
                    const semNum = Number(sem);
                    const cls = classes.find(
                      (c) => c.subject_id === sidNum && c.semester === semNum
                    );
                    setSelectedClass(cls || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target course and semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {classesLoading ? (
                      <SelectItem value="loading" disabled>Loading classes...</SelectItem>
                    ) : classes.length === 0 ? (
                      <SelectItem value="empty" disabled>No classes assigned</SelectItem>
                    ) : (
                      classes.map((cls) => (
                        <SelectItem
                          key={`${cls.subject_id}-${cls.semester}`}
                          value={`${cls.subject_id}:${cls.semester}`}
                        >
                          {cls.subject_name} ({cls.subject_code}) – Sem {cls.semester}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedClass && (
                  <p className="flex items-center gap-1.5 text-caption text-text-muted">
                    <People16Regular className="text-brand-foreground" aria-hidden />
                    <span>{selectedClass.student_count} registered students will receive this notification</span>
                  </p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-body-strong text-text-primary">Notification Title</Label>
                <Input
                  type="text"
                  placeholder="e.g., Assignment 2 Deadline Extension"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label className="text-body-strong text-text-primary">Message Content</Label>
                <Textarea
                  placeholder="Type your announcement or instructional details..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Priority and Type */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-body-strong text-text-primary">Urgency Level</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Standard Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-body-strong text-text-primary">Category</Label>
                  <Select value={notificationType} onValueChange={setNotificationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Informational</SelectItem>
                      <SelectItem value="success">Confirmation / Success</SelectItem>
                      <SelectItem value="warning">Academic Warning</SelectItem>
                      <SelectItem value="danger">Urgent Notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Send Button */}
              <div className="flex justify-end border-t border-border-subtle pt-4">
                <Button
                  onClick={handleSendNotification}
                  disabled={sendNotificationMutation.isPending || !selectedClass}
                >
                  {sendNotificationMutation.isPending ? (
                    <>
                      <ArrowSync20Regular className="animate-spin" aria-hidden />
                      Broadcasting...
                    </>
                  ) : (
                    <>
                      <Send20Regular aria-hidden />
                      Publish Announcement
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* Sent Notifications History */}
        <section className="rounded-lg bg-surface-default shadow">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="flex items-center gap-2 text-subheading text-text-primary">
              <History20Regular className="text-brand-foreground" aria-hidden />
              Published Announcements Log
            </h2>
            <p className="mt-0.5 text-caption text-text-muted">
              Record of broadcasts delivered to assigned courses
            </p>
          </div>
          <div className="p-2">
            {notificationsLoading ? (
              <div className="py-8 text-center text-body text-text-muted">Loading broadcast history...</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                  <Send20Regular className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-subheading text-text-primary">No sent notifications on record</p>
              </div>
            ) : (
              <ul className="max-h-[400px] divide-y divide-border-subtle overflow-y-auto">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="flex gap-3 rounded-md px-3 py-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
                  >
                    {getTypeIcon(notification.type)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-body-strong text-text-primary">{notification.title}</p>
                        <div className="flex items-center gap-1.5">
                          {getPriorityIcon(notification.priority)}
                          <Badge variant={getPriorityBadgeVariant(notification.priority)} shape="pill" className="px-2 py-0 text-overline capitalize">
                            {notification.priority}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-0.5 text-body text-text-secondary">{notification.message}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
                        {notification.payload && (
                          <span className="flex items-center gap-1">
                            <Book16Regular className="text-brand-foreground" aria-hidden />
                            <span>Course ID: {notification.payload.subject_id}</span>
                            {notification.payload.semester && (
                              <span>· Sem {notification.payload.semester}</span>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock12Regular aria-hidden />
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherNotificationsPage;
