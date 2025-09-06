/**
 * Test component to verify academic metrics integration
 * This can be temporarily added to any page to test the API
 */

import React from 'react';
import { useCurrentSemesterMetrics } from '@/hooks/useAcademicMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const AcademicMetricsTest: React.FC = () => {
  const { data: metrics, isLoading, error } = useCurrentSemesterMetrics();

  return (
    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 mb-4">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          🧪 Academic Metrics Test
          {isLoading && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Loading</Badge>}
          {error && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>}
          {metrics && <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="text-slate-400">
            🔄 Loading academic metrics from API...
          </div>
        )}
        
        {error && (
          <div className="text-red-400">
            ❌ Error: {error.message}
            <br />
            <small className="text-slate-500">
              Make sure backend is running and API endpoints are accessible
            </small>
          </div>
        )}
        
        {metrics && (
          <div className="space-y-2">
            <div className="text-green-400">
              ✅ Successfully fetched dynamic academic metrics!
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Academic Days:</span>
                <div className="text-white font-semibold text-lg">
                  {metrics.total_academic_days}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Total Periods:</span>
                <div className="text-white font-semibold text-lg">
                  {metrics.total_periods?.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              🎯 This data is now being used dynamically across the application instead of hardcoded values!
            </div>
          </div>
        )}
        
        {!isLoading && !error && !metrics && (
          <div className="text-amber-400">
            ⚠️ No data received - check API response format
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AcademicMetricsTest;