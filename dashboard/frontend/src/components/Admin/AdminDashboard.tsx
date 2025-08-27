import React, { useState, useEffect } from 'react';
import { Icons } from '../ui/icons';
import {
  Users as UsersIcon,
  ShieldCheck as ShieldCheckIcon,
  Server as ServerIcon,
  BarChart3 as ChartBarIcon,
  Settings as CogIcon,
  AlertTriangle as ExclamationTriangleIcon,
  Clock as ClockIcon,
  Eye as EyeIcon,
  Terminal as CommandLineIcon,
  CheckCircle as CheckCircleSolid,
  AlertTriangle as ExclamationTriangleSolid,
  XCircle as XCircleSolid
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SystemMetrics {
  cpu: number;
  memory: number;
  storage: number;
  uptime: string;
  activeUsers: number;
  totalUsers: number;
  emailsProcessed: number;
  aiRequestsToday: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  delegatedTasks: number;
  completionRate: number;
  permissions: string[];
  joinedAt: string;
}

interface SecurityEvent {
  id: string;
  type: 'login_success' | 'login_failed' | 'permission_denied' | 'token_expired' | 'suspicious_activity';
  userId?: string;
  userEmail?: string;
  ip: string;
  timestamp: string;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  category: 'system' | 'security' | 'ai' | 'email';
  updatedBy: string;
  updatedAt: string;
}

interface AdminDashboardProps {
  className?: string;
  userRole?: 'admin' | 'manager' | 'user';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  className = '',
  userRole = 'admin'
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'system' | 'security' | 'analytics' | 'config'>('overview');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [securityFilter, setSecurityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  // Check admin access
  if (userRole !== 'admin' && userRole !== 'manager') {
    return (
      <div className="admin-dashboard-access-denied p-8 text-center">
        <ShieldCheckIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground">
          You don't have permission to access the administrative dashboard.
        </p>
      </div>
    );
  }

  // Mock data for demonstration
  const systemMetrics: SystemMetrics = {
    cpu: 45.2,
    memory: 68.1,
    storage: 34.7,
    uptime: '7d 14h 23m',
    activeUsers: 127,
    totalUsers: 1534,
    emailsProcessed: 8429,
    aiRequestsToday: 2156,
    systemHealth: 'healthy'
  };

  const teamMembers: TeamMember[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@company.com',
      role: 'admin',
      status: 'active',
      lastLogin: '2025-08-25T10:30:00Z',
      delegatedTasks: 23,
      completionRate: 94.2,
      permissions: ['admin:all', 'user:manage', 'system:config'],
      joinedAt: '2023-01-15T09:00:00Z'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      role: 'manager',
      status: 'active',
      lastLogin: '2025-08-25T09:15:00Z',
      delegatedTasks: 45,
      completionRate: 87.8,
      permissions: ['user:manage', 'team:view'],
      joinedAt: '2023-03-22T14:30:00Z'
    },
    {
      id: '3',
      name: 'Mike Chen',
      email: 'mike.chen@company.com',
      role: 'user',
      status: 'active',
      lastLogin: '2025-08-24T16:45:00Z',
      delegatedTasks: 12,
      completionRate: 91.7,
      permissions: ['user:basic'],
      joinedAt: '2024-01-10T11:00:00Z'
    }
  ];

  const securityEvents: SecurityEvent[] = [
    {
      id: '1',
      type: 'login_failed',
      userEmail: 'unknown@example.com',
      ip: '192.168.1.100',
      timestamp: '2025-08-25T10:45:00Z',
      details: 'Multiple failed login attempts',
      severity: 'high'
    },
    {
      id: '2',
      type: 'permission_denied',
      userId: '3',
      userEmail: 'mike.chen@company.com',
      ip: '10.0.1.45',
      timestamp: '2025-08-25T09:30:00Z',
      details: 'Attempted to access admin panel',
      severity: 'medium'
    },
    {
      id: '3',
      type: 'login_success',
      userId: '1',
      userEmail: 'john.doe@company.com',
      ip: '10.0.1.23',
      timestamp: '2025-08-25T08:00:00Z',
      details: 'Admin login from trusted location',
      severity: 'low'
    }
  ];

  const performanceData = [
    { time: '00:00', cpu: 23, memory: 45, requests: 120 },
    { time: '04:00', cpu: 18, memory: 42, requests: 95 },
    { time: '08:00', cpu: 67, memory: 78, requests: 450 },
    { time: '12:00', cpu: 89, memory: 82, requests: 678 },
    { time: '16:00', cpu: 45, memory: 71, requests: 523 },
    { time: '20:00', cpu: 34, memory: 65, requests: 289 }
  ];

  const usageAnalytics = [
    { name: 'Email Processing', value: 3842, color: '#3b82f6' },
    { name: 'AI Requests', value: 2156, color: '#10b981' },
    { name: 'Task Management', value: 1823, color: '#f59e0b' },
    { name: 'Analytics Views', value: 945, color: '#ef4444' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'inactive': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'suspended': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
      case 'manager': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'user': return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredSecurityEvents = securityEvents.filter(event => 
    securityFilter === 'all' || event.severity === securityFilter
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'team', name: 'Team Management', icon: UsersIcon },
    { id: 'system', name: 'System Health', icon: ServerIcon },
    { id: 'security', name: 'Security Audit', icon: ShieldCheckIcon },
    { id: 'analytics', name: 'Analytics', icon: ChartBarIcon },
    { id: 'config', name: 'Configuration', icon: CogIcon }
  ] as const;

  return (
    <div className={`admin-dashboard ${className} p-6 space-y-6`}>
      {/* Header */}
      <div className="admin-dashboard-header">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-purple-600 rounded-lg flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                System administration and team management
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">System Status</div>
              <div className={`text-xs flex items-center gap-1 ${
                systemMetrics.systemHealth === 'healthy' ? 'text-green-600' :
                systemMetrics.systemHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {systemMetrics.systemHealth === 'healthy' && <CheckCircleSolid className="w-3 h-3" />}
                {systemMetrics.systemHealth === 'warning' && <ExclamationTriangleSolid className="w-3 h-3" />}
                {systemMetrics.systemHealth === 'critical' && <XCircleSolid className="w-3 h-3" />}
                {systemMetrics.systemHealth.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="admin-overview space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="metric-card bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                  +12%
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{systemMetrics.activeUsers}</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
              <div className="text-xs text-muted-foreground mt-1">
                of {systemMetrics.totalUsers} total
              </div>
            </div>

            <div className="metric-card bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Icons.mail className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                  +8%
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{systemMetrics.emailsProcessed.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Emails Processed</div>
              <div className="text-xs text-muted-foreground mt-1">Today</div>
            </div>

            <div className="metric-card bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <CommandLineIcon className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-xs text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                  +23%
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{systemMetrics.aiRequestsToday.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">AI Requests</div>
              <div className="text-xs text-muted-foreground mt-1">Today</div>
            </div>

            <div className="metric-card bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <ClockIcon className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                  99.9%
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{systemMetrics.uptime}</div>
              <div className="text-sm text-muted-foreground">System Uptime</div>
              <div className="text-xs text-muted-foreground mt-1">Current period</div>
            </div>
          </div>

          {/* System Health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="system-health bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">System Resources</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">CPU Usage</span>
                    <span className="text-sm font-medium text-foreground">{systemMetrics.cpu}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${systemMetrics.cpu}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Memory Usage</span>
                    <span className="text-sm font-medium text-foreground">{systemMetrics.memory}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${systemMetrics.memory}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Storage Usage</span>
                    <span className="text-sm font-medium text-foreground">{systemMetrics.storage}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${systemMetrics.storage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="recent-activity bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Recent Security Events</h3>
              <div className="space-y-3">
                {securityEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/30">
                    <div className={`w-2 h-2 rounded-full ${
                      event.severity === 'critical' ? 'bg-red-600' :
                      event.severity === 'high' ? 'bg-orange-600' :
                      event.severity === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {event.details}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)} • {event.userEmail || event.ip}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Management Tab */}
      {activeTab === 'team' && (
        <div className="admin-team space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Team Management</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              <Icons.plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          <div className="team-grid space-y-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="team-member-card bg-card border border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold text-white">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{member.name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(member.role)}`}>
                          {member.role.toUpperCase()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(member.status)}`}>
                          {member.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                      onClick={() => setSelectedUser(selectedUser === member.id ? null : member.id)}
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    {userRole === 'admin' && (
                      <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                        <Icons.settings className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-foreground">{member.delegatedTasks}</div>
                    <div className="text-xs text-muted-foreground">Delegated Tasks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{member.completionRate}%</div>
                    <div className="text-xs text-muted-foreground">Completion Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-foreground">
                      {formatTimestamp(member.lastLogin)}
                    </div>
                    <div className="text-xs text-muted-foreground">Last Login</div>
                  </div>
                </div>

                {selectedUser === member.id && (
                  <div className="expanded-details border-t border-border pt-4 space-y-3">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">Permissions</div>
                      <div className="flex flex-wrap gap-1">
                        {member.permissions.map((permission, index) => (
                          <span 
                            key={index}
                            className="text-xs px-2 py-1 bg-secondary rounded-md text-muted-foreground"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Joined:</span>
                      <span className="text-foreground ml-2">{formatTimestamp(member.joinedAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Health Tab */}
      {activeTab === 'system' && (
        <div className="admin-system space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">System Health</h2>
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                className="text-sm bg-background border border-border rounded-md px-3 py-1"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="performance-chart bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Performance Metrics</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem'
                      }}
                    />
                    <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} name="Memory %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="request-chart bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Request Volume</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="requests" 
                      stroke="#f59e0b" 
                      fill="#f59e0b" 
                      fillOpacity={0.3}
                      name="Requests"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div className="database-status bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Database Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <CheckCircleSolid className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-sm font-medium text-foreground">Primary Database</div>
                <div className="text-xs text-green-600">Connected</div>
                <div className="text-xs text-muted-foreground mt-1">Response: 12ms</div>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <CheckCircleSolid className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-sm font-medium text-foreground">Supabase</div>
                <div className="text-xs text-green-600">Connected</div>
                <div className="text-xs text-muted-foreground mt-1">Response: 45ms</div>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <ServerIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-sm font-medium text-foreground">AI Services</div>
                <div className="text-xs text-blue-600">Operational</div>
                <div className="text-xs text-muted-foreground mt-1">Queue: 23 jobs</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Audit Tab */}
      {activeTab === 'security' && (
        <div className="admin-security space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Security Audit</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <select
                value={securityFilter}
                onChange={(e) => setSecurityFilter(e.target.value as typeof securityFilter)}
                className="text-sm bg-background border border-border rounded-md px-3 py-1"
              >
                <option value="all">All Events</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="security-events space-y-3">
            {filteredSecurityEvents.map((event) => (
              <div key={event.id} className="security-event bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      event.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                      event.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' :
                      event.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-green-100 dark:bg-green-900/30'
                    }`}>
                      {event.type === 'login_failed' && <XCircleSolid className="w-4 h-4 text-red-600" />}
                      {event.type === 'login_success' && <CheckCircleSolid className="w-4 h-4 text-green-600" />}
                      {event.type === 'permission_denied' && <ExclamationTriangleSolid className="w-4 h-4 text-orange-600" />}
                      {event.type === 'token_expired' && <ClockIcon className="w-4 h-4 text-yellow-600" />}
                      {event.type === 'suspicious_activity' && <ExclamationTriangleSolid className="w-4 h-4 text-red-600" />}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{event.details}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.userEmail && `User: ${event.userEmail} • `}
                        IP: {event.ip} • {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(event.severity)}`}>
                    {event.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="admin-analytics space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Usage Analytics</h2>
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                className="text-sm bg-background border border-border rounded-md px-3 py-1"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="usage-breakdown bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Usage Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={usageAnalytics}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                    >
                      {usageAnalytics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="feature-usage bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Feature Usage</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem'
                      }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Performance Insights */}
          <div className="performance-insights bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Performance Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="insight-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Icons.trendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="font-medium text-foreground">Response Times</div>
                </div>
                <div className="text-2xl font-bold text-green-600 mb-1">12ms</div>
                <div className="text-sm text-muted-foreground">Average API response</div>
                <div className="text-xs text-green-600 mt-1">↓ 15% from last week</div>
              </div>
              
              <div className="insight-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Icons.barChart className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="font-medium text-foreground">Throughput</div>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">1.2k</div>
                <div className="text-sm text-muted-foreground">Requests per minute</div>
                <div className="text-xs text-blue-600 mt-1">↑ 23% from last week</div>
              </div>
              
              <div className="insight-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Icons.cpu className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="font-medium text-foreground">Efficiency</div>
                </div>
                <div className="text-2xl font-bold text-purple-600 mb-1">94.8%</div>
                <div className="text-sm text-muted-foreground">System efficiency</div>
                <div className="text-xs text-purple-600 mt-1">↑ 2.1% from last week</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <div className="admin-config space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">System Configuration</h2>
            {userRole === 'admin' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Icons.settings className="w-4 h-4" />
                Add Setting
              </button>
            )}
          </div>

          <div className="config-sections space-y-6">
            {/* System Settings */}
            <div className="config-section bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">System Settings</h3>
              <div className="space-y-4">
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Max Concurrent Users</div>
                    <div className="text-sm text-muted-foreground">Maximum number of simultaneous users</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">1000</span>
                    {userRole === 'admin' && (
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Session Timeout</div>
                    <div className="text-sm text-muted-foreground">Automatic session expiry time</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">15 minutes</span>
                    {userRole === 'admin' && (
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Backup Frequency</div>
                    <div className="text-sm text-muted-foreground">Automated backup schedule</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">Daily at 2:00 AM</span>
                    {userRole === 'admin' && (
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="config-section bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Security Settings</h3>
              <div className="space-y-4">
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Two-Factor Authentication</div>
                    <div className="text-sm text-muted-foreground">Require 2FA for all admin accounts</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Login Attempt Limit</div>
                    <div className="text-sm text-muted-foreground">Max failed login attempts before lockout</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">5 attempts</span>
                    {userRole === 'admin' && (
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Password Policy</div>
                    <div className="text-sm text-muted-foreground">Minimum password requirements</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">Strong</span>
                    {userRole === 'admin' && (
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Settings */}
            <div className="config-section bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">AI Configuration</h3>
              <div className="space-y-4">
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">AI Request Rate Limit</div>
                    <div className="text-sm text-muted-foreground">Max AI requests per user per minute</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">10 requests</span>
                    {userRole === 'admin' && (
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Content Moderation</div>
                    <div className="text-sm text-muted-foreground">Enable AI content filtering</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="setting-item flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div>
                    <div className="font-medium text-foreground">Model Selection</div>
                    <div className="text-sm text-muted-foreground">Default AI model for processing</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">GPT-4</span>
                    {userRole === 'admin' && (
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Icons.edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;