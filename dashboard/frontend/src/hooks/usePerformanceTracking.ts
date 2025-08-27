import { useCallback, useRef } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
}

export const usePerformanceTracking = () => {
  const startTimeRef = useRef<number>(Date.now());
  
  const trackPageLoad = useCallback(() => {
    const loadTime = Date.now() - startTimeRef.current;
    
    // Simple performance tracking - much lighter than original 666-line system
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const metrics: PerformanceMetrics = {
        loadTime,
        renderTime: navigation.loadEventEnd - navigation.loadEventStart,
      };
      
      // Only log if performance is concerning
      if (loadTime > 2000) {
        console.warn('Slow page load detected:', metrics);
      }
      
      return metrics;
    }
    
    return { loadTime, renderTime: 0 };
  }, []);

  const trackComponentRender = useCallback((componentName: string) => {
    const renderStart = performance.now();
    
    return () => {
      const renderTime = performance.now() - renderStart;
      
      // Only track renders that take longer than 16ms (60fps threshold)
      if (renderTime > 16) {
        console.warn(`Slow render detected for ${componentName}:`, renderTime.toFixed(2), 'ms');
      }
    };
  }, []);

  const trackUserInteraction = useCallback((action: string) => {
    // Minimal interaction tracking - logging removed for production readiness
  }, []);

  const trackComponentMount = useCallback((componentName: string) => {
    const mountTime = Date.now() - startTimeRef.current;
    
    // Warn if mounting took too long
    if (mountTime > 1000) {
      console.warn(`Slow component mount: ${componentName} took ${mountTime}ms`);
    }
  }, []);

  const trackUserAction = useCallback((action: string, metadata?: Record<string, any>) => {
    // Enhanced user action tracking with metadata - logging removed for production readiness
  }, []);

  return {
    trackPageLoad,
    trackComponentRender,
    trackUserInteraction,
    trackComponentMount,
    trackUserAction,
  };
};
