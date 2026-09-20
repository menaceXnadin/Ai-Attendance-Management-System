import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, X, Calendar, AlertTriangle, CheckCircle, Info, Clock, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { API_URL } from '@/config/api';

interface ApiNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'danger' | 'announcement';
  is_read: boolean;
  created_at: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recipient_id: string;
  sender_id: string;
  category: string;
  action_url?: string;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'announcement';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionable?: boolean;
  actionText?: string;
  onAction?: () => void;
}

const NotificationCenter: React.FC = () => {
  const { user } = useAuth(); // Get current user to check role
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError("Authentication token not found.");
        return;
      }

      const response = await fetch(`${API_URL}/notifications/user/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }
      const data: ApiNotification[] = await response.json();
      
      const formattedNotifications = data.map((n): Notification => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type === 'danger' ? 'error' : n.type,
        read: n.is_read,
        timestamp: new Date(n.created_at),
        actionable: !!n.action_url,
        actionText: 'View',
        onAction: () => {
          if (n.action_url) {
            window.open(n.action_url, '_blank');
          }
        }
      }));
      setNotifications(formattedNotifications);
      setError(null);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred.");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_URL}/notifications/${id}/read`, { 
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_URL}/notifications/mark-all-read`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleRemoveNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_URL}/notifications/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-amber-200 bg-amber-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'announcement':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
        aria-label="Open notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 w-4 min-w-4 flex items-center justify-center p-0 bg-status-error text-white text-[10px] font-semibold border-0">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-96 z-[999]">
          <Card className="bg-surface-default border border-border-default shadow-lg overflow-hidden">
            <CardHeader className="p-3.5 border-b border-border-subtle">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Bell className="h-4 w-4 text-action-primary" />
                  Notifications
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="text-xs h-7 px-2 text-action-primary hover:bg-action-primary-subtle"
                    >
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsOpen(false)}
                    className="h-7 w-7 text-text-muted hover:text-text-primary"
                    aria-label="Close notification panel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30 text-text-muted" />
                  <p className="text-xs">No notifications</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center text-status-error">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-medium">Error loading notifications:</p>
                  <p className="text-xs text-text-muted mt-0.5">{error}</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 transition-colors hover:bg-surface-subtle cursor-pointer ${
                        notification.read ? 'opacity-70 bg-surface-canvas/40' : 'bg-surface-default'
                      }`}
                      onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-text-primary text-xs flex items-center gap-1.5">
                              <span className="truncate">{notification.title}</span>
                              {!notification.read && (
                                <span className="h-1.5 w-1.5 rounded-full bg-action-primary shrink-0"></span>
                              )}
                            </h4>
                            <p className="text-text-secondary text-xs mt-0.5 leading-relaxed break-words">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1 text-text-muted text-[11px]">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(notification.timestamp)}
                              </div>
                              {notification.actionable && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    notification.onAction?.();
                                  }}
                                  className="text-xs h-6 px-2 text-action-primary hover:bg-action-primary-subtle"
                                >
                                  {notification.actionText}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveNotification(notification.id);
                            }}
                            className="h-6 w-6 p-0 text-text-muted hover:text-status-error shrink-0"
                            aria-label="Delete notification"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
