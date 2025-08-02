import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/useAuth';
import { notificationService, type Notification as ApiNotification } from '@/services/notificationService';
import { 
  Bell, 
  BellRing, 
  Clock, 
  User, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  AlertCircle,
  Trash2,
  Megaphone
} from 'lucide-react';

interface Notification extends Omit<ApiNotification, 'id'> {
  id: number;
  timestamp: string;
  action_url?: string;
}

const EnhancedNotificationSystem: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth(); // Get current user to check role
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Load notifications when component mounts
  useEffect(() => {
    const loadNotifications = async () => {
      setIsLoading(true);
      try {
        console.log('[Frontend] Fetching notifications for user:', user?.email, 'Role:', user?.role);
        const notificationsData = await notificationService.getNotifications();
        console.log('[Frontend] Received notifications data:', notificationsData);
        
        // Ensure notificationsData is an array before mapping
        const notificationsArray = Array.isArray(notificationsData) ? notificationsData : [];
        console.log('[Frontend] Notifications array length:', notificationsArray.length);

        // Log each notification for debugging
        notificationsArray.forEach((notif, index) => {
          console.log(`[Frontend] Notification ${index + 1}:`, {
            id: notif.id,
            title: notif.title,
            scope: notif.scope,
            target_faculty_id: 'target_faculty_id' in notif ? (notif as unknown as {target_faculty_id: number}).target_faculty_id : 'N/A'
          });
        });

        // Transform API data to include action_url and adjust timestamp format
        const transformedNotifications = notificationsArray.map(notif => ({
          ...notif,
          timestamp: notif.created_at,
          action_url: notif.type === 'announcement' ? '/student-dashboard' : undefined
        }));

        // Sort notifications by timestamp descending
        const sortedNotifications = transformedNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(sortedNotifications);
        console.log('[Frontend] Final notifications set:', sortedNotifications.length, 'notifications');
      } catch (error) {
        console.error('Failed to load notifications:', error);
        toast({
          title: "Error",
          description: "Failed to load notifications",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();
  }, [toast, user?.email, user?.role]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-4 w-4 text-blue-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'danger': return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'announcement': return <Megaphone className="h-4 w-4 text-purple-400" />;
      default: return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'border-blue-500/50 bg-blue-500/10';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10';
      case 'success': return 'border-green-500/50 bg-green-500/10';
      case 'danger': return 'border-red-500/50 bg-red-500/10';
      case 'announcement': return 'border-purple-500/50 bg-purple-500/10';
      default: return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'low': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const markAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      // Call the service to delete on the backend
      await notificationService.deleteNotification(id);
      // On success, remove from the local state
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Optionally, show an error to the user
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Notifications</h3>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>Total: {notifications.length}</span>
            <span>Unread: {unreadCount}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="border-slate-600"
          >
            All
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
            className="border-slate-600"
          >
            <Bell className="h-4 w-4 mr-1" />
            Unread ({unreadCount})
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 z-[999]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BellRing className="h-5 w-5 text-blue-400" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <p>Loading notifications...</p>
                    </div>
                  ) : (
                    <p>No notifications to display</p>
                  )}
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`relative p-4 rounded-lg border transition-all hover:border-slate-600/50 ${
                      notification.is_read 
                        ? 'bg-slate-800/30 border-slate-700/30' 
                        : `${getTypeColor(notification.type)} border-l-4`
                    }`}
                  >
                    {/* Unread indicator */}
                    {!notification.is_read && (
                      <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}

                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(notification.type)}
                        <h4 className={`font-semibold ${notification.is_read ? 'text-slate-300' : 'text-white'}`}>
                          {notification.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(notification.priority)}`}
                        >
                          {notification.priority.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* Message */}
                    <p className={`text-sm mb-3 ${notification.is_read ? 'text-slate-400' : 'text-slate-200'}`}>
                      {notification.message}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{notification.sender_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(notification.timestamp)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {notification.action_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs border-slate-600 hover:bg-slate-700"
                            onClick={() => window.location.href = notification.action_url!}
                          >
                            View
                          </Button>
                        )}
                        {!notification.is_read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs hover:bg-slate-700"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                        {/* Only show delete button for admins */}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-red-400 hover:bg-red-500/20"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedNotificationSystem;
