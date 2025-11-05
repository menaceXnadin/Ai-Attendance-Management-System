import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
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
  Megaphone,
  X
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
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Load notifications when component mounts or filter changes
  useEffect(() => {
    const loadNotifications = async () => {
      setIsLoading(true);
      try {
        console.log('[Frontend] Fetching inbox for user:', user?.email, 'Role:', user?.role, 'Only unread:', onlyUnread);
        const notificationsData = await notificationService.getInbox(onlyUnread, 0, 20);
        console.log('[Frontend] Received inbox data:', notificationsData);
        
        // Ensure notificationsData is an array
        const notificationsArray = Array.isArray(notificationsData) ? notificationsData : [];
        console.log('[Frontend] Inbox array length:', notificationsArray.length);

        // Transform API data to include action_url and adjust timestamp format
        const transformedNotifications = notificationsArray.map(notif => ({
          ...notif,
          timestamp: notif.created_at,
          action_url: notif.type === 'announcement' ? '/student-dashboard' : undefined
        }));

        // Sort notifications by timestamp descending
        const sortedNotifications = transformedNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(sortedNotifications);
        console.log('[Frontend] Final inbox set:', sortedNotifications.length, 'notifications');
      } catch (error) {
        console.error('Failed to load inbox:', error);
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
  }, [toast, user?.email, user?.role, onlyUnread]);

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
      await notificationService.markNotificationRead(id);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark as read",
        variant: "destructive"
      });
    }
  };

  const dismissNotification = async (id: number) => {
    try {
      await notificationService.dismissNotification(id);
      // Remove from local state
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      toast({
        title: "Dismissed",
        description: "Notification dismissed",
        variant: "success"
      });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss notification",
        variant: "destructive"
      });
    }
  };

  const dismissAll = async () => {
    try {
      await notificationService.dismissAllNotifications();
      setNotifications([]);
      toast({
        title: "Cleared",
        description: "All notifications dismissed",
        variant: "success"
      });
    } catch (error) {
      console.error('Failed to dismiss all notifications:', error);
      toast({
        title: "Error",
        description: "Failed to clear all",
        variant: "destructive"
      });
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      // Call the service to delete on the backend (admin only)
      await notificationService.deleteNotification(id);
      // On success, remove from the local state
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      toast({
        title: "Deleted",
        description: "Notification deleted permanently",
        variant: "success"
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive"
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <BellRing className="h-5 w-5 text-white" />
            </div>
            Notifications
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
              <span className="text-slate-300 font-medium">{notifications.length}</span>
              <span className="text-slate-500">Total</span>
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
              <span className="text-blue-400 font-medium">{unreadCount}</span>
              <span className="text-blue-300/70">Unread</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Modern Toggle Button */}
          <button
            onClick={() => setOnlyUnread(!onlyUnread)}
            className={`
              group relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm
              transition-all duration-300 ease-out overflow-hidden
              ${onlyUnread 
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50' 
                : 'bg-slate-800/80 text-slate-300 border border-slate-700 hover:border-slate-600 hover:bg-slate-800'
              }
              hover:scale-105 active:scale-95
            `}
          >
            <div className={`
              flex items-center justify-center w-5 h-5 rounded-lg transition-all duration-300
              ${onlyUnread ? 'bg-white/20 shadow-inner' : 'bg-slate-700/50'}
            `}>
              <Bell className={`h-3.5 w-3.5 transition-all duration-300 ${onlyUnread ? 'text-white animate-pulse' : 'text-slate-400'}`} />
            </div>
            <span className="relative z-10">{onlyUnread ? "Unread Only" : "Show All"}</span>
            {onlyUnread && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 animate-shimmer"></div>
            )}
          </button>

          {/* Modern Clear All Button */}
          <button
            onClick={dismissAll}
            disabled={notifications.length === 0}
            className={`
              group flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm
              transition-all duration-300 ease-out
              ${notifications.length === 0
                ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-red-500/10 to-pink-500/10 text-red-400 border border-red-500/30 hover:border-red-500/50 hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 hover:scale-105 hover:shadow-lg hover:shadow-red-500/20 active:scale-95'
              }
            `}
          >
            <Trash2 className={`h-4 w-4 transition-transform duration-300 ${notifications.length > 0 ? 'group-hover:rotate-12' : ''}`} />
            Clear All
          </button>
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
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <p>Loading notifications...</p>
                    </div>
                  ) : (
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
                  )}
                </div>
              ) : (
                notifications.map((notification) => (
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
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/30">
                          <User className="h-3 w-3" />
                          <span>{notification.sender_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/30">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(notification.timestamp)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {notification.action_url && (
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all duration-200 hover:scale-105 active:scale-95"
                            onClick={() => window.location.href = notification.action_url!}
                          >
                            View
                          </button>
                        )}
                        {!notification.is_read && (
                          <button
                            className="group p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 hover:border-green-500/50 transition-all duration-200 hover:scale-110 active:scale-95"
                            onClick={() => markAsRead(notification.id)}
                            title="Mark as read"
                          >
                            <CheckCircle className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform duration-200" />
                          </button>
                        )}
                        <button
                          className="group p-2 rounded-lg bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all duration-200 hover:scale-110 active:scale-95"
                          onClick={() => dismissNotification(notification.id)}
                          title="Dismiss"
                        >
                          <X className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-200" />
                        </button>
                        {/* Only show delete button for admins */}
                        {isAdmin && (
                          <button
                            className="group p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-200 hover:scale-110 active:scale-95"
                            onClick={() => deleteNotification(notification.id)}
                            title="Delete permanently (admin only)"
                          >
                            <Trash2 className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform duration-200" />
                          </button>
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
