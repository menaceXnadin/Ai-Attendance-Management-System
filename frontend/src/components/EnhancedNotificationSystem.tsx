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
  Alert20Regular,
  Alert24Regular,
  AlertOn20Regular,
  Clock16Regular,
  Person16Regular,
  Warning20Regular,
  Info20Regular,
  CheckmarkCircle20Regular,
  ErrorCircle20Regular,
  Delete16Regular,
  Megaphone20Regular,
  Dismiss16Regular,
  Checkmark16Regular,
  Filter16Regular,
  Filter16Filled,
} from '@fluentui/react-icons';

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
      case 'info': return <Info20Regular className="text-status-info" aria-hidden />;
      case 'warning': return <Warning20Regular className="text-status-warning" aria-hidden />;
      case 'success': return <CheckmarkCircle20Regular className="text-status-success" aria-hidden />;
      case 'danger': return <ErrorCircle20Regular className="text-status-error" aria-hidden />;
      case 'announcement': return <Megaphone20Regular className="text-brand-foreground" aria-hidden />;
      default: return <Info20Regular className="text-status-info" aria-hidden />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'bg-status-info-subtle';
      case 'warning': return 'bg-status-warning-subtle';
      case 'success': return 'bg-status-success-subtle';
      case 'danger': return 'bg-status-error-subtle';
      case 'announcement': return 'bg-brand-subtle';
      default: return 'bg-status-info-subtle';
    }
  };

  const getPriorityColor = (priority: string): 'destructive' | 'warning' | 'info' | 'secondary' => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'secondary';
      default: return 'secondary';
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
    <div className="space-y-4">
      {/* Header toolbar with stats */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 text-section-title text-text-primary">
            <AlertOn20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Notifications
          </h3>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="secondary" shape="pill" className="gap-1.5">
              <span className="tabular-nums font-semibold">{notifications.length}</span>
              <span>Total</span>
            </Badge>
            <Badge variant="info" shape="pill" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-info" aria-hidden></span>
              <span className="tabular-nums font-semibold">{unreadCount}</span>
              <span>Unread</span>
            </Badge>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* Unread filter toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOnlyUnread(!onlyUnread)}
            aria-pressed={onlyUnread}
            className={onlyUnread ? 'border-brand-stroke bg-brand-subtle text-brand-foreground hover:bg-brand-subtle-hover' : ''}
          >
            {onlyUnread ? <Filter16Filled aria-hidden /> : <Filter16Regular aria-hidden />}
            <span>{onlyUnread ? "Unread Only" : "Show All"}</span>
          </Button>

          {/* Clear all */}
          <Button
            variant="outline"
            size="sm"
            onClick={dismissAll}
            disabled={notifications.length === 0}
            className="text-status-error hover:bg-status-error-subtle"
          >
            <Delete16Regular aria-hidden />
            Clear All
          </Button>
        </div>
      </div>

      {/* Notifications List (Teams activity feed) */}
      <Card className="border-0 shadow overflow-hidden">
        <CardHeader className="border-b border-border-subtle px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <Alert20Regular className="shrink-0 text-text-muted" aria-hidden />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh] sm:h-[70vh] lg:h-[600px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                  <Alert24Regular aria-hidden />
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-body text-text-muted">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden></span>
                    <p>Loading notifications...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-subheading text-text-primary">No notifications to display</p>
                    {onlyUnread && (
                      <Button variant="outline" size="sm" onClick={() => setOnlyUnread(false)}>
                        Show All Notifications
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`group relative flex items-start gap-3 px-5 py-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover ${
                      notification.is_read ? '' : 'bg-brand-subtle/40'
                    }`}
                  >
                    {/* Unread indicator */}
                    {!notification.is_read && (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand" aria-label="Unread"></span>
                    )}

                    {/* Type avatar */}
                    <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${getTypeColor(notification.type)}`}>
                      {getTypeIcon(notification.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`min-w-0 break-words text-body ${notification.is_read ? 'text-text-secondary' : 'font-semibold text-text-primary'}`}>
                          {notification.title}
                        </h4>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={getPriorityColor(notification.priority)} shape="pill" className="capitalize">
                            {notification.priority}
                          </Badge>
                        </div>
                      </div>

                      {/* Message */}
                      <p className={`mt-0.5 break-words text-body ${notification.is_read ? 'text-text-muted' : 'text-text-secondary'}`}>
                        {notification.message}
                      </p>

                      {/* Footer */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-caption text-text-muted">
                          <span className="flex items-center gap-1">
                            <Person16Regular aria-hidden />
                            {notification.sender_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock16Regular aria-hidden />
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {notification.action_url && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => window.location.href = notification.action_url!}
                            >
                              View
                            </Button>
                          )}
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 text-text-muted hover:text-status-success"
                              onClick={() => markAsRead(notification.id)}
                              title="Mark as read"
                              aria-label="Mark as read"
                            >
                              <Checkmark16Regular aria-hidden />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 text-text-muted hover:text-text-primary"
                            onClick={() => dismissNotification(notification.id)}
                            title="Dismiss"
                            aria-label="Dismiss"
                          >
                            <Dismiss16Regular aria-hidden />
                          </Button>
                          {/* Only show delete button for admins */}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 text-text-muted hover:bg-status-error-subtle hover:text-status-error"
                              onClick={() => deleteNotification(notification.id)}
                              title="Delete permanently (admin only)"
                              aria-label="Delete permanently (admin only)"
                            >
                              <Delete16Regular aria-hidden />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedNotificationSystem;
