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
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative border-slate-600 text-slate-300 hover:bg-slate-800"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 z-[999]">
          <Card className="bg-slate-900/95 backdrop-blur-md border-slate-700/50 shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-400" />
                  Notifications
                </CardTitle>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No notifications</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-400">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Error loading notifications:</p>
                  <p className="text-sm text-slate-400">{error}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-l-4 mx-2 mb-2 rounded-r-lg transition-all hover:bg-slate-800/50 ${
                        notification.read ? 'opacity-60' : ''
                      } ${
                        notification.type === 'warning' ? 'border-amber-500 bg-amber-500/10' :
                        notification.type === 'success' ? 'border-green-500 bg-green-500/10' :
                        notification.type === 'error' ? 'border-red-500 bg-red-500/10' :
                        notification.type === 'announcement' ? 'border-purple-500 bg-purple-500/10' :
                        'border-blue-500 bg-blue-500/10'
                      }`}
                      onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1">
                            <h4 className="font-medium text-white text-sm">
                              {notification.title}
                              {!notification.read && (
                                <span className="ml-2 h-2 w-2 bg-blue-500 rounded-full inline-block"></span>
                              )}
                            </h4>
                            <p className="text-slate-300 text-xs mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1 text-slate-400 text-xs">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(notification.timestamp)}
                              </div>
                              {notification.actionable && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    notification.onAction?.();
                                  }}
                                  className="text-xs h-6 border-slate-600 text-slate-300 hover:bg-slate-700"
                                >
                                  {notification.actionText}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Only show delete button for admins */}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveNotification(notification.id);
                            }}
                            className="ml-2 h-6 w-6 p-0 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white"
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
