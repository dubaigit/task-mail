/**
 * Standardized Error Handling System
 * Provides consistent error handling patterns across the application
 */

import { ERROR_MESSAGES, HTTP_STATUS } from './constants';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories
export type ErrorCategory = 
  | 'network'
  | 'validation' 
  | 'authentication'
  | 'authorization'
  | 'server'
  | 'client'
  | 'business'
  | 'unknown';

// Standard error interface
export interface StandardError {
  message: string;
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: string;
  context?: Record<string, any>;
  originalError?: Error;
  statusCode?: number;
  retryable?: boolean;
  userFriendly: boolean;
}

// Error context for logging and debugging
export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Standardized Error Handler Class
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Array<(error: StandardError) => void> = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Add error listener for global error handling
   */
  addErrorListener(listener: (error: StandardError) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * Handle and standardize errors
   */
  handleError(
    error: unknown, 
    context: ErrorContext = {},
    defaultMessage?: string
  ): StandardError {
    const standardError = this.normalizeError(error, context, defaultMessage);
    
    // Log error
    this.logError(standardError, context);
    
    // Notify listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(standardError);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });

    return standardError;
  }

  /**
   * Normalize various error types into StandardError
   */
  private normalizeError(
    error: unknown, 
    context: ErrorContext,
    defaultMessage?: string
  ): StandardError {
    const timestamp = new Date().toISOString();

    // Handle StandardError
    if (this.isStandardError(error)) {
      return { ...error, timestamp, context };
    }

    // Handle API Response errors
    if (this.isApiError(error)) {
      return this.handleApiError(error, context, timestamp);
    }

    // Handle JavaScript Error objects
    if (error instanceof Error) {
      return this.handleJavaScriptError(error, context, timestamp);
    }

    // Handle network errors
    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error, context, timestamp);
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        message: error || defaultMessage || ERROR_MESSAGES.GENERIC_ERROR,
        category: 'unknown',
        severity: 'medium',
        timestamp,
        context,
        userFriendly: true,
      };
    }

    // Handle unknown errors
    return {
      message: defaultMessage || ERROR_MESSAGES.GENERIC_ERROR,
      category: 'unknown',
      severity: 'medium',
      timestamp,
      context,
      originalError: error instanceof Error ? error : undefined,
      userFriendly: true,
    };
  }

  private isStandardError(error: unknown): error is StandardError {
    return typeof error === 'object' && 
           error !== null && 
           'message' in error && 
           'category' in error && 
           'severity' in error;
  }

  private isApiError(error: unknown): error is { error: string; status: number } {
    return typeof error === 'object' && 
           error !== null && 
           'error' in error && 
           'status' in error;
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof TypeError && 
           (error.message.includes('fetch') || error.message.includes('Network'));
  }

  private handleApiError(
    error: { error: string; status: number }, 
    context: ErrorContext,
    timestamp: string
  ): StandardError {
    const { category, severity, retryable } = this.categorizeHttpError(error.status);
    
    return {
      message: this.getHttpErrorMessage(error.status, error.error),
      code: `HTTP_${error.status}`,
      category,
      severity,
      timestamp,
      context,
      statusCode: error.status,
      retryable,
      userFriendly: true,
    };
  }

  private handleJavaScriptError(
    error: Error, 
    context: ErrorContext,
    timestamp: string
  ): StandardError {
    // Handle specific error types
    if (error.name === 'AbortError') {
      return {
        message: ERROR_MESSAGES.TIMEOUT_ERROR,
        code: 'TIMEOUT',
        category: 'network',
        severity: 'medium',
        timestamp,
        context,
        originalError: error,
        retryable: true,
        userFriendly: true,
      };
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        message: ERROR_MESSAGES.NETWORK_ERROR,
        code: 'NETWORK_ERROR',
        category: 'network',
        severity: 'high',
        timestamp,
        context,
        originalError: error,
        retryable: true,
        userFriendly: true,
      };
    }

    return {
      message: error.message || ERROR_MESSAGES.GENERIC_ERROR,
      code: error.name,
      category: 'client',
      severity: 'medium',
      timestamp,
      context,
      originalError: error,
      retryable: false,
      userFriendly: true,
    };
  }

  private handleNetworkError(
    error: unknown, 
    context: ErrorContext,
    timestamp: string
  ): StandardError {
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      code: 'NETWORK_ERROR',
      category: 'network',
      severity: 'high',
      timestamp,
      context,
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
      userFriendly: true,
    };
  }

  private categorizeHttpError(status: number): {
    category: ErrorCategory;
    severity: ErrorSeverity;
    retryable: boolean;
  } {
    if (status >= 400 && status < 500) {
      const category: ErrorCategory = 
        status === HTTP_STATUS.UNAUTHORIZED ? 'authentication' :
        status === HTTP_STATUS.FORBIDDEN ? 'authorization' :
        status === HTTP_STATUS.UNPROCESSABLE_ENTITY ? 'validation' :
        'client';
      
      return {
        category,
        severity: status === HTTP_STATUS.UNAUTHORIZED ? 'high' : 'medium',
        retryable: status === HTTP_STATUS.TOO_MANY_REQUESTS,
      };
    }

    if (status >= 500) {
      return {
        category: 'server',
        severity: 'high',
        retryable: true,
      };
    }

    return {
      category: 'unknown',
      severity: 'medium',
      retryable: false,
    };
  }

  private getHttpErrorMessage(status: number, fallback: string): string {
    switch (status) {
      case HTTP_STATUS.UNAUTHORIZED:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case HTTP_STATUS.FORBIDDEN:
        return ERROR_MESSAGES.FORBIDDEN;
      case HTTP_STATUS.NOT_FOUND:
        return ERROR_MESSAGES.NOT_FOUND;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        return ERROR_MESSAGES.RATE_LIMITED;
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        return ERROR_MESSAGES.VALIDATION_ERROR;
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
      case HTTP_STATUS.BAD_GATEWAY:
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
      case HTTP_STATUS.GATEWAY_TIMEOUT:
        return ERROR_MESSAGES.SERVER_ERROR;
      default:
        return fallback || ERROR_MESSAGES.GENERIC_ERROR;
    }
  }

  /**
   * Log errors with appropriate level
   */
  private logError(error: StandardError, context: ErrorContext): void {
    const logData = {
      ...error,
      context,
      stack: error.originalError?.stack,
    };

    switch (error.severity) {
      case 'critical':
        console.error('🚨 CRITICAL ERROR:', logData);
        break;
      case 'high':
        console.error('❌ HIGH SEVERITY ERROR:', logData);
        break;
      case 'medium':
        console.warn('⚠️ MEDIUM SEVERITY ERROR:', logData);
        break;
      case 'low':
        console.info('ℹ️ LOW SEVERITY ERROR:', logData);
        break;
    }
  }

  /**
   * Create user-friendly error message
   */
  getUserFriendlyMessage(error: StandardError): string {
    if (!error.userFriendly) {
      return ERROR_MESSAGES.GENERIC_ERROR;
    }
    return error.message;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: StandardError): boolean {
    return error.retryable === true;
  }

  /**
   * Get error for display in UI components
   */
  getDisplayError(error: StandardError): {
    message: string;
    severity: ErrorSeverity;
    retryable: boolean;
  } {
    return {
      message: this.getUserFriendlyMessage(error),
      severity: error.severity,
      retryable: this.isRetryable(error),
    };
  }
}

// Convenience functions for common use cases
export const errorHandler = ErrorHandler.getInstance();

/**
 * Handle async operation errors with standardized pattern
 */
export const handleAsyncError = (
  operation: string,
  component?: string
) => (error: unknown): StandardError => {
  return errorHandler.handleError(error, { operation, component });
};

/**
 * Create error handler for Zustand stores
 */
export const createStoreErrorHandler = (storeName: string) => {
  return (error: unknown, operation?: string): string => {
    const standardError = errorHandler.handleError(error, {
      component: storeName,
      operation,
    });
    return errorHandler.getUserFriendlyMessage(standardError);
  };
};

/**
 * Create error handler for React hooks
 */
export const createHookErrorHandler = (hookName: string) => {
  return (error: unknown, operation?: string): string => {
    const standardError = errorHandler.handleError(error, {
      component: `hook:${hookName}`,
      operation,
    });
    return errorHandler.getUserFriendlyMessage(standardError);
  };
};

/**
 * Error boundary helper
 */
export const handleComponentError = (error: Error, errorInfo: any, componentName: string): void => {
  errorHandler.handleError(error, {
    component: componentName,
    operation: 'render',
    metadata: errorInfo,
  });
};

export default ErrorHandler;