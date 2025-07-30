import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell,
  BellRing,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Settings,
  Filter,
  Volume2,
  VolumeX,
  Zap,
  Users,
  UserX,
  Calendar,
  BookOpen,
  Wifi,
  WifiOff
} from 'lucide-react';

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
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'attendance':
        return <Users className="h-3 w-3" />;
      case 'system':
        return <Zap className="h-3 w-3" />;
      case 'academic':
        return <BookOpen className="h-3 w-3" />;
      case 'security':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Bell className="h-3 w-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
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
    <Card className={`bg-slate-900/60 backdrop-blur-md border-slate-700/50 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bell className="h-4 w-4 text-white" />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{unreadCount}</span>
                </div>
              )}
            </div>
            <div>
              <CardTitle className="text-lg text-white">Smart Notifications</CardTitle>
              <p className="text-sm text-slate-400">Real-time system alerts and updates</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg mt-4">
          {[
            { id: 'all', label: 'All', icon: Bell },
            { id: 'attendance', label: 'Attendance', icon: Users },
            { id: 'system', label: 'System', icon: Zap },
            { id: 'academic', label: 'Academic', icon: BookOpen }
          ].map((category) => (
            <button
              key={category.id}
              onClick={() => setFilterCategory(category.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                filterCategory === category.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <category.icon className="h-3 w-3" />
              {category.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {filteredNotifications.slice(0, maxVisible).map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition-all ${
                  notification.read
                    ? 'bg-slate-800/30 border-slate-700/30'
                    : 'bg-slate-800/60 border-slate-600/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={`text-sm font-medium ${
                        notification.read ? 'text-slate-300' : 'text-white'
                      }`}>
                        {notification.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(notification.priority)}`}
                        >
                          {notification.priority}
                        </Badge>
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    
                    <p className={`text-sm mb-2 ${
                      notification.read ? 'text-slate-400' : 'text-slate-300'
                    }`}>
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          {getCategoryIcon(notification.category)}
                          <span className="capitalize">{notification.category}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(notification.timestamp)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {notification.actionRequired && (
                          <Button size="sm" variant="outline" className="h-6 text-xs border-purple-500/50 text-purple-300 hover:bg-purple-500/20">
                            Take Action
                          </Button>
                        )}
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredNotifications.length === 0 && (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No notifications in this category</p>
            </div>
          )}
          
          {filteredNotifications.length > maxVisible && (
            <div className="text-center mt-4">
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
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
