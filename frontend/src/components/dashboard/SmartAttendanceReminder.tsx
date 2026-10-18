import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Alert20Regular, Dismiss16Regular, Clock20Regular, Camera20Regular } from '@fluentui/react-icons';
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
        return 'bg-status-error-subtle text-status-error';
      case 'medium':
        return 'bg-status-warning-subtle text-status-warning';
      default:
        return 'bg-status-info-subtle text-status-info';
    }
  };

  const getUrgencyMessage = () => {
    switch (urgency) {
      case 'high':
        return "It's getting late! Don't forget to mark your attendance.";
      case 'medium':
        return "Gentle reminder to mark your attendance for today.";
      default:
        return "Good morning! Time to mark your attendance.";
    }
  };

  return (
    <div className="fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-sm animate-in fade-in-0 slide-in-from-right-4 duration-300">
      <Alert className="rounded-lg border border-border-subtle bg-surface-raised p-4 text-text-primary shadow-lg">
        <div className="flex items-start gap-3">
          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${getAlertStyles()}`}>
            <Alert20Regular aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <AlertDescription className="text-body-strong text-text-primary">
              {getUrgencyMessage()}
            </AlertDescription>
            <AlertDescription className="text-caption text-text-muted">
              Current time: {getCurrentTimeString()}
            </AlertDescription>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleMarkAttendance}
              >
                <Camera20Regular aria-hidden />
                Mark Now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
              >
                <Clock20Regular aria-hidden />
                Later
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 shrink-0 text-text-muted hover:text-text-primary"
            onClick={handleDismiss}
            aria-label="Dismiss reminder"
          >
            <Dismiss16Regular aria-hidden />
          </Button>
        </div>
      </Alert>
    </div>
  );
};

export default SmartAttendanceReminder;
