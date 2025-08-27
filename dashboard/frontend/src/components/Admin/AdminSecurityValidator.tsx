import React, { useState, useEffect, useCallback } from 'react';
import { Icons } from '../ui/icons';
import {
  ShieldCheck as ShieldCheckIcon,
  AlertTriangle as ExclamationTriangleIcon,
  Clock as ClockIcon,
  User as UserIcon,
  Monitor as ComputerDesktopIcon,
  Fingerprint as FingerPrintIcon
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  type: 'authentication' | 'authorization' | 'suspicious_activity' | 'policy_violation' | 'system_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  details?: Record<string, any>;
  resolved?: boolean;
  investigator?: string;
}

interface SecurityValidationResult {
  isValid: boolean;
  score: number; // 0-100
  risks: Array<{
    type: string;
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  compliance: {
    gdpr: boolean;
    hipaa: boolean;
    sox: boolean;
    iso27001: boolean;
  };
}

interface AdminSecurityValidatorProps {
  className?: string;
  onSecurityEvent?: (event: SecurityEvent) => void;
  onValidationComplete?: (result: SecurityValidationResult) => void;
}

export const AdminSecurityValidator: React.FC<AdminSecurityValidatorProps> = ({
  className = '',
  onSecurityEvent,
  onValidationComplete
}) => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<SecurityValidationResult | null>(null);
  const [realTimeMonitoring, setRealTimeMonitoring] = useState(true);

