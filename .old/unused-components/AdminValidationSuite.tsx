import React, { useState, useEffect } from 'react';
import { Icons } from '../ui/icons';
import {
  ShieldCheck as ShieldCheckIcon,
  Server as ServerIcon,
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon,
  BarChart3 as ChartBarIcon
} from 'lucide-react';
import { AdminSecurityValidator } from './AdminSecurityValidator';
import { AdminSystemHealthValidator } from './AdminSystemHealthValidator';
import { AdminRealTimeMonitor } from './AdminRealTimeMonitor';
import { AdminValidationProvider, useAdminValidation, useValidationStatus } from './AdminValidationProvider';

interface ValidationSummary {
  overallStatus: 'healthy' | 'warning' | 'critical';
  securityScore: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  activeAlerts: number;
  lastValidation: string;
  riskCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface AdminValidationSuiteProps {
  className?: string;
  showRealTimeMonitor?: boolean;
  autoValidate?: boolean;
}

const ValidationSuiteContent: React.FC<AdminValidationSuiteProps> = ({
  className = '',
  showRealTimeMonitor = true,
  autoValidate = true
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'health' | 'realtime'>('overview');
  const { state, actions } = useAdminValidation();
  const validationStatus = useValidationStatus();
  const [summary, setSummary] = useState<ValidationSummary>({
    overallStatus: 'healthy',
    securityScore: 0,
    systemHealth: 'healthy',
    activeAlerts: 0,
    lastValidation: '',
    riskCount: { critical: 0, high: 0, medium: 0, low: 0 }
  });

  // Update validation summary
  useEffect(() => {
    const riskCount = state.security.risks.reduce((acc, risk) => {
      acc[risk.level] = (acc[risk.level] || 0) + 1;
      return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0 } as any);

    setSummary({
      overallStatus: validationStatus.status,
      securityScore: validationStatus.securityScore,
      systemHealth: validationStatus.systemHealthStatus,
      activeAlerts: state.security.events.length + state.systemHealth.alerts.length,
      lastValidation: validationStatus.lastValidation || '',
      riskCount
    });
  }, [state, validationStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'warning': case 'degraded': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircleIcon className="w-5 h-5" />;
      case 'warning': case 'degraded': return <ExclamationTriangleIcon className="w-5 h-5" />;
      case 'critical': return <ExclamationTriangleIcon className="w-5 h-5" />;
      default: return <ServerIcon className="w-5 h-5" />;
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: ChartBarIcon },
    { id: 'security' as const, label: 'Security', icon: ShieldCheckIcon },
    { id: 'health' as const, label: 'System Health', icon: ServerIcon },
    ...(showRealTimeMonitor ? [{ id: 'realtime' as const, label: 'Real-time', icon: ClockIcon }] : [])
  ];

  return (
    <div className={`admin-validation-suite ${className} space-y-6`}>
      {/* Validation Suite Header */}
      <div className="flex items-center justify-between p-6 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            summary.overallStatus === 'healthy' ? 'bg-green-100 dark:bg-green-900/30' :
            summary.overallStatus === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
            'bg-red-100 dark:bg-red-900/30'
          }`}>
            {getStatusIcon(summary.overallStatus)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">System Validation Suite</h2>
            <p className="text-sm text-muted-foreground">
              Comprehensive security and system health validation
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${getStatusColor(summary.overallStatus)}`}>
            {getStatusIcon(summary.overallStatus)}
            <span className="font-medium capitalize">{summary.overallStatus}</span>
          </div>
          
          <button
            onClick={actions.runFullValidation}
            disabled={state.isValidating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {state.isValidating ? (
              <ClockIcon className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheckIcon className="w-4 h-4" />
            )}
            {state.isValidating ? 'Validating...' : 'Run Full Validation'}
          </button>
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Security Score</h3>
            <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{summary.securityScore}/100</div>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${
                summary.securityScore >= 90 ? 'bg-green-600' :
                summary.securityScore >= 70 ? 'bg-yellow-600' :
                summary.securityScore >= 50 ? 'bg-orange-600' : 'bg-red-600'
              }`}
              style={{ width: `${summary.securityScore}%` }}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">System Health</h3>
            <ServerIcon className="w-5 h-5 text-green-600" />
          </div>
          <div className={`text-2xl font-bold ${
            summary.systemHealth === 'healthy' ? 'text-green-600' :
            summary.systemHealth === 'degraded' ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {summary.systemHealth === 'healthy' ? 'Good' :
             summary.systemHealth === 'degraded' ? 'Fair' : 'Poor'}
          </div>
          <p className="text-xs text-muted-foreground mt-1 capitalize">
            Status: {summary.systemHealth}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Active Alerts</h3>
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-foreground">{summary.activeAlerts}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="text-red-600">{summary.riskCount.critical}C</span>
            <span className="text-orange-600">{summary.riskCount.high}H</span>
            <span className="text-yellow-600">{summary.riskCount.medium}M</span>
            <span className="text-blue-600">{summary.riskCount.low}L</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Last Validation</h3>
            <ClockIcon className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-sm font-medium text-foreground">
            {summary.lastValidation ? 
              new Date(summary.lastValidation).toLocaleDateString() : 'Never'
            }
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.lastValidation ? 
              new Date(summary.lastValidation).toLocaleTimeString() : 'Run validation'
            }
          </p>
        </div>
      </div>

      {/* Validation Tabs */}
      <div className="bg-card border border-border rounded-lg">
        {/* Tab Navigation */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary bg-primary/10 border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Security Risks</h3>
                  {state.security.risks.length > 0 ? (
                    <div className="space-y-3">
                      {state.security.risks.slice(0, 3).map((risk, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                          <div>
                            <div className="font-medium text-foreground text-sm">{risk.description}</div>
                            <div className="text-xs text-muted-foreground">{risk.recommendation}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            risk.level === 'critical' ? 'text-red-600 bg-red-100 dark:bg-red-900/30' :
                            risk.level === 'high' ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' :
                            risk.level === 'medium' ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' :
                            'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            {risk.level.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No security risks detected</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">System Alerts</h3>
                  {state.systemHealth.alerts.length > 0 ? (
                    <div className="space-y-3">
                      {state.systemHealth.alerts.slice(0, 3).map((alert, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                          <div>
                            <div className="font-medium text-foreground text-sm">{alert.title || 'System Alert'}</div>
                            <div className="text-xs text-muted-foreground">{alert.message || 'System notification'}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(alert.severity || 'info')}`}>
                            {(alert.severity || 'info').toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No system alerts</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <AdminSecurityValidator
              onSecurityEvent={(event) => {
                // Handle security events if needed
                console.log('Security event:', event);
              }}
              onValidationComplete={(result) => {
                // Handle validation completion
                console.log('Security validation complete:', result);
              }}
            />
          )}

          {activeTab === 'health' && (
            <AdminSystemHealthValidator
              onHealthStatusChange={(status) => {
                console.log('System health status changed:', status);
              }}
              onAlert={(alert) => {
                console.log('System alert:', alert);
              }}
            />
          )}

          {activeTab === 'realtime' && showRealTimeMonitor && (
            <AdminRealTimeMonitor
              wsEndpoint="ws://localhost:3001"
              updateInterval={2000}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminValidationSuite: React.FC<AdminValidationSuiteProps> = (props) => {
  return (
    <AdminValidationProvider autoValidate={props.autoValidate}>
      <ValidationSuiteContent {...props} />
    </AdminValidationProvider>
  );
};

export default AdminValidationSuite;