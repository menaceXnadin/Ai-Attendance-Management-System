import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert20Filled,
  Alert20Regular,
  AlertOff20Regular,
  CheckmarkCircle20Regular,
  Delete16Regular,
  Dismiss20Regular,
  DismissCircle20Regular,
  ErrorCircle20Regular,
  Info20Regular,
  Megaphone20Regular,
  Open12Regular,
  Warning20Regular,
} from '@fluentui/react-icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/useAuth';
import { API_URL } from '@/config/api';
import { getAuthToken } from '@/lib/authToken';

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
      const token = getAuthToken();
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
      const token = getAuthToken();
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
      const token = getAuthToken();
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
      const token = getAuthToken();
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
        return <Warning20Regular className="h-5 w-5" aria-hidden="true" />;
      case 'success':
        return <CheckmarkCircle20Regular className="h-5 w-5" aria-hidden="true" />;
      case 'error':
        return <DismissCircle20Regular className="h-5 w-5" aria-hidden="true" />;
      case 'announcement':
        return <Megaphone20Regular className="h-5 w-5" aria-hidden="true" />;
      default:
        return <Info20Regular className="h-5 w-5" aria-hidden="true" />;
    }
  };

  // Icon chip colours (Teams activity feed avatar slot)
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-status-warning-subtle text-status-warning';
      case 'success':
        return 'bg-status-success-subtle text-status-success';
      case 'error':
        return 'bg-status-error-subtle text-status-error';
      case 'announcement':
        return 'bg-brand-subtle text-brand-foreground';
      default:
        return 'bg-status-info-subtle text-status-info';
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      {/* Activity bell */}
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ease-fluent-standard hover:bg-surface-default hover:text-text-primary active:bg-surface-pressed',
            isOpen ? 'bg-surface-default text-brand-foreground' : 'text-text-secondary'
          )}
          aria-label={unreadCount > 0 ? `Open notifications (${unreadCount} unread)` : 'Open notifications'}
        >
          {isOpen ? (
            <Alert20Filled className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Alert20Regular className="h-5 w-5" aria-hidden="true" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-error px-1 text-overline tabular-nums text-text-inverse ring-2 ring-titlebar">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      {/* Activity flyout */}
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(380px,calc(100vw-16px))] overflow-hidden rounded-lg border-border-subtle bg-surface-raised p-0 text-text-primary shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <h2 className="text-subheading text-text-primary">Activity</h2>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="rounded-md px-2 py-1 text-caption-strong text-brand-foreground transition-colors duration-150 hover:bg-brand-subtle hover:text-brand-foreground-hover"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
              aria-label="Close notification panel"
            >
              <Dismiss20Regular className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="max-h-[min(440px,70vh)] overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-error-subtle text-status-error">
                <ErrorCircle20Regular className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-body-strong text-text-primary">Error loading notifications</p>
              <p className="mt-1 max-w-[280px] break-words text-caption text-text-muted">{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
                <AlertOff20Regular className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-body-strong text-text-primary">No notifications</p>
              <p className="mt-1 text-caption text-text-muted">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="py-1">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="group relative flex cursor-pointer items-start gap-3 py-2.5 pl-5 pr-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover"
                    onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && e.currentTarget === e.target) {
                        e.preventDefault();
                        if (!notification.read) handleMarkAsRead(notification.id);
                      }
                    }}
                  >
                    {!notification.read && (
                      <span
                        aria-hidden="true"
                        className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-foreground"
                      />
                    )}
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        getNotificationColor(notification.type)
                      )}
                    >
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            'min-w-0 truncate',
                            notification.read ? 'text-body text-text-secondary' : 'text-body-strong text-text-primary'
                          )}
                        >
                          {notification.title}
                          {!notification.read && <span className="sr-only"> (unread)</span>}
                        </p>
                        <span className="shrink-0 text-caption text-text-muted">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-caption text-text-secondary">
                        {notification.message}
                      </p>
                      {notification.actionable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            notification.onAction?.();
                          }}
                          className="mt-1 inline-flex items-center gap-1 rounded-sm text-caption-strong text-brand-foreground hover:text-brand-foreground-hover hover:underline"
                        >
                          {notification.actionText}
                          <Open12Regular className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveNotification(notification.id);
                        }}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-status-error-subtle hover:text-status-error focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        aria-label="Delete notification"
                      >
                        <Delete16Regular className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
