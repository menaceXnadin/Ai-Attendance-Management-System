import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import { 
  Send, 
  Notification, 
  NotificationNew, 
  WarningAlt, 
  Information, 
  CheckmarkFilled, 
  CloseFilled, 
  UserMultiple, 
  Book, 
  Time, 
  TrashCan, 
  Close, 
  Checkmark,
  Renew
} from '@carbon/icons-react';
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
        return <WarningAlt className="w-3.5 h-3.5 text-status-error" />;
      case 'low':
        return <Information className="w-3.5 h-3.5 text-text-muted" />;
      default:
        return <Notification className="w-3.5 h-3.5 text-status-warning" />;
    }
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'success':
        return <CheckmarkFilled className="w-4 h-4 text-status-success" />;
      case 'warning':
        return <WarningAlt className="w-4 h-4 text-status-warning" />;
      case 'danger':
        return <CloseFilled className="w-4 h-4 text-status-error" />;
      default:
        return <Information className="w-4 h-4 text-action-primary" />;
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

  return (
    <TeacherSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Notifications Center</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Broadcast class announcements to students and monitor system alerts
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Notification Form */}
          <Card className="border border-border-subtle bg-surface-default shadow-card">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-text-primary">
                <Send className="w-4 h-4 text-action-primary" />
                Dispatch Announcement
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Create and broadcast an official notification to your enrolled class
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Class Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Assigned Class</Label>
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
                  <SelectTrigger className="h-9">
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
                  <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
                    <UserMultiple className="w-3.5 h-3.5 text-action-primary" />
                    <span>{selectedClass.student_count} registered students will receive this notification</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Notification Title</Label>
                <Input
                  type="text"
                  placeholder="e.g., Assignment 2 Deadline Extension"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Message Content</Label>
                <Textarea
                  placeholder="Type your announcement or instructional details..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Priority and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-text-secondary">Urgency Level</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-9">
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
                  <Label className="text-xs font-medium text-text-secondary">Category</Label>
                  <Select value={notificationType} onValueChange={setNotificationType}>
                    <SelectTrigger className="h-9">
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
              <Button
                className="w-full mt-2"
                onClick={handleSendNotification}
                disabled={sendNotificationMutation.isPending || !selectedClass}
              >
                {sendNotificationMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Renew className="w-4 h-4 animate-spin" />
                    Broadcasting...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Send className="w-4 h-4 mr-1" />
                    Publish Announcement
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Inbox Feed */}
          <Card className="border border-border-subtle bg-surface-default shadow-card flex flex-col">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-text-primary">
                    <NotificationNew className="w-4 h-4 text-action-primary" />
                    Institutional Inbox
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-muted">
                      Total: <strong className="text-text-primary">{Array.isArray(inbox) ? inbox.length : 0}</strong>
                    </span>
                    <span className="text-xs text-text-muted">•</span>
                    <span className="text-xs text-text-muted">
                      Unread: <strong className="text-action-primary">{Array.isArray(inbox) ? inbox.filter(n => !n.is_read).length : 0}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={onlyUnread ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setOnlyUnread(!onlyUnread)}
                    className="text-xs h-8"
                  >
                    {onlyUnread ? "Show All" : "Unread Only"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearAllMutation.mutate()}
                    disabled={clearAllMutation.isPending || (Array.isArray(inbox) && inbox.length === 0)}
                    className="text-xs h-8 text-status-error hover:bg-status-error/10 hover:text-status-error"
                  >
                    <TrashCan className="w-3.5 h-3.5 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex-1">
              {inboxLoading ? (
                <div className="text-center py-12 text-sm text-text-muted flex items-center justify-center gap-2">
                  <Renew className="w-4 h-4 animate-spin text-action-primary" />
                  <span>Loading notifications...</span>
                </div>
              ) : Array.isArray(inbox) && inbox.length === 0 ? (
                <div className="text-center py-12 text-text-muted space-y-2">
                  <Notification className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm font-medium text-text-secondary">No notifications to display</p>
                  {onlyUnread && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOnlyUnread(false)}
                      className="text-xs"
                    >
                      Show All Notifications
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {inbox.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-3.5 rounded-lg border transition-all ${
                        n.is_read 
                          ? 'bg-surface-canvas/60 border-border-subtle' 
                          : 'bg-surface-default border-border-subtle border-l-4 border-l-action-primary shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(n.type)}
                          <h4 className={`text-sm font-semibold ${n.is_read ? 'text-text-secondary' : 'text-text-primary'}`}>
                            {n.title}
                          </h4>
                        </div>
                        <Badge variant={getPriorityBadgeVariant(n.priority)} className="text-[10px] px-1.5 py-0.5 uppercase">
                          {n.priority}
                        </Badge>
                      </div>

                      <p className="text-xs text-text-secondary mb-2.5 leading-relaxed">{n.message}</p>

                      <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 border-t border-border-subtle">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Time className="w-3 h-3" />
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{n.scope.replace('_', ' ')}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {!n.is_read && (
                            <button
                              className="p-1 rounded text-status-success hover:bg-status-success/10 transition-colors"
                              onClick={() => markReadMutation.mutate(n.id)}
                              disabled={markReadMutation.isPending}
                              title="Mark as read"
                            >
                              <Checkmark className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            className="p-1 rounded text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
                            onClick={() => clearOneMutation.mutate(n.id)}
                            disabled={clearOneMutation.isPending}
                            title="Dismiss notification"
                          >
                            <Close className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sent Notifications History */}
        <Card className="border border-border-subtle bg-surface-default shadow-card">
          <CardHeader className="border-b border-border-subtle pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <Notification className="w-4 h-4 text-action-primary" />
              Published Announcements Log
            </CardTitle>
            <CardDescription className="text-xs text-text-muted">
              Record of broadcasts delivered to assigned courses
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {notificationsLoading ? (
              <div className="text-center py-8 text-xs text-text-muted">Loading broadcast history...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 text-text-muted">
                <Notification className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium text-text-secondary">No sent notifications on record</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 bg-surface-canvas rounded-lg border border-border-subtle space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(notification.type)}
                        <h4 className="text-sm font-semibold text-text-primary">{notification.title}</h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getPriorityIcon(notification.priority)}
                        <Badge variant={getPriorityBadgeVariant(notification.priority)} className="text-[10px] px-1.5 py-0.5">
                          {notification.priority}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{notification.message}</p>
                    {notification.payload && (
                      <div className="flex items-center gap-2 text-xs text-text-muted pt-1">
                        <Book className="w-3.5 h-3.5 text-action-primary" />
                        <span>Course ID: {notification.payload.subject_id}</span>
                        {notification.payload.semester && (
                          <span>• Sem {notification.payload.semester}</span>
                        )}
                      </div>
                    )}
                    <div className="text-[11px] text-text-muted pt-1 border-t border-border-subtle flex items-center gap-1">
                      <Time className="w-3 h-3" />
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherNotificationsPage;
