import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import { 
  Send, 
  Bell, 
  BellRing,
  AlertCircle, 
  Info, 
  CheckCircle, 
  XCircle,
  Users,
  BookOpen,
  Clock,
  User,
  AlertTriangle,
  Megaphone,
  X,
  Trash2
} from 'lucide-react';
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
        variant: 'success',
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
      toast({ title: 'Cleared', description: 'All notifications dismissed', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['teacher-inbox'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error?.message || 'Failed to clear all', variant: 'destructive' });
    },
  });

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'low':
        return <Info className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-amber-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'danger':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-rose-500/20 text-rose-300 border-rose-400/30';
      case 'low':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
    }
  };

  return (
    <TeacherSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-slate-400">Send notifications to students in your assigned classes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Notification Form */}
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardHeader className="border-b border-slate-800/50">
              <CardTitle className="flex items-center gap-2 text-white">
                <Send className="w-5 h-5" />
                Send Notification
              </CardTitle>
              <CardDescription className="text-slate-400">
                Create and send a notification to students
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Class Selection */}
              <div className="space-y-2">
                <Label className="text-slate-300">Select Class</Label>
                <Select
                  // Use composite value to uniquely identify class by subject and semester
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
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {classesLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : classes.length === 0 ? (
                      <SelectItem value="empty" disabled>No classes found</SelectItem>
                    ) : (
                      classes.map((cls) => (
                        <SelectItem
                          key={`${cls.subject_id}-${cls.semester}`}
                          value={`${cls.subject_id}:${cls.semester}`}
                        >
                          {cls.subject_name} ({cls.subject_code}) - Semester {cls.semester}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedClass && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                    <Users className="w-4 h-4" />
                    <span>{selectedClass.student_count} students will receive this notification</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label className="text-slate-300">Title</Label>
                <Input
                  type="text"
                  placeholder="Enter notification title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label className="text-slate-300">Message</Label>
                <Textarea
                  placeholder="Enter your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                />
              </div>

              {/* Priority and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Type</Label>
                  <Select value={notificationType} onValueChange={setNotificationType}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="danger">Danger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Send Button */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleSendNotification}
                disabled={sendNotificationMutation.isPending || !selectedClass}
              >
                <Send className="w-4 h-4 mr-2" />
                {sendNotificationMutation.isPending ? 'Sending...' : 'Send Notification'}
              </Button>
            </CardContent>
          </Card>

          {/* Inbox */}
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardHeader className="border-b border-slate-800/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-white text-xl mb-2">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                        <BellRing className="w-5 h-5 text-white" />
                      </div>
                      Inbox
                    </CardTitle>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/50 border border-slate-700">
                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                        <span className="text-slate-300 font-medium">{Array.isArray(inbox) ? inbox.length : 0}</span>
                        <span className="text-slate-500">Total</span>
                      </span>
                      <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                        <span className="text-blue-400 font-medium">{Array.isArray(inbox) ? inbox.filter(n => !n.is_read).length : 0}</span>
                        <span className="text-blue-300/70">Unread</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Modern Toggle Button */}
                  <button
                    onClick={() => setOnlyUnread(!onlyUnread)}
                    className={`
                      group relative flex items-center gap-2.5 px-4 py-2 rounded-xl font-medium text-sm
                      transition-all duration-300 ease-out overflow-hidden
                      ${onlyUnread 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50' 
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                      }
                      hover:scale-105 active:scale-95
                    `}
                  >
                    <div className={`
                      flex items-center justify-center w-4 h-4 rounded-lg transition-all duration-300
                      ${onlyUnread ? 'bg-white/20 shadow-inner' : 'bg-slate-700/50'}
                    `}>
                      <Bell className={`h-3 w-3 transition-all duration-300 ${onlyUnread ? 'text-white animate-pulse' : 'text-slate-400'}`} />
                    </div>
                    <span className="relative z-10">{onlyUnread ? "Unread Only" : "Show All"}</span>
                    {onlyUnread && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 animate-shimmer"></div>
                    )}
                  </button>

                  {/* Modern Clear All Button */}
                  <button
                    onClick={() => clearAllMutation.mutate()}
                    disabled={clearAllMutation.isPending || (Array.isArray(inbox) && inbox.length === 0)}
                    className={`
                      group flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                      transition-all duration-300 ease-out
                      ${clearAllMutation.isPending || (Array.isArray(inbox) && inbox.length === 0)
                        ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-red-500/10 to-pink-500/10 text-red-400 border border-red-500/30 hover:border-red-500/50 hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 hover:scale-105 hover:shadow-lg hover:shadow-red-500/20 active:scale-95'
                      }
                    `}
                  >
                    <Trash2 className={`h-4 w-4 transition-transform duration-300 ${!(clearAllMutation.isPending || (Array.isArray(inbox) && inbox.length === 0)) ? 'group-hover:rotate-12' : ''}`} />
                    Clear All
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {inboxLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <p>Loading notifications...</p>
                  </div>
                </div>
              ) : Array.isArray(inbox) && inbox.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <div className="space-y-3">
                    <p className="text-slate-300 font-medium">No notifications to display</p>
                    {onlyUnread && (
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => setOnlyUnread(false)}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800/70 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all hover:scale-105"
                        >
                          Show All Notifications
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {inbox.map((n) => (
                    <div key={n.id} className={`relative p-4 rounded-lg border transition-all hover:border-slate-600/50 ${
                      n.is_read 
                        ? 'bg-slate-800/30 border-slate-700/30' 
                        : 'bg-slate-800/60 border-slate-700/70 border-l-4 border-l-blue-500'
                    }`}>
                      {/* Unread indicator */}
                      {!n.is_read && (
                        <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}

                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(n.type)}
                          <h4 className={`font-semibold ${n.is_read ? 'text-slate-300' : 'text-white'}`}>{n.title}</h4>
                        </div>
                        <Badge variant="outline" className={`text-xs ${getPriorityBadgeColor(n.priority)}`}>
                          {n.priority.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Message */}
                      <p className={`text-sm mb-3 ${n.is_read ? 'text-slate-400' : 'text-slate-200'}`}>{n.message}</p>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/30">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(n.created_at).toLocaleString()}</span>
                          </div>
                          <div className="px-2 py-1 rounded-md bg-slate-900/30 capitalize">
                            {n.scope.replace('_', ' ')}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!n.is_read && (
                            <button
                              className="group p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 hover:border-green-500/50 transition-all duration-200 hover:scale-110 active:scale-95"
                              onClick={() => markReadMutation.mutate(n.id)}
                              disabled={markReadMutation.isPending}
                              title="Mark as read"
                            >
                              <CheckCircle className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform duration-200" />
                            </button>
                          )}
                          <button
                            className="group p-2 rounded-lg bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all duration-200 hover:scale-110 active:scale-95"
                            onClick={() => clearOneMutation.mutate(n.id)}
                            disabled={clearOneMutation.isPending}
                            title="Dismiss"
                          >
                            <X className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-200" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification History (Sent) */}
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardHeader className="border-b border-slate-800/50">
              <CardTitle className="flex items-center gap-2 text-white">
                <Bell className="w-5 h-5" />
                Sent Notifications
              </CardTitle>
              <CardDescription className="text-slate-400">
                Your recent notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {notificationsLoading ? (
                <div className="text-center py-8 text-slate-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No notifications sent yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/70 hover:border-slate-600/70 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(notification.type)}
                          <h4 className="font-semibold text-white">{notification.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(notification.priority)}
                          <Badge
                            variant="outline"
                            className={getPriorityBadgeColor(notification.priority)}
                          >
                            {notification.priority}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400 mb-3">{notification.message}</p>
                      {notification.payload && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <BookOpen className="w-3 h-3" />
                          <span>Subject ID: {notification.payload.subject_id as any}</span>
                          {notification.payload.semester && (
                            <span>• Semester {notification.payload.semester as any}</span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-2">
                        {new Date(notification.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherNotificationsPage;
