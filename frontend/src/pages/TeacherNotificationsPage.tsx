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
  Bell, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  XCircle,
  Users,
  BookOpen
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

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  created_at: string;
  metadata?: {
    subject_id?: number;
    semester?: number;
  };
}

const TeacherNotificationsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      return response as Notification[];
    }
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
                  value={selectedClass?.subject_id.toString() || ''}
                  onValueChange={(value) => {
                    const cls = classes.find(c => c.subject_id.toString() === value);
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
                        <SelectItem key={`${cls.subject_id}-${cls.semester}`} value={cls.subject_id.toString()}>
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

          {/* Notification History */}
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
                      {notification.metadata && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <BookOpen className="w-3 h-3" />
                          <span>Subject ID: {notification.metadata.subject_id}</span>
                          {notification.metadata.semester && (
                            <span>• Semester {notification.metadata.semester}</span>
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
