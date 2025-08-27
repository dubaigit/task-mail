import React, { useState, useEffect, useCallback } from 'react';
import { Icons } from '../ui/icons';
import {
  Cpu as CpuChipIcon,
  Database as CircleStackIcon,
  Server as ServerIcon,
  Activity as SignalIcon,
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon,
  BarChart3 as ChartBarIcon
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SystemHealthMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    available: number;
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    inbound: number;
    outbound: number;
    latency: number;
    packetsLost: number;
  };
  database: {
    connections: number;
    queryTime: number;
    slowQueries: number;
    uptime: number;
  };
  services: {
    running: number;
    stopped: number;
    failed: number;
  };
}

interface HealthCheck {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  responseTime: number;
  lastChecked: string;
  details?: Record<string, any>;
  error?: string;
}

interface SystemAlert {
  id: string;
  type: 'performance' | 'resource' | 'service' | 'security' | 'maintenance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged?: boolean;
  resolvedAt?: string;
}

interface AdminSystemHealthValidatorProps {
  className?: string;
  onHealthStatusChange?: (status: 'healthy' | 'degraded' | 'critical') => void;
  onAlert?: (alert: SystemAlert) => void;
}

export const AdminSystemHealthValidator: React.FC<AdminSystemHealthValidatorProps> = ({
  className = '',
  onHealthStatusChange,
  onAlert
}) => {
  const [metrics, setMetrics] = useState<SystemHealthMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<SystemHealthMetrics | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [overallHealth, setOverallHealth] = useState<'healthy' | 'degraded' | 'critical'>('healthy');

  // Generate realistic system metrics
  const generateSystemMetrics = useCallback((): SystemHealthMetrics => {
    const timestamp = new Date().toISOString();
    const baseLoad = 20 + Math.sin(Date.now() / 300000) * 15; // Sine wave pattern
    
    return {
      timestamp,
      cpu: {
        usage: Math.max(0, Math.min(100, baseLoad + (Math.random() - 0.5) * 20)),
        cores: 8,
        temperature: 45 + Math.random() * 15
      },
      memory: {
        used: 4096 + Math.random() * 2048,
        total: 8192,
        available: 8192 - (4096 + Math.random() * 2048),
        usage: Math.max(0, Math.min(100, 50 + (Math.random() - 0.5) * 30))
      },
      disk: {
        used: 256000 + Math.random() * 64000,
        total: 512000,
        usage: Math.max(0, Math.min(100, 50 + (Math.random() - 0.5) * 20)),
        readSpeed: 100 + Math.random() * 200,
        writeSpeed: 80 + Math.random() * 150
      },
      network: {
        inbound: Math.random() * 1000,
        outbound: Math.random() * 500,
        latency: 20 + Math.random() * 50,
        packetsLost: Math.random() * 0.1
      },
      database: {
        connections: 15 + Math.floor(Math.random() * 35),
        queryTime: 50 + Math.random() * 200,
        slowQueries: Math.floor(Math.random() * 5),
        uptime: 86400 + Math.random() * 604800
      },
      services: {
        running: 12 + Math.floor(Math.random() * 3),
        stopped: Math.floor(Math.random() * 2),
        failed: Math.random() > 0.9 ? 1 : 0
      }
    };
  }, []);

  // Generate health checks
  const generateHealthChecks = useCallback((): HealthCheck[] => {
    const services = [
      { id: 'database', name: 'PostgreSQL Database' },
      { id: 'redis', name: 'Redis Cache' },
      { id: 'api', name: 'REST API Server' },
      { id: 'websocket', name: 'WebSocket Server' },
      { id: 'email', name: 'Email Service' },
      { id: 'storage', name: 'File Storage' },
      { id: 'ai_service', name: 'AI Processing Service' },
      { id: 'backup', name: 'Backup Service' }
    ];

    return services.map(service => {
      const random = Math.random();
      let status: HealthCheck['status'];
      let responseTime = 50 + Math.random() * 200;
      let error: string | undefined;

      if (random > 0.95) {
        status = 'critical';
        responseTime = 5000 + Math.random() * 5000;
        error = 'Service unavailable';
      } else if (random > 0.85) {
        status = 'warning';
        responseTime = 1000 + Math.random() * 2000;
        error = 'High response time';
      } else if (random > 0.02) {
        status = 'healthy';
      } else {
        status = 'unknown';
        error = 'Health check timeout';
      }

      return {
        id: service.id,
        name: service.name,
        status,
        responseTime,
        lastChecked: new Date().toISOString(),
        error
      };
    });
  }, []);

  // Generate system alerts
  const generateAlert = useCallback((): SystemAlert | null => {
    if (Math.random() > 0.1) return null;

    const alertTypes = [
      {
        type: 'performance' as const,
        severity: 'warning' as const,
        title: 'High CPU Usage',
        message: 'CPU usage has been above 80% for the last 10 minutes'
      },
      {
        type: 'resource' as const,
        severity: 'error' as const,
        title: 'Low Disk Space',
        message: 'Disk space is running low (less than 10% available)'
      },
      {
        type: 'service' as const,
        severity: 'critical' as const,
        title: 'Service Failure',
        message: 'Critical service has stopped responding'
      },
      {
        type: 'maintenance' as const,
        severity: 'info' as const,
        title: 'Scheduled Maintenance',
        message: 'System maintenance window scheduled for tonight'
      }
    ];

    const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alert,
      timestamp: new Date().toISOString()
    };
  }, []);

  // Update system health status
  const updateOverallHealth = useCallback((metrics: SystemHealthMetrics, checks: HealthCheck[]) => {
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check for critical conditions
    if (
      metrics.cpu.usage > 90 ||
      metrics.memory.usage > 95 ||
      metrics.disk.usage > 95 ||
      checks.some(check => check.status === 'critical') ||
      metrics.services.failed > 0
    ) {
      status = 'critical';
    } else if (
      metrics.cpu.usage > 75 ||
      metrics.memory.usage > 85 ||
      metrics.disk.usage > 85 ||
      checks.some(check => check.status === 'warning') ||
      metrics.database.queryTime > 500
    ) {
      status = 'degraded';
    }

    if (status !== overallHealth) {
      setOverallHealth(status);
      onHealthStatusChange?.(status);
    }
  }, [overallHealth, onHealthStatusChange]);

  // Monitor system health
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      const newMetrics = generateSystemMetrics();
      const newChecks = generateHealthChecks();
      const newAlert = generateAlert();

      setCurrentMetrics(newMetrics);
      setMetrics(prev => [...prev, newMetrics].slice(-50)); // Keep last 50 points
      setHealthChecks(newChecks);
      
      if (newAlert) {
        setAlerts(prev => [newAlert, ...prev.slice(0, 19)]); // Keep last 20 alerts
        onAlert?.(newAlert);
      }

      updateOverallHealth(newMetrics, newChecks);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isMonitoring, generateSystemMetrics, generateHealthChecks, generateAlert, updateOverallHealth, onAlert]);

  // Initialize
  useEffect(() => {
    const initialMetrics = generateSystemMetrics();
    const initialChecks = generateHealthChecks();
    
    setCurrentMetrics(initialMetrics);
    setMetrics([initialMetrics]);
    setHealthChecks(initialChecks);
    updateOverallHealth(initialMetrics, initialChecks);
  }, [generateSystemMetrics, generateHealthChecks, updateOverallHealth]);

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'warning': case 'degraded': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'critical': case 'error': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'unknown': return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
    }
  };

  const getUsageColor = (usage: number) => {
    if (usage > 90) return 'bg-red-600';
    if (usage > 75) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, resolvedAt: new Date().toISOString() }
          : alert
      )
    );
  };

  return (
    <div className={`admin-system-health-validator ${className} space-y-6`}>
      {/* System Health Header */}
      <div className="flex items-center justify-between p-6 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            overallHealth === 'healthy' ? 'bg-green-100 dark:bg-green-900/30' :
            overallHealth === 'degraded' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
            'bg-red-100 dark:bg-red-900/30'
          }`}>
            <ServerIcon className={`w-6 h-6 ${
              overallHealth === 'healthy' ? 'text-green-600' :
              overallHealth === 'degraded' ? 'text-yellow-600' :
              'text-red-600'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">System Health Monitor</h3>
            <p className="text-sm text-muted-foreground">
              Overall Status: 
              <span className={`ml-1 font-medium ${
                overallHealth === 'healthy' ? 'text-green-600' :
                overallHealth === 'degraded' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {overallHealth === 'healthy' ? 'All Systems Operational' :
                 overallHealth === 'degraded' ? 'Performance Degraded' :
                 'Critical Issues Detected'}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="health-monitoring"
              checked={isMonitoring}
              onChange={(e) => setIsMonitoring(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="health-monitoring" className="text-sm text-muted-foreground">
              Real-time Monitoring
            </label>
          </div>
          
          <div className={`flex items-center gap-2 text-sm ${
            isMonitoring ? 'text-green-600' : 'text-gray-600'
          }`}>
            <SignalIcon className="w-4 h-4" />
            <span>{isMonitoring ? 'Active' : 'Paused'}</span>
          </div>
        </div>
      </div>

      {/* Current System Metrics */}
      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CPU Metrics */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CpuChipIcon className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-foreground">CPU</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {currentMetrics.cpu.usage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${getUsageColor(currentMetrics.cpu.usage)}`}
                style={{ width: `${currentMetrics.cpu.usage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Cores: {currentMetrics.cpu.cores}</div>
              {currentMetrics.cpu.temperature && (
                <div>Temp: {currentMetrics.cpu.temperature.toFixed(1)}°C</div>
              )}
            </div>
          </div>

          {/* Memory Metrics */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CircleStackIcon className="w-5 h-5 text-green-600" />
                <span className="font-medium text-foreground">Memory</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {currentMetrics.memory.usage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${getUsageColor(currentMetrics.memory.usage)}`}
                style={{ width: `${currentMetrics.memory.usage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Used: {(currentMetrics.memory.used / 1024).toFixed(1)}GB</div>
              <div>Total: {(currentMetrics.memory.total / 1024).toFixed(1)}GB</div>
            </div>
          </div>

          {/* Disk Metrics */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ServerIcon className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-foreground">Disk</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {currentMetrics.disk.usage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${getUsageColor(currentMetrics.disk.usage)}`}
                style={{ width: `${currentMetrics.disk.usage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Read: {currentMetrics.disk.readSpeed.toFixed(0)} MB/s</div>
              <div>Write: {currentMetrics.disk.writeSpeed.toFixed(0)} MB/s</div>
            </div>
          </div>

          {/* Database Metrics */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CircleStackIcon className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-foreground">Database</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {currentMetrics.database.connections}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Connections: {currentMetrics.database.connections}</div>
              <div>Query Time: {currentMetrics.database.queryTime.toFixed(0)}ms</div>
              <div>Slow Queries: {currentMetrics.database.slowQueries}</div>
            </div>
          </div>
        </div>
      )}

      {/* Service Health Checks */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h4 className="text-lg font-semibold text-foreground mb-4">Service Health Checks</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {healthChecks.map(check => (
            <div key={check.id} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{check.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${getHealthStatusColor(check.status)}`}>
                  {check.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Response: {check.responseTime.toFixed(0)}ms</div>
                <div>Last Check: {new Date(check.lastChecked).toLocaleTimeString()}</div>
                {check.error && (
                  <div className="text-red-600">{check.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Performance Charts */}
      {metrics.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">Resource Usage</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="timestamp" 
                    className="text-xs"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis className="text-xs" domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cpu.usage" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                    name="CPU %" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="memory.usage" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.3}
                    name="Memory %" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">Network & Database</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="timestamp" 
                    className="text-xs"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="network.latency" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    name="Latency (ms)" 
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="database.queryTime" 
                    stroke="#ef4444" 
                    strokeWidth={2} 
                    name="DB Query (ms)" 
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* System Alerts */}
      {alerts.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h4 className="text-lg font-semibold text-foreground mb-4">System Alerts</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={`alert-item p-4 border border-border rounded-lg ${
                  alert.resolvedAt ? 'opacity-60' : alert.acknowledged ? 'opacity-80' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getHealthStatusColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      {alert.type}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <div className="mb-3">
                  <h5 className="font-medium text-foreground">{alert.title}</h5>
                  <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {alert.resolvedAt ? (
                    <span className="text-xs text-green-600">Resolved</span>
                  ) : alert.acknowledged ? (
                    <>
                      <span className="text-xs text-blue-600">Acknowledged</span>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Resolve
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemHealthValidator;