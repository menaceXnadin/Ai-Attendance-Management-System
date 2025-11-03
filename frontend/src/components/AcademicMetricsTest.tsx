/**
 * Test component to verify academic metrics integration
 * This can be temporarily added to any page to test the API
 */

import React from 'react';
import { useCurrentSemesterMetrics } from '@/hooks/useAcademicMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Clock, Sparkles, CalendarDays, Layers } from 'lucide-react';

const AcademicMetricsTest: React.FC = () => {
  const { data: metrics, isLoading, error } = useCurrentSemesterMetrics();

  const avgPerDay = metrics?.total_academic_days
    ? Number((metrics.total_periods / metrics.total_academic_days).toFixed(1))
    : 0;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900/70 to-slate-900/40 border-slate-700/50 shadow-xl shadow-blue-500/5 mb-6">
      {/* decorative background */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-tr from-blue-500/10 to-cyan-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-gradient-to-tr from-emerald-500/10 to-teal-400/10 blur-2xl" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span>Academic Metrics</span>
            {isLoading && (
              <Badge variant="outline" className="ml-1 text-slate-200 border-slate-600">
                <Clock className="h-3 w-3 mr-1" /> Loading
              </Badge>
            )}
            {error && (
              <Badge variant="destructive" className="ml-1">
                <XCircle className="h-3 w-3 mr-1" /> Error
              </Badge>
            )}
            {metrics && (
              <Badge className="ml-1 bg-green-500/20 text-green-300 border border-green-400/30">
                <CheckCircle className="h-3 w-3 mr-1" /> Success
              </Badge>
            )}
          </CardTitle>
          {metrics && (
            <div className="text-xs text-slate-400">Live • dynamic</div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {isLoading && (
          <div className="space-y-4">
            <div className="animate-skeleton h-4 w-64 rounded bg-slate-700/40" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="animate-skeleton h-20 rounded bg-slate-700/30" />
              <div className="animate-skeleton h-20 rounded bg-slate-700/30" />
              <div className="animate-skeleton h-20 rounded bg-slate-700/30" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            <div className="flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4" /> Failed to load academic metrics
            </div>
            <p className="mt-1 text-xs text-red-200/80">
              Ensure the backend API is running and accessible.
            </p>
          </div>
        )}

        {metrics && (
          <div className="space-y-5">
            {/* success banner */}
            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-green-300">
              <CheckCircle className="h-4 w-4" />
              <span>Successfully fetched dynamic academic metrics!</span>
            </div>

            {/* stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-4 hover:border-blue-500/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Academic Days</span>
                  <CalendarDays className="h-4 w-4 text-blue-400" />
                </div>
                <div className="mt-1 text-2xl font-bold text-white">{metrics.total_academic_days}</div>
              </div>

              <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-4 hover:border-blue-500/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Total Periods</span>
                  <Layers className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="mt-1 text-2xl font-bold text-white">{metrics.total_periods?.toLocaleString()}</div>
              </div>

              <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-4 hover:border-blue-500/30 transition-colors">
                <div className="text-slate-400 text-sm">Avg. Periods / Day</div>
                <div className="mt-1 flex items-end justify-between">
                  <div className="text-2xl font-bold text-white">{avgPerDay}</div>
                  <div className="w-24">
                    <Progress value={Math.min((avgPerDay / 10) * 100, 100)} className="h-2" />
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Scaled to 10 for visualization</p>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              🎯 These values are live from the API and replace hardcoded constants across the app.
            </p>
          </div>
        )}

        {!isLoading && !error && !metrics && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
            ⚠️ No data received - check API response format
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AcademicMetricsTest;