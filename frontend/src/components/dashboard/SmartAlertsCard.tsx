import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BrainCircuit20Regular,
  Warning20Regular,
  CheckmarkCircle20Regular,
  Info20Regular,
  ErrorCircle20Regular,
  Dismiss16Regular,
} from '@fluentui/react-icons';
import { SmartAlert } from '@/types/dashboard';

interface SmartAlertsProps {
  alerts: SmartAlert[];
  onDismissAlert?: (alertId: string) => void;
}

const SmartAlertsCard: React.FC<SmartAlertsProps> = ({ alerts, onDismissAlert }) => {
  const getAlertIcon = (type: SmartAlert['type']) => {
    switch (type) {
      case 'success':
        return <CheckmarkCircle20Regular className="text-status-success" aria-hidden />;
      case 'warning':
        return <Warning20Regular className="text-status-warning" aria-hidden />;
      case 'danger':
        return <ErrorCircle20Regular className="text-status-error" aria-hidden />;
      case 'info':
      default:
        return <Info20Regular className="text-status-info" aria-hidden />;
    }
  };

  const getAlertVariant = (type: SmartAlert['type']) => {
    switch (type) {
      case 'success':
        return 'default';
      case 'warning':
        return 'default';
      case 'danger':
        return 'destructive';
      case 'info':
      default:
        return 'default';
    }
  };

  const getAlertColors = (type: SmartAlert['type']) => {
    switch (type) {
      case 'success':
        return 'border-status-success-border bg-status-success-subtle';
      case 'warning':
        return 'border-status-warning-border bg-status-warning-subtle';
      case 'danger':
        return 'border-status-error-border bg-status-error-subtle';
      case 'info':
      default:
        return 'border-status-info-border bg-status-info-subtle';
    }
  };

  const header = (
    <CardHeader className="flex-row items-center gap-3 space-y-0 px-5 py-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
        <BrainCircuit20Regular aria-hidden />
      </div>
      <CardTitle className="flex-1 text-subheading text-text-primary">AI Smart Insights</CardTitle>
      {alerts.length > 0 && (
        <Badge variant="secondary" shape="pill">
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </Badge>
      )}
    </CardHeader>
  );

  if (alerts.length === 0) {
    return (
      <Card className="border-0 bg-surface-default shadow">
        {header}
        <CardContent className="px-5 pb-5">
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-status-success-subtle text-status-success">
              <CheckmarkCircle20Regular aria-hidden />
            </div>
            <p className="text-subheading text-text-primary">All good!</p>
            <p className="text-body text-text-muted">No alerts at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-surface-default shadow">
      {header}
      <CardContent className="space-y-2 px-5 pb-5">
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            variant={getAlertVariant(alert.type)}
            className={`${getAlertColors(alert.type)} border px-3 py-2.5`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <AlertDescription className="text-body-strong text-text-primary">
                  {alert.title}
                </AlertDescription>
                <AlertDescription className="text-body text-text-secondary">
                  {alert.message}
                </AlertDescription>
                {alert.actionable && (
                  <div className="pt-1.5">
                    <Button variant="outline" size="sm" className="h-7">
                      Take Action
                    </Button>
                  </div>
                )}
              </div>
              {onDismissAlert && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 shrink-0 text-text-muted hover:text-text-primary"
                  onClick={() => onDismissAlert(alert.id)}
                  aria-label="Dismiss alert"
                >
                  <Dismiss16Regular aria-hidden />
                </Button>
              )}
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
};

export default SmartAlertsCard;
