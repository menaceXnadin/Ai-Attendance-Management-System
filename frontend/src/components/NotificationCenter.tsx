import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, X, Calendar, AlertTriangle, CheckCircle, Info, Clock } from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionable?: boolean;
  actionText?: string;
  onAction?: () => void;
}

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'warning',
      title: 'Low Attendance Alert',
      message: '3 students have attendance below 75%. Immediate attention required.',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: false,
      actionable: true,
      actionText: 'View Students',
      onAction: () => console.log('Navigate to students page')
    },
    {
      id: '2',
      type: 'success',
      title: 'Weekly Report Generated',
      message: 'Your weekly attendance report has been generated and is ready for download.',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: false,
      actionable: true,
      actionText: 'Download',
      onAction: () => console.log('Download report')
    },
    {
      id: '3',
      type: 'info',
      title: 'System Update',
      message: 'Face recognition accuracy has been improved to 99.8% with the latest update.',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: '4',
      type: 'error',
      title: 'Camera Offline',
      message: 'Classroom 3B camera is offline. Students cannot mark attendance.',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      actionable: true,
      actionText: 'Check Status',
      onAction: () => console.log('Check camera status')
    }
  ]);

  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
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
        <div className="absolute right-0 top-12 w-96 z-50">
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
                      onClick={markAllAsRead}
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
                        'border-blue-500 bg-blue-500/10'
                      }`}
                      onClick={() => !notification.read && markAsRead(notification.id)}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          className="ml-2 h-6 w-6 p-0 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
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
