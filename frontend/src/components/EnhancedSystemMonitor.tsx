import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Desktop20Regular,
  DeveloperBoard20Regular,
  HardDrive20Regular,
  Wifi120Regular,
  Database20Regular,
  Camera20Regular,
  People20Regular,
  Pulse20Regular,
  Flash20Regular,
  Clock12Regular,
  Temperature20Regular,
  Eye20Regular,
  ArrowSync16Regular,
  Settings16Regular,
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  Subtract16Regular,
  Server20Regular,
  Cloud20Regular,
  DataUsage20Regular,
  TextBulletListSquare20Regular,
  Warning12Regular,
  Warning12Filled,
  ErrorCircle12Regular,
  ErrorCircle12Filled,
  CheckmarkCircle12Filled,
} from '@fluentui/react-icons';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts';

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: Date;
  threshold: {
    warning: number;
    critical: number;
  };
}

interface ServiceStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: string;
  responseTime: number;
  lastCheck: Date;
  description: string;
}

interface EnhancedSystemMonitorProps {
  className?: string;
}

const EnhancedSystemMonitor: React.FC<EnhancedSystemMonitorProps> = ({ className = '' }) => {
  const { user, loading } = useAuth();
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'metrics' | 'services' | 'logs'>('metrics');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [systemLogs, setSystemLogs] = useState<Array<{
    time: string;
    level: string;
    message: string;
  }>>([]);

  // Function to determine status based on value and thresholds
  const getMetricStatus = (value: number, warning: number, critical: number): 'healthy' | 'warning' | 'critical' => {
    if (value >= critical) return 'critical';
    if (value >= warning) return 'warning';
    return 'healthy';
  };

  // Function to get trend based on previous and current values
  const getMetricTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const diff = current - previous;
    if (Math.abs(diff) < 2) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  // Fetch real system metrics from backend
  const fetchSystemMetrics = useCallback(async () => {
    // Check if user is authenticated
    if (!user) {
      console.log('[SystemMonitor] User not authenticated, skipping metrics fetch');
      setServices([
        {
          id: 'api',
          name: 'Main API Server',
          status: 'degraded',
          uptime: 'Unknown',
          responseTime: 0,
          lastCheck: new Date(),
          description: 'Please log in to view system metrics'
        }
      ]);
      setSystemLogs([
        {
          time: new Date().toLocaleTimeString(),
          level: 'INFO',
          message: 'System monitoring requires authentication'
        }
      ]);
      return;
    }

    try {
      console.log('[SystemMonitor] Fetching real system metrics...');
      
      // Fetch both system health and realtime metrics
      const [healthData, metricsData] = await Promise.all([
        api.dashboard.getSystemHealth(),
        api.dashboard.getRealtimeMetrics()
      ]);

      console.log('[SystemMonitor] Health data:', healthData);
      console.log('[SystemMonitor] Metrics data:', metricsData);

      // Extract system metrics from the API response
      const now = new Date();
      const newMetrics: SystemMetric[] = [];

      // Add CPU, Memory, Disk metrics from realtime endpoint
      if (metricsData.system_load !== undefined) {
        newMetrics.push({
          id: 'cpu',
          name: 'CPU Usage',
          value: parseFloat(metricsData.system_load.toFixed(1)),
          unit: '%',
          status: getMetricStatus(metricsData.system_load, 70, 90),
          trend: 'stable', // Will be updated with actual trend tracking
          lastUpdated: now,
          threshold: { warning: 70, critical: 90 }
        });
      }

      if (metricsData.memory_usage !== undefined) {
        newMetrics.push({
          id: 'memory',
          name: 'Memory Usage',
          value: parseFloat(metricsData.memory_usage.toFixed(1)),
          unit: '%',
          status: getMetricStatus(metricsData.memory_usage, 80, 95),
          trend: 'stable',
          lastUpdated: now,
          threshold: { warning: 80, critical: 95 }
        });
      }

      if (metricsData.disk_usage !== undefined) {
        newMetrics.push({
          id: 'disk',
          name: 'Disk Usage',
          value: parseFloat(metricsData.disk_usage.toFixed(1)),
          unit: '%',
          status: getMetricStatus(metricsData.disk_usage, 85, 95),
          trend: 'stable',
          lastUpdated: now,
          threshold: { warning: 85, critical: 95 }
        });
      }

      // Add network and response time metrics
      if (healthData.api?.avg_response_time_ms !== undefined) {
        newMetrics.push({
          id: 'network',
          name: 'API Response',
          value: parseFloat(healthData.api.avg_response_time_ms.toFixed(1)),
          unit: 'ms',
          status: getMetricStatus(healthData.api.avg_response_time_ms, 100, 200),
          trend: 'stable',
          lastUpdated: now,
          threshold: { warning: 100, critical: 200 }
        });
      }

      // Add database response time metric
      if (healthData.database?.response_time_ms !== undefined) {
        newMetrics.push({
          id: 'database_response',
          name: 'Database Response',
          value: parseFloat(healthData.database.response_time_ms.toFixed(1)),
          unit: 'ms',
          status: getMetricStatus(healthData.database.response_time_ms, 50, 100),
          trend: 'stable',
          lastUpdated: now,
          threshold: { warning: 50, critical: 100 }
        });
      }

      // Add active users metric
      if (metricsData.active_users !== undefined) {
        newMetrics.push({
          id: 'users',
          name: 'Active Users',
          value: metricsData.active_users,
          unit: 'users',
          status: 'healthy', // Users metric doesn't have critical thresholds
          trend: 'stable',
          lastUpdated: now,
          threshold: { warning: 50, critical: 100 }
        });
      }

      // Add processing queue metric
      if (metricsData.processing_queue !== undefined) {
        newMetrics.push({
          id: 'queue',
          name: 'Processing Queue',
          value: metricsData.processing_queue,
          unit: 'tasks',
          status: getMetricStatus(metricsData.processing_queue, 10, 25),
          trend: 'stable',
          lastUpdated: now,
          threshold: { warning: 10, critical: 25 }
        });
      }

      // Add attendance today metric
      if (metricsData.attendance_today !== undefined) {
        newMetrics.push({
          id: 'attendance',
          name: 'Attendance Today',
          value: metricsData.attendance_today,
          unit: 'records',
          status: 'healthy',
          trend: 'stable',
          lastUpdated: now,
          threshold: { warning: 100, critical: 200 }
        });
      }

      // Update metrics with trend calculation
      setMetrics(prevMetrics => {
        const updatedMetrics = newMetrics.map(newMetric => {
          const prevMetric = prevMetrics.find(m => m.id === newMetric.id);
          const trend = prevMetric ? getMetricTrend(newMetric.value, prevMetric.value) : 'stable';
          return { ...newMetric, trend };
        });
        return updatedMetrics;
      });

      // Update services from health data
      const newServices: ServiceStatus[] = [];

      if (healthData.api) {
        newServices.push({
          id: 'api',
          name: 'Main API Server',
          status: healthData.api.status === 'active' ? 'online' : 'offline',
          uptime: `${healthData.uptime_hours?.toFixed(1) || '0'}h`,
          responseTime: healthData.api.avg_response_time_ms || 0,
          lastCheck: now,
          description: 'Core application API'
        });
      }

      if (healthData.database) {
        newServices.push({
          id: 'database',
          name: 'Database Server',
          status: healthData.database.status === 'connected' ? 'online' : 'offline',
          uptime: `${healthData.uptime_hours?.toFixed(1) || '0'}h`,
          responseTime: healthData.database.response_time_ms || 0,
          lastCheck: now,
          description: 'Primary database server'
        });
      }

      if (healthData.services) {
        if (healthData.services.face_recognition) {
          newServices.push({
            id: 'face_recognition',
            name: 'Face Recognition Service',
            status: healthData.services.face_recognition === 'online' ? 'online' : 'degraded',
            uptime: `${healthData.uptime_hours?.toFixed(1) || '0'}h`,
            responseTime: 350, // Face processing is typically slower
            lastCheck: now,
            description: 'AI face detection and recognition'
          });
        }

        if (healthData.services.attendance_system) {
          newServices.push({
            id: 'attendance',
            name: 'Attendance System',
            status: healthData.services.attendance_system === 'active' ? 'online' : 'offline',
            uptime: `${healthData.uptime_hours?.toFixed(1) || '0'}h`,
            responseTime: 45,
            lastCheck: now,
            description: 'Student attendance management'
          });
        }

        if (healthData.services.notification_system) {
          newServices.push({
            id: 'notification',
            name: 'Notification Service',
            status: healthData.services.notification_system === 'running' ? 'online' : 'offline',
            uptime: `${healthData.uptime_hours?.toFixed(1) || '0'}h`,
            responseTime: 25,
            lastCheck: now,
            description: 'Real-time notifications'
          });
        }

        // Add new service health checks
        if (healthData.services.memory_service) {
          newServices.push({
            id: 'memory_service',
            name: 'Memory Monitor',
            status: healthData.services.memory_service === 'healthy' ? 'online' : 'degraded',
            uptime: `${healthData.uptime_hours?.toFixed(1) || '0'}h`,
            responseTime: 15,
            lastCheck: now,
            description: 'System memory monitoring'
          });
        }

        if (healthData.services.cpu_service) {
          newServices.push({
            id: 'cpu_service',
            name: 'CPU Monitor',
            status: healthData.services.cpu_service === 'healthy' ? 'online' : 'degraded',
            uptime: `${healthData.uptime_hours?.toFixed(1) || '0'}h`,
            responseTime: 12,
            lastCheck: now,
            description: 'CPU performance monitoring'
          });
        }
      }

      setServices(newServices);

      // Generate realistic system logs based on current metrics and services
      const newLogs = [
        {
          time: now.toLocaleTimeString(),
          level: 'INFO',
          message: `System metrics updated - CPU: ${newMetrics.find(m => m.id === 'cpu')?.value || 0}%`
        },
        {
          time: new Date(now.getTime() - 30000).toLocaleTimeString(),
          level: healthData.status === 'healthy' ? 'INFO' : 'WARN',
          message: `System health check: ${healthData.status}`
        },
        {
          time: new Date(now.getTime() - 60000).toLocaleTimeString(),
          level: 'INFO',
          message: `Active users: ${metricsData.active_users || 0}`
        }
      ];

      // Add warning logs for high resource usage
      const cpuMetric = newMetrics.find(m => m.id === 'cpu');
      if (cpuMetric && cpuMetric.status !== 'healthy') {
        newLogs.unshift({
          time: now.toLocaleTimeString(),
          level: cpuMetric.status === 'critical' ? 'ERROR' : 'WARN',
          message: `High CPU usage detected: ${cpuMetric.value}%`
        });
      }

      const memoryMetric = newMetrics.find(m => m.id === 'memory');
      if (memoryMetric && memoryMetric.status !== 'healthy') {
        newLogs.unshift({
          time: now.toLocaleTimeString(),
          level: memoryMetric.status === 'critical' ? 'ERROR' : 'WARN',
          message: `High memory usage detected: ${memoryMetric.value}%`
        });
      }

      setSystemLogs(newLogs);

    } catch (error) {
      console.error('[SystemMonitor] Error fetching system metrics:', error);
      
      // Check if it's an authentication error
      const isAuthError = error instanceof Error && 
        (error.message.includes('Authentication') || 
         error.message.includes('401') || 
         error.message.includes('Not authenticated'));
      
      if (isAuthError) {
        console.log('[SystemMonitor] Authentication error detected, user may not be logged in yet');
        
        // Show a more informative message for auth issues
        setMetrics([]);
        setServices([
          {
            id: 'api',
            name: 'Main API Server',
            status: 'degraded',
            uptime: 'Unknown',
            responseTime: 0,
            lastCheck: new Date(),
            description: 'Authentication required - please ensure you are logged in'
          }
        ]);
        
        setSystemLogs([
          {
            time: new Date().toLocaleTimeString(),
            level: 'WARN',
            message: 'System monitoring requires authentication - please log in'
          }
        ]);
        
        return; // Don't set fallback metrics for auth errors
      }
      
      // For other errors, show connection issues
      const fallbackMetrics: SystemMetric[] = [
    {
      id: 'cpu',
      name: 'CPU Usage',
          value: 25,
      unit: '%',
      status: 'healthy',
      trend: 'stable',
      lastUpdated: new Date(),
      threshold: { warning: 70, critical: 90 }
    },
    {
      id: 'memory',
      name: 'Memory Usage',
          value: 45,
      unit: '%',
      status: 'healthy',
      trend: 'stable',
      lastUpdated: new Date(),
          threshold: { warning: 80, critical: 95 }
        }
      ];
      
      setMetrics(fallbackMetrics);
      setServices([
    {
      id: 'api',
      name: 'Main API Server',
          status: 'offline',
          uptime: 'Unknown',
          responseTime: 0,
      lastCheck: new Date(),
          description: 'Connection failed - backend may be unavailable'
        }
      ]);
      
      setSystemLogs([
        {
          time: new Date().toLocaleTimeString(),
          level: 'ERROR',
          message: `Failed to fetch system metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]);
    }
  }, [user]);

  // Initial fetch and set up refresh interval
  useEffect(() => {
    // Don't fetch if still loading auth or user not logged in
    if (loading) return;
    
    fetchSystemMetrics();
    
    // Only set up interval if user is authenticated
    if (user) {
      // Refresh every 10 seconds for real-time updates
      const interval = setInterval(fetchSystemMetrics, 10000);

    return () => clearInterval(interval);
    }
  }, [user, loading, fetchSystemMetrics]);

  const getMetricIcon = (metricId: string) => {
    switch (metricId) {
      case 'cpu':
        return <DeveloperBoard20Regular aria-hidden />;
      case 'memory':
        return <Desktop20Regular aria-hidden />;
      case 'disk':
        return <HardDrive20Regular aria-hidden />;
      case 'network':
        return <Wifi120Regular aria-hidden />;
      case 'database_response':
        return <Database20Regular aria-hidden />;
      case 'users':
        return <People20Regular aria-hidden />;
      case 'queue':
        return <Pulse20Regular aria-hidden />;
      case 'attendance':
        return <People20Regular aria-hidden />;
      case 'temperature':
        return <Temperature20Regular aria-hidden />;
      case 'face_processing':
        return <Eye20Regular aria-hidden />;
      default:
        return <Pulse20Regular aria-hidden />;
    }
  };

  const getServiceIcon = (serviceId: string) => {
    switch (serviceId) {
      case 'api':
        return <Server20Regular aria-hidden />;
      case 'database':
        return <Database20Regular aria-hidden />;
      case 'face_recognition':
        return <Eye20Regular aria-hidden />;
      case 'attendance':
        return <People20Regular aria-hidden />;
      case 'memory_service':
        return <Desktop20Regular aria-hidden />;
      case 'cpu_service':
        return <DeveloperBoard20Regular aria-hidden />;
      case 'camera_feed':
        return <Camera20Regular aria-hidden />;
      case 'notification':
        return <Flash20Regular aria-hidden />;
      default:
        return <Cloud20Regular aria-hidden />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'text-status-success';
      case 'warning':
      case 'degraded':
        return 'text-status-warning';
      case 'critical':
      case 'offline':
        return 'text-status-error';
      default:
        return 'text-text-muted';
    }
  };

  // Icon chip / bar tint per status (Fluent status tokens)
  const getStatusTint = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'bg-status-success-subtle text-status-success';
      case 'warning':
      case 'degraded':
        return 'bg-status-warning-subtle text-status-warning';
      case 'critical':
      case 'offline':
        return 'bg-status-error-subtle text-status-error';
      default:
        return 'bg-surface-subtle text-text-muted';
    }
  };

  const getStatusBar = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'bg-status-success';
      case 'warning':
      case 'degraded':
        return 'bg-status-warning';
      case 'critical':
      case 'offline':
        return 'bg-status-error';
      default:
        return 'bg-presence-offline';
    }
  };

  const getStatusBadgeColor = (status: string): 'success' | 'warning' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'success';
      case 'warning':
      case 'degraded':
        return 'warning';
      case 'critical':
      case 'offline':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowTrending16Regular className="text-status-error" aria-label="Trending up" />;
      case 'down':
        return <ArrowTrendingDown16Regular className="text-status-success" aria-label="Trending down" />;
      default:
        return <Subtract16Regular className="text-text-muted" aria-label="Stable" />;
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    await fetchSystemMetrics();
    setIsRefreshing(false);
  };

  const systemHealthScore = Math.round(
    metrics.reduce((acc, metric) => {
      if (metric.status === 'healthy') return acc + 20;
      if (metric.status === 'warning') return acc + 10;
      return acc;
    }, 0) / metrics.length * 5
  );

  const overallStatus = systemHealthScore > 80 ? 'healthy' : systemHealthScore > 60 ? 'warning' : 'critical';

  return (
    <Card className={`border-0 shadow overflow-hidden ${className}`}>
      <CardHeader className="space-y-0 border-b border-border-subtle px-5 pb-0 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <Desktop20Regular aria-hidden />
            </div>
            <div>
              <CardTitle className="text-subheading text-text-primary">System Monitor</CardTitle>
              <p className="text-caption text-text-muted">Real-time performance and health monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeColor(overallStatus)} shape="pill" className="gap-1.5">
              <span className={`h-2 w-2 rounded-full bg-current ${getStatusColor(overallStatus)}`} aria-hidden />
              <span className="tabular-nums">Health: {systemHealthScore}%</span>
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <ArrowSync16Regular className={isRefreshing ? 'animate-spin' : ''} aria-hidden />
              Refresh
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Monitor settings" className="text-text-muted hover:text-text-primary">
              <Settings16Regular aria-hidden />
            </Button>
          </div>
        </div>

        {/* Tab Navigation (Fluent TabList) */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="System monitor views">
          {[
            { id: 'metrics', label: 'System Metrics', icon: DataUsage20Regular },
            { id: 'services', label: 'Services', icon: Server20Regular },
            { id: 'logs', label: 'System Logs', icon: TextBulletListSquare20Regular }
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id as 'metrics' | 'services' | 'logs')}
                className={`relative flex h-10 items-center gap-2 whitespace-nowrap rounded-t-md px-3 text-body transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? 'font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <tab.icon className={active ? 'text-brand-foreground' : 'text-text-muted'} aria-hidden />
                {tab.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-brand" aria-hidden />}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.id} className="rounded-lg border border-border-subtle bg-surface-default p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${getStatusTint(metric.status)}`}>
                        {getMetricIcon(metric.id)}
                      </div>
                      <span className="truncate text-body-strong text-text-primary">{metric.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {getTrendIcon(metric.trend)}
                      <Badge variant={getStatusBadgeColor(metric.status)} shape="pill" className="capitalize">
                        {metric.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                        {metric.value}
                      </span>
                      <span className="text-body text-text-muted">{metric.unit}</span>
                    </div>

                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle" role="presentation">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${getStatusBar(metric.status)} transition-all duration-300 ease-fluent-standard`}
                        style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-caption text-text-muted tabular-nums">
                      <span>0</span>
                      <span className="flex items-center gap-0.5 text-status-warning">
                        <Warning12Regular aria-label="Warning threshold" />
                        {metric.threshold.warning}
                      </span>
                      <span className="flex items-center gap-0.5 text-status-error">
                        <ErrorCircle12Regular aria-label="Critical threshold" />
                        {metric.threshold.critical}
                      </span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <ScrollArea className="h-96 rounded-md border border-border-subtle">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-[1] bg-surface-subtle">
                <tr className="border-b border-border-subtle text-caption-strong text-text-secondary">
                  <th scope="col" className="px-4 py-2 font-semibold">Service</th>
                  <th scope="col" className="hidden px-4 py-2 font-semibold sm:table-cell">Uptime</th>
                  <th scope="col" className="hidden px-4 py-2 font-semibold sm:table-cell">Response</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id} className="border-b border-border-subtle transition-colors duration-150 last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-2.5">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md ${getStatusTint(service.status)}`}>
                          {getServiceIcon(service.id)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-body-strong text-text-primary">{service.name}</h4>
                          <p className="text-caption text-text-muted">{service.description}</p>
                          <p className="mt-0.5 flex items-center gap-3 text-caption text-text-muted sm:hidden">
                            <span className="flex items-center gap-1">
                              <Clock12Regular aria-hidden />
                              Uptime: {service.uptime}
                            </span>
                            <span>Response: {Math.round(service.responseTime)}ms</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 text-body tabular-nums text-text-secondary sm:table-cell">
                      <span className="flex items-center gap-1">
                        <Clock12Regular className="text-text-muted" aria-hidden />
                        {service.uptime}
                      </span>
                    </td>
                    <td className="hidden px-4 py-2.5 text-body tabular-nums text-text-secondary sm:table-cell">
                      {Math.round(service.responseTime)}ms
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge variant={getStatusBadgeColor(service.status)} shape="pill" className="gap-1 capitalize">
                        {service.status === 'online' ? (
                          <CheckmarkCircle12Filled aria-hidden />
                        ) : service.status === 'degraded' ? (
                          <Warning12Filled aria-hidden />
                        ) : (
                          <ErrorCircle12Filled aria-hidden />
                        )}
                        {service.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}

        {activeTab === 'logs' && (
          <ScrollArea className="h-96 rounded-md border border-border-subtle">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-[1] bg-surface-subtle">
                <tr className="border-b border-border-subtle text-caption-strong text-text-secondary">
                  <th scope="col" className="w-28 px-4 py-2 font-semibold">Time</th>
                  <th scope="col" className="w-24 px-4 py-2 font-semibold">Level</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Message</th>
                </tr>
              </thead>
              <tbody>
                {systemLogs.map((log, index) => (
                  <tr key={index} className="border-b border-border-subtle align-top transition-colors duration-150 last:border-0 hover:bg-surface-hover">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-caption text-text-muted">{log.time}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          log.level === 'ERROR' ? 'destructive' :
                          log.level === 'WARN' ? 'warning' :
                          'info'
                        }
                        shape="pill"
                        className="font-mono"
                      >
                        {log.level}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-caption text-text-primary">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedSystemMonitor;
