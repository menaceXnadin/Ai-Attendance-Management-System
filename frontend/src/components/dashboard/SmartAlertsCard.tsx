import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, AlertTriangle, CheckCircle, Info, AlertCircle, X } from 'lucide-react';
import { SmartAlert } from '@/types/dashboard';

interface SmartAlertsProps {
  alerts: SmartAlert[];
  onDismissAlert?: (alertId: string) => void;
}

const SmartAlertsCard: React.FC<SmartAlertsProps> = ({ alerts, onDismissAlert }) => {
  const getAlertIcon = (type: SmartAlert['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'danger':
        return <AlertCircle className="h-4 w-4" />;
      case 'info':
      default:
        return <Info className="h-4 w-4" />;
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
        return 'border-green-200 bg-green-50 text-green-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'danger':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            AI Smart Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
            <p className="font-medium">All good!</p>
            <p className="text-sm">No alerts at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-500" />
          AI Smart Insights
          <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <Alert key={alert.id} className={`${getAlertColors(alert.type)} border`}>
            <div className="flex items-start gap-3">
              {getAlertIcon(alert.type)}
              <div className="flex-1 space-y-1">
                <AlertDescription className="font-medium">
                  {alert.title}
                </AlertDescription>
                <AlertDescription className="text-sm opacity-90">
                  {alert.message}
                </AlertDescription>
                {alert.actionable && (
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Take Action
                    </Button>
                  </div>
                )}
              </div>
              {onDismissAlert && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 hover:bg-transparent"
                  onClick={() => onDismissAlert(alert.id)}
                >
                  <X className="h-3 w-3" />
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
