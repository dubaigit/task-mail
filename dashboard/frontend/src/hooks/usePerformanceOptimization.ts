import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce, throttle } from 'lodash';

// Performance optimization hook
export const usePerformanceOptimization = () => {
  const [isOptimized, setIsOptimized] = useState(false);

  // Debounced search
  const useDebouncedSearch = (callback: (query: string) => void, delay: number = 300) => {
    return useCallback(debounce(callback, delay), [callback]);
  };

  // Throttled scroll handler
  const useThrottledScroll = (callback: () => void, delay: number = 100) => {
    return useCallback(throttle(callback, delay), [callback]);
  };

  // Intersection Observer for lazy loading
  const useIntersectionObserver = (options?: IntersectionObserverInit) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => setIsIntersecting(entry.isIntersecting),
        { threshold: 0.1, ...options }
      );

      if (ref.current) {
        observer.observe(ref.current);
      }

      return () => observer.disconnect();
    }, [options]);

    return { ref, isIntersecting };
  };

  // Virtual scrolling hook
  const useVirtualScrolling = <T>(items: T[], itemHeight: number, containerHeight: number) => {
    const [scrollTop, setScrollTop] = useState(0);
    
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    const visibleItems = useMemo(
      () => items.slice(visibleStart, visibleEnd),
      [items, visibleStart, visibleEnd]
    );

    const totalHeight = items.length * itemHeight;
    const offsetY = visibleStart * itemHeight;

    return {
      visibleItems,
      totalHeight,
      offsetY,
      onScroll: (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
      }
    };
  };

  // Memory usage monitoring
  const useMemoryMonitoring = () => {
    const [memoryUsage, setMemoryUsage] = useState<number>(0);

    useEffect(() => {
      const updateMemoryUsage = () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          setMemoryUsage(memory.usedJSHeapSize / memory.jsHeapSizeLimit);
        }
      };

      const interval = setInterval(updateMemoryUsage, 5000);
      return () => clearInterval(interval);
    }, []);

    return memoryUsage;
  };

  // Bundle size tracking
  const trackBundleSize = useCallback(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    let totalSize = 0;

    scripts.forEach(async (script) => {
      try {
        const response = await fetch((script as HTMLScriptElement).src, { method: 'HEAD' });
        const size = response.headers.get('content-length');
        if (size) {
          totalSize += parseInt(size, 10);
        }
      } catch (error) {
        console.warn('Could not fetch script size:', error);
      }
    });

    return totalSize;
  }, []);

  return {
    useDebouncedSearch,
    useThrottledScroll,
    useIntersectionObserver,
    useVirtualScrolling,
    useMemoryMonitoring,
    trackBundleSize,
    isOptimized
  };
};

// Component-level optimization utilities
export const optimizeComponent = {
  // Memoization helper
  memo: <T extends React.ComponentType<any>>(Component: T, compareProps?: (prev: any, next: any) => boolean) => {
    return React.memo(Component, compareProps);
  },

  // Callback optimization
  useStableCallback: <T extends (...args: any[]) => any>(callback: T, deps: React.DependencyList): T => {
    return useCallback(callback, deps);
  },

  // Stable reference for objects
  useStableValue: <T>(value: T, compareFn?: (prev: T, next: T) => boolean): T => {
    const ref = useRef<T>(value);
    
    if (!compareFn) {
      if (JSON.stringify(ref.current) !== JSON.stringify(value)) {
        ref.current = value;
      }
    } else {
      if (!compareFn(ref.current, value)) {
        ref.current = value;
      }
    }
    
    return ref.current;
  }
};

// Performance measurement utilities
export const performanceMeasurement = {
  // Measure component render time
  measureRenderTime: (componentName: string) => {
    return {
      start: () => performance.mark(`${componentName}-render-start`),
      end: () => {
        performance.mark(`${componentName}-render-end`);
        performance.measure(
          `${componentName}-render-time`,
          `${componentName}-render-start`,
          `${componentName}-render-end`
        );
        
        const measure = performance.getEntriesByName(`${componentName}-render-time`)[0];
        return measure?.duration || 0;
      }
    };
  },

  // Track First Contentful Paint
  trackFCP: (callback: (fcp: number) => void) => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntriesByType('paint');
      const fcp = entries.find((entry) => entry.name === 'first-contentful-paint');
      if (fcp) {
        callback(fcp.startTime);
        observer.disconnect();
      }
    });
    observer.observe({ type: 'paint', buffered: true });
  },

  // Track Largest Contentful Paint
  trackLCP: (callback: (lcp: number) => void) => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      callback(lastEntry.startTime);
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  },

  // Track Cumulative Layout Shift
  trackCLS: (callback: (cls: number) => void) => {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      callback(clsValue);
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  }
};

export default usePerformanceOptimization;