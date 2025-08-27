// Admin Dashboard Components
export { default as AdminDashboard } from './AdminDashboard';

// Error Boundaries
export { default as AdminDashboardErrorBoundary } from './AdminDashboardErrorBoundary';

// Real-time Monitoring
export { default as AdminRealTimeMonitor } from './AdminRealTimeMonitor';

// Security Validation
export { default as AdminSecurityValidator } from './AdminSecurityValidator';

// System Health Validation
export { default as AdminSystemHealthValidator } from './AdminSystemHealthValidator';

// Validation Provider & Context
export {
  default as AdminValidationProvider,
  useAdminValidation,
  useValidationStatus,
  withValidation
} from './AdminValidationProvider';

// Complete Validation Suite
export { default as AdminValidationSuite } from './AdminValidationSuite';

// Type definitions for external use
export interface AdminValidationState {
  security: {
    isValid: boolean;
    score: number;
    risks: Array<{
      type: string;
      level: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
    }>;
    events: Array<any>;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    metrics: any;
    alerts: Array<any>;
  };
  isValidating: boolean;
  lastValidation: string | null;
}

export interface SecurityEvent {
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

export interface SystemAlert {
  id: string;
  type: 'performance' | 'resource' | 'service' | 'security' | 'maintenance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged?: boolean;
  resolvedAt?: string;
}