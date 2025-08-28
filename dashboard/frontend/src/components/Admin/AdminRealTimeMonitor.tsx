import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../ui/icons';
import {
  Server as ServerIcon,
  Activity as SignalIcon,
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RealTimeMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  activeConnections: number;
  requestsPerSecond: number;
  responseTime: number;
  errorRate: number;
}

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  resolved?: boolean;
}

interface AdminRealTimeMonitorProps {
  className?: string;
  wsEndpoint?: string;
  updateInterval?: number;
}

export const AdminRealTimeMonitor: React.FC<AdminRealTimeMonitorProps> = ({
  className = '',
  wsEndpoint = 'ws://localhost:8000',
  updateInterval = 2000
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<RealTimeMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<RealTimeMetrics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  // Initialize WebSocket connection
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      wsRef.current = new WebSocket(wsEndpoint);

      wsRef.current.onopen = () => {
        setConnectionStatus('connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        
        // Request initial metrics
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({ type: 'admin:subscribe_metrics' }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        setConnectionStatus('disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('📡 Admin WebSocket error:', error);
        setConnectionStatus('error');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      scheduleReconnect();
    }
  };

  // Schedule reconnection attempt
  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connectWebSocket();
    }, delay);
  };

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'admin:metrics_update':
        const newMetrics: RealTimeMetrics = {
          timestamp: data.timestamp || new Date().toISOString(),
          cpu: data.cpu || 0,
          memory: data.memory || 0,
          activeConnections: data.activeConnections || 0,
          requestsPerSecond: data.requestsPerSecond || 0,
          responseTime: data.responseTime || 0,
          errorRate: data.errorRate || 0
        };
        
        setCurrentMetrics(newMetrics);
        setMetrics(prev => {
          const updated = [...prev, newMetrics];
          // Keep only last 50 data points for performance
          return updated.slice(-50);
        });
        break;
        
      case 'admin:system_alert':
        const newAlert: SystemAlert = {
          id: data.id || Date.now().toString(),
          type: data.alertType || 'info',
          message: data.message || 'System notification',
          timestamp: data.timestamp || new Date().toISOString(),
          resolved: data.resolved || false
        };
        
        setAlerts(prev => {
          // Add new alert and remove old ones (keep last 20)
          const updated = [newAlert, ...prev].slice(0, 20);
          return updated;
        });
        break;
        
      default:
    }
  };

  // Fallback: Generate mock data if WebSocket is unavailable
  const generateMockData = () => {
    const mockMetrics: RealTimeMetrics = {
      timestamp: new Date().toISOString(),
      cpu: Math.random() * 80 + 10,
      memory: Math.random() * 70 + 20,
      activeConnections: Math.floor(Math.random() * 200) + 50,
      requestsPerSecond: Math.random() * 100 + 20,
      responseTime: Math.random() * 50 + 10,
      errorRate: Math.random() * 5
    };
    
    setCurrentMetrics(mockMetrics);
    setMetrics(prev => [...prev, mockMetrics].slice(-50));
  };

  // Initialize connection and cleanup
  useEffect(() => {
    connectWebSocket();
    
    // Fallback interval for mock data if WebSocket fails
    const fallbackInterval = setInterval(() => {
      if (!isConnected) {
        generateMockData();
      }
    }, updateInterval);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(fallbackInterval);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected': return 'text-gray-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircleIcon className="w-4 h-4" />;
      case 'connecting': return <ClockIcon className="w-4 h-4 animate-pulse" />;
      case 'disconnected': return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'error': return <ExclamationTriangleIcon className="w-4 h-4" />;
      default: return <ServerIcon className="w-4 h-4" />;
    }
  };

  const getAlertColor = (type: SystemAlert['type']) => {
    switch (type) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'error': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'info': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  return (
    <div className={`admin-realtime-monitor ${className} space-y-6`}>
      {/* Connection Status Header */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <SignalIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Real-Time Monitoring</h3>
            <p className="text-sm text-muted-foreground">Live system metrics and alerts</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 text-sm ${getConnectionStatusColor()}`}>
          {getConnectionStatusIcon()}
          <span className="capitalize">
            {connectionStatus}
            {connectionStatus === 'connecting' && reconnectAttempts > 0 && (
              <span className="ml-1 text-xs">({reconnectAttempts}/{maxReconnectAttempts})</span>
            )}
          </span>
        </div>
      </div>

      {/* Current Metrics */}
      {currentMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="metric-card bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{currentMetrics.cpu.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">CPU Usage</div>
          </div>
          
          <div className="metric-card bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{currentMetrics.memory.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Memory</div>
          </div>
          
          <div className="metric-card bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{currentMetrics.activeConnections}</div>
            <div className="text-sm text-muted-foreground">Connections</div>
          </div>
          
          <div className="metric-card bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{currentMetrics.requestsPerSecond.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Req/sec</div>
          </div>
          
          <div className="metric-card bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{currentMetrics.responseTime.toFixed(0)}ms</div>
            <div className="text-sm text-muted-foreground">Response</div>
          </div>
          
          <div className="metric-card bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{currentMetrics.errorRate.toFixed(2)}%</div>
            <div className="text-sm text-muted-foreground">Error Rate</div>
          </div>
        </div>
      )}

      {/* Real-time Charts */}
      {metrics.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="performance-chart bg-card border border-border rounded-lg p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">CPU & Memory Usage</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
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
                  <Line 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    name="CPU %" 
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="memory" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    name="Memory %" 
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="performance-chart bg-card border border-border rounded-lg p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">Response Time & Errors</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
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
                    dataKey="responseTime" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    name="Response Time (ms)" 
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errorRate" 
                    stroke="#ef4444" 
                    strokeWidth={2} 
                    name="Error Rate (%)" 
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
        <div className="system-alerts bg-card border border-border rounded-lg p-6">
          <h4 className="text-lg font-semibold text-foreground mb-4">System Alerts</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`alert-item p-3 rounded-md border ${alert.resolved ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getAlertColor(alert.type)}`}>
                      {alert.type.toUpperCase()}
                    </div>
                    <div className="font-medium text-foreground mt-1">{alert.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {alert.resolved && (
                    <CheckCircleIcon className="w-5 h-5 text-green-600 ml-2" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data placeholder */}
      {metrics.length === 0 && (
        <div className="text-center py-12">
          <ServerIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Real-Time Data</h3>
          <p className="text-sm text-muted-foreground">
            {isConnected ? 'Waiting for metrics...' : 'Connecting to monitoring service...'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminRealTimeMonitor;
