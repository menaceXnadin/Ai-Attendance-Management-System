import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Alert16Regular,
  Alert20Regular,
  Alert24Regular,
  Clock16Regular,
  ErrorCircle20Regular,
  Warning20Regular,
  DismissCircle20Regular,
  CheckmarkCircle20Regular,
  Info20Regular,
  Dismiss16Regular,
  Settings16Regular,
  Speaker216Regular,
  SpeakerMute16Regular,
  Flash16Regular,
  People16Regular,
  BookOpen16Regular,
  ShieldLock16Regular,
} from '@fluentui/react-icons';
import { useAuth } from '@/contexts/useAuth';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'urgent';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  category: 'attendance' | 'system' | 'academic' | 'security' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionRequired?: boolean;
  relatedUser?: string;
}

interface SmartNotificationSystemProps {
  className?: string;
  maxVisible?: number;
}

const SmartNotificationSystem: React.FC<SmartNotificationSystemProps> = ({ 
  className = '',
  maxVisible = 5 
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'urgent',
      title: 'Multiple Absent Students Detected',
      message: '15 students from Computer Science batch have been absent for 3+ consecutive days',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      category: 'attendance',
      priority: 'critical',
      actionRequired: true
    },
    {
      id: '2',
      type: 'warning',
      title: 'Face Recognition System Load High',
      message: 'Processing time increased by 40%. Consider optimizing or scaling resources',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      read: false,
      category: 'system',
      priority: 'high'
    },
    {
      id: '3',
      type: 'success',
      title: 'Weekly Report Generated',
      message: 'Attendance analytics for Week 12 are now available for download',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: true,
      category: 'academic',
      priority: 'low'
    },
    {
      id: '4',
      type: 'info',
      title: 'New Students Enrolled',
      message: '8 new students added to the system. Face encoding in progress',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      read: false,
      category: 'academic',
      priority: 'medium'
    },
    {
      id: '5',
      type: 'error',
      title: 'Camera Connection Lost',
      message: 'Main entrance camera (CAM-001) lost connection. Attendance tracking affected',
      timestamp: new Date(Date.now() - 90 * 60 * 1000),
      read: false,
      category: 'system',
      priority: 'critical',
      actionRequired: true
    }
  ]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);

  // Simulate real-time notifications
  useEffect(() => {
    const interval = setInterval(() => {        const randomNotifications = [
        {
          type: 'info' as const,
          title: 'Student Check-in',
          message: `Student ${Math.random() > 0.5 ? 'Aarohi Sharma' : 'Bibek Gurung'} marked present`,
          category: 'attendance' as const,
          priority: 'low' as const
        },
        {
          type: 'warning' as const,
          title: 'Late Arrival',
          message: 'Student arrived 15 minutes late - attendance marked with delay',
          category: 'attendance' as const,
          priority: 'medium' as const
        },
        {
          type: 'success' as const,
          title: 'Backup Completed',
          message: 'Daily system backup completed successfully',
          category: 'system' as const,
          priority: 'low' as const
        },
        {
          type: 'urgent' as const,
          title: 'System Alert',
          message: 'Critical system maintenance required',
          category: 'system' as const,
          priority: 'critical' as const
        }
      ];

      if (Math.random() > 0.7) { // 30% chance every interval
        const randomNotif = randomNotifications[Math.floor(Math.random() * randomNotifications.length)];
        const newNotification: Notification = {
          id: Date.now().toString(),
          ...randomNotif,
          timestamp: new Date(),
          read: false,
          actionRequired: randomNotif.priority === 'critical'
        };

        setNotifications(prev => [newNotification, ...prev.slice(0, 19)]); // Keep max 20
        
        if (soundEnabled && randomNotif.priority !== 'low') {
          // In a real app, you'd play a notification sound here
          console.log('🔔 New notification sound');
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [soundEnabled]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return <ErrorCircle20Regular className="text-status-error" aria-hidden />;
      case 'warning':
        return <Warning20Regular className="text-status-warning" aria-hidden />;
      case 'error':
        return <DismissCircle20Regular className="text-status-error" aria-hidden />;
      case 'success':
        return <CheckmarkCircle20Regular className="text-status-success" aria-hidden />;
      default:
        return <Info20Regular className="text-status-info" aria-hidden />;
    }
  };

  const getNotificationTint = (type: string) => {
    switch (type) {
      case 'urgent':
      case 'error':
        return 'bg-status-error-subtle';
      case 'warning':
        return 'bg-status-warning-subtle';
      case 'success':
        return 'bg-status-success-subtle';
      default:
        return 'bg-status-info-subtle';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'attendance':
        return <People16Regular aria-hidden />;
      case 'system':
        return <Flash16Regular aria-hidden />;
      case 'academic':
        return <BookOpen16Regular aria-hidden />;
      case 'security':
        return <ShieldLock16Regular aria-hidden />;
      default:
        return <Alert16Regular aria-hidden />;
    }
  };

  const getPriorityColor = (priority: string): 'destructive' | 'warning' | 'info' | 'secondary' => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const filteredNotifications = filterCategory === 'all'
    ? notifications
    : notifications.filter(notif => notif.category === filterCategory);

  const unreadCount = notifications.filter(notif => !notif.read).length;

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <Card className={`border-0 shadow overflow-hidden ${className}`}>
      <CardHeader className="space-y-0 border-b border-border-subtle px-5 pb-0 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                <Alert20Regular aria-hidden />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-status-error px-1 ring-2 ring-[var(--surface-default)]">
                  <span className="text-overline leading-none text-text-inverse tabular-nums">{unreadCount}</span>
                </div>
              )}
            </div>
            <div>
              <CardTitle className="text-subheading text-text-primary">Smart Notifications</CardTitle>
              <p className="text-caption text-text-muted">Real-time system alerts and updates</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
              aria-pressed={soundEnabled}
              className="text-text-muted hover:text-text-primary"
            >
              {soundEnabled ? <Speaker216Regular aria-hidden /> : <SpeakerMute16Regular aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSettings(!showSettings)}
              aria-label="Notification settings"
              aria-pressed={showSettings}
              className="text-text-muted hover:text-text-primary"
            >
              <Settings16Regular aria-hidden />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs (Fluent TabList) */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Filter notifications">
          {[
            { id: 'all', label: 'All', icon: Alert16Regular },
            { id: 'attendance', label: 'Attendance', icon: People16Regular },
            { id: 'system', label: 'System', icon: Flash16Regular },
            { id: 'academic', label: 'Academic', icon: BookOpen16Regular }
          ].map((category) => {
            const active = filterCategory === category.id;
            return (
              <button
                key={category.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilterCategory(category.id)}
                className={`relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 text-body transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? 'font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <category.icon className={active ? 'text-brand-foreground' : 'text-text-muted'} aria-hidden />
                {category.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-brand" aria-hidden />}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <ul className="divide-y divide-border-subtle">
            {filteredNotifications.slice(0, maxVisible).map((notification) => (
              <li
                key={notification.id}
                className={`relative flex items-start gap-3 px-5 py-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover ${
                  notification.read ? '' : 'bg-brand-subtle/40'
                }`}
              >
                {!notification.read && (
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand" aria-label="Unread" />
                )}
                <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${getNotificationTint(notification.type)}`}>
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-start justify-between gap-2">
                    <h4 className={`text-body ${
                      notification.read ? 'text-text-secondary' : 'font-semibold text-text-primary'
                    }`}>
                      {notification.title}
                    </h4>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={getPriorityColor(notification.priority)} shape="pill" className="capitalize">
                        {notification.priority}
                      </Badge>
                      {/* Only show delete button for admins */}
                      {isAdmin && (
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="grid h-6 w-6 place-items-center rounded text-text-muted transition-colors hover:bg-status-error-subtle hover:text-status-error"
                          aria-label="Delete notification"
                        >
                          <Dismiss16Regular aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className={`mb-2 text-body ${
                    notification.read ? 'text-text-muted' : 'text-text-secondary'
                  }`}>
                    {notification.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-caption text-text-muted">
                      <div className="flex items-center gap-1">
                        {getCategoryIcon(notification.category)}
                        <span className="capitalize">{notification.category}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock16Regular aria-hidden />
                        <span>{formatTimeAgo(notification.timestamp)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {notification.actionRequired && (
                        <Button size="sm" variant="outline" className="h-7 border-brand-stroke text-brand-foreground hover:bg-brand-subtle">
                          Take Action
                        </Button>
                      )}
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-caption-strong text-brand-foreground hover:text-brand-foreground-hover hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {filteredNotifications.length === 0 && (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                <Alert24Regular aria-hidden />
              </div>
              <p className="text-body text-text-muted">No notifications in this category</p>
            </div>
          )}

          {filteredNotifications.length > maxVisible && (
            <div className="border-t border-border-subtle py-3 text-center">
              <Button variant="ghost" size="sm" className="text-brand-foreground">
                View {filteredNotifications.length - maxVisible} more
              </Button>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SmartNotificationSystem;