  // Mock security events for demonstration
  const generateMockSecurityEvent = useCallback((): SecurityEvent => {
    const types = ['authentication', 'authorization', 'suspicious_activity', 'policy_violation'] as const;
    const severities = ['low', 'medium', 'high', 'critical'] as const;
    const descriptions = {
      authentication: [
        'Failed login attempt detected',
        'Multiple login failures from same IP',
        'Login from unusual location',
        'Brute force attack detected'
      ],
      authorization: [
        'Unauthorized access attempt to admin panel',
        'Privilege escalation attempt detected',
        'Access to restricted resource blocked',
        'Invalid API token usage'
      ],
      suspicious_activity: [
        'Unusual data access pattern detected',
        'Suspicious file download activity',
        'Abnormal API request rate',
        'Potential data exfiltration attempt'
      ],
      policy_violation: [
        'Password policy violation',
        'Data retention policy breach',
        'Unauthorized data sharing detected',
        'Compliance policy violation'
      ]
    };

    const type = types[Math.floor(Math.random() * types.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    
    return {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      description: descriptions[type][Math.floor(Math.random() * descriptions[type].length)],
      userId: Math.random() > 0.3 ? `user_${Math.floor(Math.random() * 1000)}` : undefined,
      userEmail: Math.random() > 0.3 ? `user${Math.floor(Math.random() * 1000)}@company.com` : undefined,
      ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      timestamp: new Date().toISOString(),
      resolved: Math.random() > 0.7
    };
  }, []);

  // Comprehensive security validation
  const performSecurityValidation = useCallback(async () => {
    setIsValidating(true);
    
    try {
      // Simulate comprehensive security check
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const risks = [];
      let score = 100;
      
      // Simulate various security checks
      if (Math.random() > 0.8) {
        risks.push({
          type: 'weak_passwords',
          level: 'medium' as const,
          description: 'Some users have weak passwords that do not meet security standards',
          recommendation: 'Enforce stronger password policy and require password updates'
        });
        score -= 15;
      }
      
      if (Math.random() > 0.7) {
        risks.push({
          type: 'outdated_dependencies',
          level: 'high' as const,
          description: 'Several system dependencies have known security vulnerabilities',
          recommendation: 'Update all dependencies to latest secure versions immediately'
        });
        score -= 25;
      }
      
      if (Math.random() > 0.9) {
        risks.push({
          type: 'unencrypted_data',
          level: 'critical' as const,
          description: 'Some sensitive data is stored without proper encryption',
          recommendation: 'Implement end-to-end encryption for all sensitive data storage'
        });
        score -= 40;
      }
      
      if (Math.random() > 0.6) {
        risks.push({
          type: 'insufficient_logging',
          level: 'low' as const,
          description: 'Security event logging coverage could be improved',
          recommendation: 'Enhance logging mechanisms to capture more security events'
        });
        score -= 5;
      }
      
      const result: SecurityValidationResult = {
        isValid: score >= 70,
        score: Math.max(0, score),
        risks,
        compliance: {
          gdpr: score >= 80 && !risks.some(r => r.type === 'unencrypted_data'),
          hipaa: score >= 85 && !risks.some(r => r.level === 'critical'),
          sox: score >= 75 && risks.length < 3,
          iso27001: score >= 80 && !risks.some(r => r.level === 'critical')
        }
      };
      
      setValidationResult(result);
      onValidationComplete?.(result);
      
    } catch (error) {
    } finally {
      setIsValidating(false);
    }
  }, [onValidationComplete]);

  // Real-time security monitoring
  useEffect(() => {
    if (!realTimeMonitoring) return;
    
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const event = generateMockSecurityEvent();
        setSecurityEvents(prev => [event, ...prev.slice(0, 19)]); // Keep last 20 events
        onSecurityEvent?.(event);
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [realTimeMonitoring, generateMockSecurityEvent, onSecurityEvent]);

  const getSeverityColor = (severity: SecurityEvent['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'low': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const resolveSecurityEvent = (eventId: string) => {
    setSecurityEvents(prev => 
      prev.map(event => 
        event.id === eventId 
          ? { ...event, resolved: true, investigator: 'admin_user' }
          : event
      )
    );
  };

  return (
    <div className={`admin-security-validator ${className} space-y-6`}>
      {/* Security Validation Header */}
      <div className="flex items-center justify-between p-6 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Security Validation</h3>
            <p className="text-sm text-muted-foreground">Comprehensive security assessment and real-time monitoring</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="realtime-monitoring"
              checked={realTimeMonitoring}
              onChange={(e) => setRealTimeMonitoring(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="realtime-monitoring" className="text-sm text-muted-foreground">
              Real-time Monitoring
            </label>
          </div>
          
          <button
            onClick={performSecurityValidation}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isValidating ? (
              <ClockIcon className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheckIcon className="w-4 h-4" />
            )}
            {isValidating ? 'Validating...' : 'Run Security Audit'}
          </button>
        </div>
      </div>

      {/* Security Score & Compliance Dashboard */}
      {validationResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security Score */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">Security Score</h4>
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(validationResult.score)} mb-2`}>
                {validationResult.score}/100
              </div>
              <div className="w-full bg-secondary rounded-full h-3 mb-4">
                <div 
                  className={`h-3 rounded-full transition-all duration-1000 ${
                    validationResult.score >= 90 ? 'bg-green-600' :
                    validationResult.score >= 70 ? 'bg-yellow-600' :
                    validationResult.score >= 50 ? 'bg-orange-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${validationResult.score}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {validationResult.isValid ? 'Security requirements met' : 'Security improvements needed'}
              </p>
            </div>
          </div>

          {/* Compliance Status */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">Compliance Status</h4>
            <div className="space-y-3">
              {Object.entries(validationResult.compliance).map(([standard, compliant]) => (
                <div key={standard} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground uppercase">
                    {standard}
                  </span>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    compliant ? 'text-green-600 bg-green-100 dark:bg-green-900/30' :
                    'text-red-600 bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {compliant ? 'Compliant' : 'Non-Compliant'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Risks */}
      {validationResult && validationResult.risks.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h4 className="text-lg font-semibold text-foreground mb-4">Security Risks</h4>
          <div className="space-y-4">
            {validationResult.risks.map((risk, index) => (
              <div key={index} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className={`w-5 h-5 ${getRiskLevelColor(risk.level)}`} />
                    <span className={`text-sm px-2 py-1 rounded-full ${getSeverityColor(risk.level as any)}`}>
                      {risk.level.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {risk.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="mb-2">
                  <p className="text-sm font-medium text-foreground">{risk.description}</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    <strong>Recommendation:</strong> {risk.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Security Events */}
      {securityEvents.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-foreground">Real-time Security Events</h4>
            <span className="text-sm text-muted-foreground">Last 20 events</span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {securityEvents.map((event) => (
              <div 
                key={event.id} 
                className={`security-event p-4 border border-border rounded-lg ${event.resolved ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(event.severity)}`}>
                      {event.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      {event.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                <p className="text-sm font-medium text-foreground mb-2">{event.description}</p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    {event.userId && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {event.userEmail || event.userId}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ComputerDesktopIcon className="w-3 h-3" />
                      {event.ipAddress}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {event.resolved ? (
                      <span className="text-green-600 text-xs">Resolved</span>
                    ) : (
                      <button
                        onClick={() => resolveSecurityEvent(event.id)}
                        className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Events Placeholder */}
      {securityEvents.length === 0 && (
        <div className="text-center py-12">
          <ShieldCheckIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Security Events</h3>
          <p className="text-sm text-muted-foreground">
            {realTimeMonitoring ? 'System is secure. Monitoring for threats...' : 'Enable real-time monitoring to detect security events'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminSecurityValidator;
