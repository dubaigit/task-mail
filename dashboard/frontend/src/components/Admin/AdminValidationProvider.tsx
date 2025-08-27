import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AdminSecurityValidator } from './AdminSecurityValidator';
import { AdminSystemHealthValidator } from './AdminSystemHealthValidator';
import { AdminDashboardErrorBoundary } from './AdminDashboardErrorBoundary';

interface ValidationState {
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

interface ValidationActions {
  runSecurityValidation: () => Promise<void>;
  runSystemHealthCheck: () => Promise<void>;
  runFullValidation: () => Promise<void>;
  clearAlerts: () => void;
  acknowledgeRisk: (riskId: string) => void;
}

const ValidationContext = createContext<{
  state: ValidationState;
  actions: ValidationActions;
} | null>(null);

interface AdminValidationProviderProps {
  children: ReactNode;
  autoValidate?: boolean;
  validationInterval?: number;
}

export const AdminValidationProvider: React.FC<AdminValidationProviderProps> = ({
  children,
  autoValidate = true,
  validationInterval = 300000 // 5 minutes
}) => {
  const [state, setState] = useState<ValidationState>({
    security: {
      isValid: false,
      score: 0,
      risks: [],
      events: []
    },
    systemHealth: {
      status: 'healthy',
      metrics: null,
      alerts: []
    },
    isValidating: false,
    lastValidation: null
  });

  const runSecurityValidation = async (): Promise<void> => {
    setState(prev => ({ ...prev, isValidating: true }));
    
    try {
      // Simulate comprehensive security validation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult = {
        isValid: Math.random() > 0.3,
        score: 60 + Math.random() * 40,
        risks: [
          {
            type: 'authentication',
            level: 'medium' as const,
            description: 'Some user accounts use weak passwords',
            recommendation: 'Implement stronger password policy'
          }
        ],
        events: []
      };
      
      setState(prev => ({
        ...prev,
        security: mockResult,
        lastValidation: new Date().toISOString()
      }));
      
    } catch (error) {
    } finally {
      setState(prev => ({ ...prev, isValidating: false }));
    }
  };

  const runSystemHealthCheck = async (): Promise<void> => {
    setState(prev => ({ ...prev, isValidating: true }));
    
    try {
      // Simulate system health check
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const statuses = ['healthy', 'degraded', 'critical'] as const;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      setState(prev => ({
        ...prev,
        systemHealth: {
          ...prev.systemHealth,
          status
        },
        lastValidation: new Date().toISOString()
      }));
      
    } catch (error) {
    } finally {
      setState(prev => ({ ...prev, isValidating: false }));
    }
  };

  const runFullValidation = async (): Promise<void> => {
    setState(prev => ({ ...prev, isValidating: true }));
    
    try {
      await Promise.all([
        runSecurityValidation(),
        runSystemHealthCheck()
      ]);
    } catch (error) {
    } finally {
      setState(prev => ({ ...prev, isValidating: false }));
    }
  };

  const clearAlerts = (): void => {
    setState(prev => ({
      ...prev,
      security: {
        ...prev.security,
        events: []
      },
      systemHealth: {
        ...prev.systemHealth,
        alerts: []
      }
    }));
  };

  const acknowledgeRisk = (riskId: string): void => {
    setState(prev => ({
      ...prev,
      security: {
        ...prev.security,
        risks: prev.security.risks.filter(risk => risk.type !== riskId)
      }
    }));
  };

  const actions: ValidationActions = {
    runSecurityValidation,
    runSystemHealthCheck,
    runFullValidation,
    clearAlerts,
    acknowledgeRisk
  };

  // Auto-validation
  useEffect(() => {
    if (!autoValidate) return;
    
    // Run initial validation
    runFullValidation();
    
    // Set up periodic validation
    const interval = setInterval(runFullValidation, validationInterval);
    
    return () => clearInterval(interval);
  }, [autoValidate, validationInterval]);

  return (
    <ValidationContext.Provider value={{ state, actions }}>
      <AdminDashboardErrorBoundary>
        {children}
      </AdminDashboardErrorBoundary>
    </ValidationContext.Provider>
  );
};

export const useAdminValidation = () => {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useAdminValidation must be used within AdminValidationProvider');
  }
  return context;
};

// HOC for components that need validation
export function withValidation<T extends object>(Component: React.ComponentType<T>) {
  return function ValidatedComponent(props: T) {
    const validation = useAdminValidation();
    
    return (
      <AdminDashboardErrorBoundary>
        <Component {...props} validation={validation} />
      </AdminDashboardErrorBoundary>
    );
  };
}

// Validation status hook
export const useValidationStatus = () => {
  const { state } = useAdminValidation();
  
  const overallStatus = (): 'healthy' | 'warning' | 'critical' => {
    if (!state.security.isValid || state.systemHealth.status === 'critical') {
      return 'critical';
    }
    if (state.security.score < 80 || state.systemHealth.status === 'degraded') {
      return 'warning';
    }
    return 'healthy';
  };
  
  return {
    status: overallStatus(),
    securityScore: state.security.score,
    systemHealthStatus: state.systemHealth.status,
    isValidating: state.isValidating,
    lastValidation: state.lastValidation
  };
};

export default AdminValidationProvider;
