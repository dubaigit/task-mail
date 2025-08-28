/**
 * Advanced Performance Analytics Dashboard
 * 
 * Real-time performance monitoring dashboard that displays Core Web Vitals,
 * performance metrics, budget violations, and regression detection.
 * Integrates with the performance monitoring system for comprehensive insights.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap as BoltIcon,
  Cpu as CpuChipIcon,
  BarChart3 as ChartBarIcon,
  Activity as SignalIcon,
  TrendingUp as ArrowTrendingUpIcon,
  TrendingDown as ArrowTrendingDownIcon,
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon
} from 'lucide-react';
import { Icons } from '../ui/icons';
import { Card, Button, Badge, Alert, Skeleton } from '../ui';
import { usePerformanceMonitor, PerformanceMetrics, CoreWebVitals } from '../../utils/performanceMonitor';

interface PerformanceAnalyticsProps {
  refreshInterval?: number;
  showHistoricalData?: boolean;
  enableAlerts?: boolean;
}

interface MetricCard {
  title: string;
  value: string | number;
  unit?: string;
  target: number;
  status: 'good' | 'warning' | 'poor';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
  };
  description: string;
  icon: React.ReactNode;
}

const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  refreshInterval = 10000,
  showHistoricalData = true,
  enableAlerts = true
}) => {
  const { monitor, getLatestMetrics, getBudgetViolations, getMetricsHistory } = usePerformanceMonitor();
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [historicalMetrics, setHistoricalMetrics] = useState<PerformanceMetrics[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Refresh performance data
  const refreshData = useCallback(() => {
    const latest = getLatestMetrics();
    const history = getMetricsHistory();
    const currentViolations = getBudgetViolations();

    setCurrentMetrics(latest);
    setHistoricalMetrics(history);
    setViolations(currentViolations);
    setIsLoading(false);
  }, [getLatestMetrics, getMetricsHistory, getBudgetViolations]);

  // Set up real-time monitoring
  useEffect(() => {
    // Initial load
    refreshData();

    // Set up periodic refresh
    const interval = setInterval(refreshData, refreshInterval);

    // Set up performance alerts
    if (enableAlerts) {
      monitor.onAlert((alert: any) => {
        setAlerts(prev => [alert, ...prev].slice(0, 10)); // Keep last 10 alerts
      });
    }

    return () => {
      clearInterval(interval);
    };
  }, [refreshData, refreshInterval, enableAlerts, monitor]);

  // Calculate Core Web Vitals status
  const getVitalStatus = useCallback((value: number, good: number, poor: number): 'good' | 'warning' | 'poor' => {
    if (value <= good) return 'good';
    if (value <= poor) return 'warning';
    return 'poor';
  }, []);

  // Calculate trend from historical data
  const calculateTrend = useCallback((metricPath: string): { value: number; direction: 'up' | 'down' | 'stable' } => {
    if (historicalMetrics.length < 2) {
      return { value: 0, direction: 'stable' };
    }

    const recent = historicalMetrics.slice(-3); // Last 3 measurements
    const older = historicalMetrics.slice(-6, -3); // Previous 3 measurements

    if (recent.length === 0 || older.length === 0) {
      return { value: 0, direction: 'stable' };
    }

    const recentAvg = recent.reduce((sum, metric) => {
      const value = getNestedValue(metric, metricPath);
      return sum + (value || 0);
    }, 0) / recent.length;

    const olderAvg = older.reduce((sum, metric) => {
      const value = getNestedValue(metric, metricPath);
      return sum + (value || 0);
    }, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    return {
      value: Math.abs(change),
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
    };
  }, [historicalMetrics]);

  // Helper function to get nested object values
  const getNestedValue = (obj: any, path: string): number => {
    return path.split('.').reduce((current, key) => current?.[key], obj) || 0;
  };

  // Prepare metric cards data
  const metricCards: MetricCard[] = useMemo(() => {
    if (!currentMetrics) return [];

    const { coreWebVitals, memoryUsage, resourceMetrics, networkMetrics } = currentMetrics;

    return [
      {
        title: 'Largest Contentful Paint',
        value: Math.round(coreWebVitals.lcp),
        unit: 'ms',
        target: 2500,
        status: getVitalStatus(coreWebVitals.lcp, 2500, 4000),
        trend: calculateTrend('coreWebVitals.lcp'),
        description: 'Time when the largest content element becomes visible',
        icon: <Icons.eye className="w-6 h-6" />
      },
      {
        title: 'Interaction to Next Paint',
        value: Math.round(coreWebVitals.inp),
        unit: 'ms',
        target: 200,
        status: getVitalStatus(coreWebVitals.inp, 200, 500),
        trend: calculateTrend('coreWebVitals.inp'),
        description: 'Time between user interaction and next paint',
        icon: <BoltIcon className="w-6 h-6" />
      },
      {
        title: 'Cumulative Layout Shift',
        value: coreWebVitals.cls.toFixed(3),
        target: 0.1,
        status: getVitalStatus(coreWebVitals.cls, 0.1, 0.25),
        trend: calculateTrend('coreWebVitals.cls'),
        description: 'Unexpected layout shifts during page load',
        icon: <Icons.phone className="w-6 h-6" />
      },
      {
        title: 'First Contentful Paint',
        value: Math.round(coreWebVitals.fcp),
        unit: 'ms',
        target: 1800,
        status: getVitalStatus(coreWebVitals.fcp, 1800, 3000),
        trend: calculateTrend('coreWebVitals.fcp'),
        description: 'Time when first content becomes visible',
        icon: <Icons.clock className="w-6 h-6" />
      },
      {
        title: 'Memory Usage',
        value: memoryUsage ? Math.round(memoryUsage.used / 1024 / 1024) : 0,
        unit: 'MB',
        target: 100,
        status: memoryUsage ? getVitalStatus(memoryUsage.used / 1024 / 1024, 50, 100) : 'good',
        trend: calculateTrend('memoryUsage.used'),
        description: 'JavaScript heap memory consumption',
        icon: <CpuChipIcon className="w-6 h-6" />
      },
      {
        title: 'Resource Count',
        value: resourceMetrics.totalResources,
        target: 50,
        status: getVitalStatus(resourceMetrics.totalResources, 50, 100),
        trend: calculateTrend('resourceMetrics.totalResources'),
        description: 'Number of loaded resources',
        icon: <ChartBarIcon className="w-6 h-6" />
      },
      {
        title: 'Network Quality',
        value: networkMetrics.connectionType.toUpperCase(),
        target: 0,
        status: networkMetrics.connectionType === '4g' ? 'good' : 
               networkMetrics.connectionType === '3g' ? 'warning' : 'poor',
        description: 'Current network connection type',
        icon: <SignalIcon className="w-6 h-6" />
      },
      {
        title: 'Bundle Size',
        value: Math.round(resourceMetrics.totalSize / 1024),
        unit: 'KB',
        target: 500,
        status: getVitalStatus(resourceMetrics.totalSize / 1024, 300, 500),
        trend: calculateTrend('resourceMetrics.totalSize'),
        description: 'Total size of loaded resources',
        icon: <Icons.cpu className="w-6 h-6" />
      }
    ];
  }, [currentMetrics, getVitalStatus, calculateTrend]);

  // Get status color for metric cards
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'warning': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
      case 'poor': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  // Get trend icon
  const getTrendIcon = (trend?: { direction: string; value: number }) => {
    if (!trend || trend.direction === 'stable') return null;
    
    const Icon = trend.direction === 'up' ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    const color = trend.direction === 'up' ? 'text-red-500' : 'text-green-500';
    
    return <Icon className={`w-3 h-3 ${color}`} />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton height="2rem" width="16rem" />
          <Skeleton height="2.5rem" width="8rem" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }, (_, i) => (
            <Card key={i} padding="lg">
              <div className="space-y-3">
                <Skeleton height="1.5rem" width="70%" />
                <Skeleton height="2rem" width="50%" />
                <Skeleton height="1rem" width="80%" />
              </div>
            </Card>
          ))}
        </div>
        
        <Card padding="lg">
          <Skeleton height="20rem" width="100%" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Real-time Core Web Vitals and performance monitoring
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={refreshData}
            variant="outline"
            leftIcon={<ChartBarIcon className="w-4 h-4" />}
          >
            Refresh
          </Button>
          
          <Button
            onClick={() => monitor.captureCurrentMetrics()}
            variant="primary"
            leftIcon={<BoltIcon className="w-4 h-4" />}
          >
            Capture Metrics
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {enableAlerts && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.slice(0, 3).map((alert, index) => (
            <Alert
              key={index}
              variant={alert.severity === 'critical' ? 'danger' : 'warning'}
              title={`Performance Alert: ${alert.type.toUpperCase()}`}
              dismissible
              onDismiss={() => setAlerts(prev => prev.filter((_, i) => i !== index))}
            >
              <p>{alert.message}</p>
              <p className="text-xs mt-1 opacity-75">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </p>
            </Alert>
          ))}
        </div>
      )}

      {/* Budget Violations */}
      {violations.length > 0 && (
        <Card padding="lg" variant="elevated" className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-3 mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-800">Performance Budget Violations</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {violations.map((violation, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-red-800">{violation.metric}</span>
                  <Badge variant="danger" >{violation.severity}</Badge>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <div>Current: {typeof violation.current === 'number' ? violation.current.toFixed(2) : violation.current}</div>
                  <div>Budget: {typeof violation.budget === 'number' ? violation.budget.toFixed(2) : violation.budget}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => (
          <Card key={index} padding="lg" variant="elevated" hover>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${getStatusColor(metric.status)}`}>
                    {metric.icon}
                  </div>
                  {metric.trend && (
                    <div className="flex items-center gap-1">
                      {getTrendIcon(metric.trend)}
                      <span className="text-xs text-muted-foreground">
                        {metric.trend.value.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {metric.title}
                </h3>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold text-foreground">
                    {metric.value}
                  </span>
                  {metric.unit && (
                    <span className="text-sm text-muted-foreground">
                      {metric.unit}
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground leading-tight">
                  {metric.description}
                </p>
                
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Target: {metric.target}{metric.unit}
                    </span>
                    <Badge 
                      variant={
                        metric.status === 'good' ? 'success' :
                        metric.status === 'warning' ? 'warning' : 'danger'
                      }
                      
                    >
                      {metric.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Historical Performance Chart */}
      {showHistoricalData && historicalMetrics.length > 0 && (
        <Card padding="lg" variant="elevated">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Performance Timeline</h3>
            <div className="flex gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                LCP
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                INP
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                CLS
              </Badge>
            </div>
          </div>
          
          <div className="space-y-4">
            {historicalMetrics.slice(-10).map((metric, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="text-sm text-muted-foreground">
                  {new Date(metric.timestamp).toLocaleTimeString()}
                </div>
                
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>LCP: {Math.round(metric.coreWebVitals.lcp)}ms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>INP: {Math.round(metric.coreWebVitals.inp)}ms</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>CLS: {metric.coreWebVitals.cls.toFixed(3)}</span>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {metric.memoryUsage && 
                    `${Math.round(metric.memoryUsage.used / 1024 / 1024)}MB`
                  }
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Performance Recommendations */}
      <Card padding="lg" variant="elevated">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircleIcon className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold text-foreground">Performance Recommendations</h3>
        </div>
        
        <div className="space-y-3">
          {violations.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              <span className="text-green-800 dark:text-green-200">
                All performance metrics are within budget targets!
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {violations.map((violation, index) => (
                <div key={index} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                    Optimize {violation.metric}
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-300">
                    {getRecommendation(violation.metric)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

function getRecommendation(metric: string): string {
  switch (metric) {
    case 'LCP':
      return 'Consider optimizing images, reducing server response times, and preloading critical resources.';
    case 'INP':
      return 'Reduce JavaScript execution time, optimize event handlers, and minimize layout thrashing.';
    case 'CLS':
      return 'Set explicit dimensions for images/videos, avoid inserting content above existing content, and use CSS containment.';
    case 'Memory Usage':
      return 'Monitor for memory leaks, optimize component re-renders, and clean up event listeners.';
    default:
      return 'Monitor this metric and consider general performance optimizations.';
  }
}

export default PerformanceAnalytics;