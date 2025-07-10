import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Bell, X, Clock, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SmartAttendanceReminderProps {
  hasMarkedAttendanceToday: boolean;
  onMarkAttendance: () => void;
  onDismiss: () => void;
}

const SmartAttendanceReminder: React.FC<SmartAttendanceReminderProps> = ({
  hasMarkedAttendanceToday,
  onMarkAttendance,
  onDismiss
}) => {
  const [showReminder, setShowReminder] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hour = currentTime.getHours();
    const isSchoolHours = hour >= 8 && hour <= 17; // 8 AM to 5 PM
    
    // Show reminder if:
    // 1. It's school hours
    // 2. Student hasn't marked attendance today
    // 3. It's past 8:30 AM (grace period)
    const shouldShow = isSchoolHours && !hasMarkedAttendanceToday && hour >= 8 && currentTime.getMinutes() >= 30;
    
    setShowReminder(shouldShow);
  }, [currentTime, hasMarkedAttendanceToday]);

  const handleDismiss = () => {
    setShowReminder(false);
    onDismiss();
    
    toast({
      title: "Reminder dismissed",
      description: "We'll remind you again later if you haven't marked attendance.",
    });
  };

  const handleMarkAttendance = () => {
    setShowReminder(false);
    onMarkAttendance();
  };

  if (!showReminder) {
    return null;
  }

  const getCurrentTimeString = () => {
    return currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getUrgencyLevel = () => {
    const hour = currentTime.getHours();
    if (hour >= 12) return 'high';
    if (hour >= 10) return 'medium';
    return 'low';
  };

  const urgency = getUrgencyLevel();
  
  const getAlertStyles = () => {
    switch (urgency) {
      case 'high':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800';
    }
  };

  const getUrgencyMessage = () => {
    switch (urgency) {
      case 'high':
        return "⚠️ It's getting late! Don't forget to mark your attendance.";
      case 'medium':
        return "⏰ Gentle reminder to mark your attendance for today.";
      default:
        return "📚 Good morning! Time to mark your attendance.";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right duration-300">
      <Alert className={`${getAlertStyles()} border shadow-lg backdrop-blur-sm`}>
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 mt-0.5 animate-pulse" />
          <div className="flex-1 space-y-2">
            <AlertDescription className="font-medium">
              {getUrgencyMessage()}
            </AlertDescription>
            <AlertDescription className="text-sm opacity-90">
              Current time: {getCurrentTimeString()}
            </AlertDescription>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="default"
                className="h-8 px-3 text-xs"
                onClick={handleMarkAttendance}
              >
                <Camera className="h-3 w-3 mr-1" />
                Mark Now
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={handleDismiss}
              >
                <Clock className="h-3 w-3 mr-1" />
                Later
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 hover:bg-transparent"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    </div>
  );
};

export default SmartAttendanceReminder;
