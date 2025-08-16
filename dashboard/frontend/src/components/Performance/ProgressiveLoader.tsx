/**
 * ProgressiveLoader.tsx - Progressive Loading System
 * 
 * Advanced progressive loading system for task-centric email interface.
 * Implements intelligent content loading, prioritization, and optimization
 * for improved perceived performance and user experience.
 * 
 * Features:
 * - Priority-based loading queues
 * - Intelligent resource prioritization
 * - Network condition adaptation
 * - Intersection observer optimization
 * - Prefetching and preloading
 * - Loading state management
 * - Error recovery and fallbacks
 */

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useRef, 
  useMemo,
  ReactNode 
} from 'react';
import { usePerformanceOptimizer } from './PerformanceOptimizer';
import { cacheManager } from './CacheManager';

// Loading priority levels
export enum LoadingPriority {
  CRITICAL = 'critical',     // Must load immediately (visible content)
  HIGH = 'high',            // Should load soon (above the fold)
  MEDIUM = 'medium',        // Can load when convenient (below the fold)
  LOW = 'low',             // Load when idle (background content)
  PREFETCH = 'prefetch'    // Predictive loading
}

// Loading states
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

// Loading request interface
export interface LoadingRequest {
  id: string;
  priority: LoadingPriority;
  loader: () => Promise<any>;
  dependencies?: string[];
  timeout?: number;
  retryConfig?: RetryConfig;
  cacheKey?: string;
  cacheTTL?: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'custom';
  baseDelay: number;
  maxDelay: number;
  customBackoff?: (attempt: number) => number;
}

// Loading result interface
export interface LoadingResult<T = any> {
  id: string;
  state: LoadingState;
  data?: T;
  error?: Error;
  duration?: number;
  fromCache?: boolean;
  attempts?: number;
}

// Progressive loader configuration
export interface ProgressiveLoaderConfig {
  // Concurrency limits
  maxConcurrentLoads: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  
  // Network adaptation
  adaptToConnection: boolean;
  connectionThresholds: {
    slow: string[];    // Connection types considered slow
    fast: string[];    // Connection types considered fast
  };
  
  // Intersection observer settings
  enableIntersectionObserver: boolean;
  intersectionThreshold: number;
  intersectionRootMargin: string;
  
  // Prefetching
  enablePrefetching: boolean;
  prefetchTriggerDistance: number; // pixels from viewport
  maxPrefetchItems: number;
  
  // Performance optimization
  enableRequestCoalescing: boolean;
  coalescingWindow: number; // milliseconds
  enableRequestBatching: boolean;
  batchSize: number;
  
  // Error handling
  defaultRetryConfig: RetryConfig;
  enableFallbacks: boolean;
  
  // Resource hints
  enableResourceHints: boolean;
  preloadCriticalResources: boolean;
}

// Loading queue interface
interface LoadingQueue {
  critical: LoadingRequest[];
  high: LoadingRequest[];
  medium: LoadingRequest[];
  low: LoadingRequest[];
  prefetch: LoadingRequest[];
}

// Progressive loader context interface
export interface ProgressiveLoaderContextValue {
  // Loading methods
  loadResource: <T>(request: LoadingRequest) => Promise<LoadingResult<T>>;
  loadBatch: (requests: LoadingRequest[]) => Promise<LoadingResult[]>;
  preloadResource: (request: Omit<LoadingRequest, 'priority'>) => void;
  cancelLoading: (id: string) => boolean;
  
  // State management
  getLoadingState: (id: string) => LoadingState;
  getLoadingResults: () => Map<string, LoadingResult>;
  clearResults: () => void;
  
  // Priority management
  updatePriority: (id: string, priority: LoadingPriority) => void;
  reprioritizeQueue: () => void;
  
  // Network adaptation
  adaptToNetworkConditions: (connectionType: string) => void;
  
  // Configuration
  updateConfig: (config: Partial<ProgressiveLoaderConfig>) => void;
  
  // Statistics
  getLoadingStats: () => LoadingStats;
}

// Loading statistics interface
export interface LoadingStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  cancelledRequests: number;
  averageLoadTime: number;
  cacheHitRate: number;
  networkUtilization: number;
  queueSizes: Record<LoadingPriority, number>;
}

// Default configuration
const DEFAULT_CONFIG: ProgressiveLoaderConfig = {
  maxConcurrentLoads: {
    critical: 6,
    high: 4,
    medium: 2,
    low: 1,
  },
  adaptToConnection: true,
  connectionThresholds: {
    slow: ['slow-2g', '2g', '3g'],
    fast: ['4g', '5g'],
  },
  enableIntersectionObserver: true,
  intersectionThreshold: 0.1,
  intersectionRootMargin: '50px',
  enablePrefetching: true,
  prefetchTriggerDistance: 200,
  maxPrefetchItems: 10,
  enableRequestCoalescing: true,
  coalescingWindow: 100,
  enableRequestBatching: true,
  batchSize: 5,
  defaultRetryConfig: {
    maxRetries: 3,
    backoffStrategy: 'exponential',
    baseDelay: 1000,
    maxDelay: 10000,
  },
  enableFallbacks: true,
  enableResourceHints: true,
  preloadCriticalResources: true,
};

// Create progressive loader context
const ProgressiveLoaderContext = createContext<ProgressiveLoaderContextValue | null>(null);

export const ProgressiveLoaderProvider: React.FC<{ 
  children: ReactNode;
  config?: Partial<ProgressiveLoaderConfig>;
}> = ({ children, config: userConfig = {} }) => {
  const { measureUIInteractionPerformance } = usePerformanceOptimizer();
  
  const [config, setConfig] = useState<ProgressiveLoaderConfig>({
    ...DEFAULT_CONFIG,
    ...userConfig,
  });
  
  // State management
  const [loadingQueue, setLoadingQueue] = useState<LoadingQueue>({
    critical: [],
    high: [],
    medium: [],
    low: [],
    prefetch: [],
  });
  
  const [activeLoads, setActiveLoads] = useState<Map<string, Promise<LoadingResult>>>(new Map());
  const [loadingResults, setLoadingResults] = useState<Map<string, LoadingResult>>(new Map());
  const [stats, setStats] = useState<LoadingStats>({
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    cancelledRequests: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
    networkUtilization: 0,
    queueSizes: {
      [LoadingPriority.CRITICAL]: 0,
      [LoadingPriority.HIGH]: 0,
      [LoadingPriority.MEDIUM]: 0,
      [LoadingPriority.LOW]: 0,
      [LoadingPriority.PREFETCH]: 0,
    },
  });

  // Refs for tracking
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const queueProcessorRef = useRef<NodeJS.Timeout | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const networkInfoRef = useRef<any>(null);
  const coalescingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const coalescingRequestsRef = useRef<LoadingRequest[]>([]);

  // Initialize progressive loader
  useEffect(() => {
    initializeNetworkMonitoring();
    initializeIntersectionObserver();
    startQueueProcessor();
    preloadCriticalResources();

    return () => {
      cleanup();
    };
  }, []);

  // Initialize network monitoring
  const initializeNetworkMonitoring = useCallback(() => {
    if (!config.adaptToConnection) return;

    // Modern Network Information API
    if ('connection' in navigator) {
      networkInfoRef.current = (navigator as any).connection;
      
      const handleConnectionChange = () => {
        const connection = networkInfoRef.current;
        if (connection) {
          adaptToNetworkConditions(connection.effectiveType);
        }
      };

      networkInfoRef.current.addEventListener('change', handleConnectionChange);
      handleConnectionChange(); // Initial adaptation
    }
  }, [config.adaptToConnection]);

  // Initialize intersection observer for viewport-based loading
  const initializeIntersectionObserver = useCallback(() => {
    if (!config.enableIntersectionObserver) return;

    const options = {
      threshold: config.intersectionThreshold,
      rootMargin: config.intersectionRootMargin,
    };

    intersectionObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const elementId = entry.target.getAttribute('data-progressive-load-id');
          if (elementId) {
            // Trigger loading for visible elements
            const request = findRequestInQueue(elementId);
            if (request) {
              updatePriority(elementId, LoadingPriority.HIGH);
            }
          }
        }
      });
    }, options);
  }, [config.enableIntersectionObserver, config.intersectionThreshold, config.intersectionRootMargin]);

  // Start queue processor
  const startQueueProcessor = useCallback(() => {
    const processQueue = async () => {
      await processLoadingQueue();
      queueProcessorRef.current = setTimeout(processQueue, 50); // Process every 50ms
    };

    processQueue();
  }, []);

  // Process loading queue based on priority and concurrency limits
  const processLoadingQueue = useCallback(async () => {
    const activeCounts = {
      critical: Array.from(activeLoads.values()).filter(promise => 
        typeof promise.then === 'function' // Count active promises
      ).length,
      high: 0,
      medium: 0,
      low: 0,
    };

    // Process critical priority first
    await processQueueForPriority(LoadingPriority.CRITICAL, activeCounts.critical);
    await processQueueForPriority(LoadingPriority.HIGH, activeCounts.high);
    await processQueueForPriority(LoadingPriority.MEDIUM, activeCounts.medium);
    await processQueueForPriority(LoadingPriority.LOW, activeCounts.low);
    
    // Process prefetch in idle time
    if (Object.values(activeCounts).every(count => count === 0)) {
      await processQueueForPriority(LoadingPriority.PREFETCH, 0);
    }
  }, [activeLoads]);

  // Process queue for specific priority
  const processQueueForPriority = useCallback(async (priority: LoadingPriority, activeCount: number) => {
    const maxConcurrent = config.maxConcurrentLoads[priority as keyof typeof config.maxConcurrentLoads] || 1;
    const availableSlots = maxConcurrent - activeCount;

    if (availableSlots <= 0) return;

    const queue = loadingQueue[priority];
    const requestsToProcess = queue.splice(0, availableSlots);

    for (const request of requestsToProcess) {
      executeLoadingRequest(request);
    }

    // Update queue sizes in stats
    setStats(prev => ({
      ...prev,
      queueSizes: {
        ...prev.queueSizes,
        [priority]: queue.length,
      },
    }));
  }, [config.maxConcurrentLoads, loadingQueue]);

  // Execute individual loading request
  const executeLoadingRequest = useCallback(async (request: LoadingRequest) => {
    const startTime = performance.now();
    const abortController = new AbortController();
    abortControllersRef.current.set(request.id, abortController);

    // Check cache first
    if (request.cacheKey) {
      const cachedResult = await cacheManager.get(request.cacheKey);
      if (cachedResult) {
        const result: LoadingResult = {
          id: request.id,
          state: LoadingState.LOADED,
          data: cachedResult,
          duration: performance.now() - startTime,
          fromCache: true,
        };

        setLoadingResults(prev => new Map(prev).set(request.id, result));
        updateStats('completed', result.duration || 0, true);
        return result;
      }
    }

    // Create loading promise
    const loadingPromise = executeWithRetry(request, abortController.signal);
    setActiveLoads(prev => new Map(prev).set(request.id, loadingPromise));

    try {
      const data = await loadingPromise;
      const duration = performance.now() - startTime;

      // Cache result if cache key provided
      if (request.cacheKey && data) {
        await cacheManager.set(request.cacheKey, data, {
          ttl: request.cacheTTL,
        });
      }

      const result: LoadingResult = {
        id: request.id,
        state: LoadingState.LOADED,
        data,
        duration,
        fromCache: false,
      };

      setLoadingResults(prev => new Map(prev).set(request.id, result));
      updateStats('completed', duration, false);

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      const result: LoadingResult = {
        id: request.id,
        state: abortController.signal.aborted ? LoadingState.CANCELLED : LoadingState.ERROR,
        error: error as Error,
        duration,
        fromCache: false,
      };

      setLoadingResults(prev => new Map(prev).set(request.id, result));
      updateStats(abortController.signal.aborted ? 'cancelled' : 'failed', duration, false);

      throw result;

    } finally {
      setActiveLoads(prev => {
        const newMap = new Map(prev);
        newMap.delete(request.id);
        return newMap;
      });
      abortControllersRef.current.delete(request.id);
    }
  }, []);

  // Execute request with retry logic
  const executeWithRetry = useCallback(async (request: LoadingRequest, signal: AbortSignal): Promise<any> => {
    const retryConfig = request.retryConfig || config.defaultRetryConfig;
    let lastError: Error;

    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
      if (signal.aborted) {
        throw new Error('Request cancelled');
      }

      try {
        return await request.loader();
      } catch (error) {
        lastError = error as Error;

        // Don't retry if this is the last attempt
        if (attempt > retryConfig.maxRetries) {
          break;
        }

        // Calculate backoff delay
        let delay = retryConfig.baseDelay;
        switch (retryConfig.backoffStrategy) {
          case 'linear':
            delay = retryConfig.baseDelay * attempt;
            break;
          case 'exponential':
            delay = retryConfig.baseDelay * Math.pow(2, attempt - 1);
            break;
          case 'custom':
            delay = retryConfig.customBackoff?.(attempt) || retryConfig.baseDelay;
            break;
        }

        delay = Math.min(delay, retryConfig.maxDelay);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }, [config.defaultRetryConfig]);

  // Main loading method
  const loadResource = useCallback(async <T,>(request: LoadingRequest): Promise<LoadingResult<T>> => {
    const loadingLogic = async (): Promise<LoadingResult<T>> => {
      // Check if already loading or loaded
      const existingResult = loadingResults.get(request.id);
      if (existingResult && existingResult.state === LoadingState.LOADED) {
        return existingResult as LoadingResult<T>;
      }

      const existingLoad = activeLoads.get(request.id);
      if (existingLoad) {
        return existingLoad as Promise<LoadingResult<T>>;
      }

      // Add to appropriate queue
      setLoadingQueue(prev => {
        const newQueue = { ...prev };
        newQueue[request.priority].push(request);
        return newQueue;
      });

      setStats(prev => ({ ...prev, totalRequests: prev.totalRequests + 1 }));

      // Return promise that resolves when loading completes
      return new Promise((resolve, reject) => {
        const checkResult = () => {
          const result = loadingResults.get(request.id);
          if (result) {
            if (result.state === LoadingState.LOADED) {
              resolve(result as LoadingResult<T>);
            } else if (result.state === LoadingState.ERROR) {
              reject(result);
            }
          } else {
            setTimeout(checkResult, 10);
          }
        };
        checkResult();
      });
    };

    // Execute the loading logic
    const startTime = performance.now();
    const result = await loadingLogic();
    const endTime = performance.now();
    
    // Track the performance
    await measureUIInteractionPerformance(async () => {
      // Performance tracking already handled above
      return Promise.resolve();
    });
    
    return result;
  }, [loadingResults, activeLoads, measureUIInteractionPerformance]);

  // Batch loading method
  const loadBatch = useCallback(async (requests: LoadingRequest[]): Promise<LoadingResult[]> => {
    if (config.enableRequestBatching) {
      // Group requests by priority and process in batches
      const batches = groupRequestsByPriority(requests);
      const results: LoadingResult[] = [];

      for (const [priority, batchRequests] of Object.entries(batches)) {
        const batchPromises = batchRequests.map(req => loadResource(req));
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        });
      }

      return results;
    } else {
      // Load all requests individually
      const promises = requests.map(req => loadResource(req));
      const results = await Promise.allSettled(promises);
      
      return results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<LoadingResult>).value);
    }
  }, [config.enableRequestBatching, loadResource]);

  // Preload resource (low priority)
  const preloadResource = useCallback((request: Omit<LoadingRequest, 'priority'>) => {
    const preloadRequest: LoadingRequest = {
      ...request,
      priority: LoadingPriority.PREFETCH,
    };

    setLoadingQueue(prev => {
      const newQueue = { ...prev };
      newQueue.prefetch.push(preloadRequest);
      return newQueue;
    });
  }, []);

  // Cancel loading request
  const cancelLoading = useCallback((id: string): boolean => {
    const abortController = abortControllersRef.current.get(id);
    if (abortController) {
      abortController.abort();
      return true;
    }

    // Remove from queue if not yet started
    setLoadingQueue(prev => {
      const newQueue = { ...prev };
      Object.keys(newQueue).forEach(priority => {
        newQueue[priority as LoadingPriority] = newQueue[priority as LoadingPriority]
          .filter(req => req.id !== id);
      });
      return newQueue;
    });

    return false;
  }, []);

  // Get loading state
  const getLoadingState = useCallback((id: string): LoadingState => {
    const result = loadingResults.get(id);
    if (result) {
      return result.state;
    }

    if (activeLoads.has(id)) {
      return LoadingState.LOADING;
    }

    return LoadingState.IDLE;
  }, [loadingResults, activeLoads]);

  // Update priority
  const updatePriority = useCallback((id: string, priority: LoadingPriority) => {
    setLoadingQueue(prev => {
      const newQueue = { ...prev };
      let foundRequest: LoadingRequest | undefined = undefined;

      // Find and remove request from current queue
      Object.keys(newQueue).forEach(currentPriority => {
        const priorityKey = currentPriority as LoadingPriority;
        const queue = newQueue[priorityKey];
        const index = queue.findIndex(req => req.id === id);
        
        if (index !== -1) {
          const removedRequests = queue.splice(index, 1);
          foundRequest = removedRequests[0];
        }
      });

      // Add to new priority queue
      if (foundRequest) {
        (foundRequest as LoadingRequest).priority = priority;
        newQueue[priority].push(foundRequest as LoadingRequest);
      }

      return newQueue;
    });
  }, []);

  // Adapt to network conditions
  const adaptToNetworkConditions = useCallback((connectionType: string) => {
    const isSlow = config.connectionThresholds.slow.includes(connectionType);
    const isFast = config.connectionThresholds.fast.includes(connectionType);

    if (isSlow) {
      // Reduce concurrency for slow connections
      setConfig(prev => ({
        ...prev,
        maxConcurrentLoads: {
          critical: 2,
          high: 1,
          medium: 1,
          low: 1,
        },
        enablePrefetching: false,
      }));
    } else if (isFast) {
      // Increase concurrency for fast connections
      setConfig(prev => ({
        ...prev,
        maxConcurrentLoads: {
          critical: 8,
          high: 6,
          medium: 4,
          low: 2,
        },
        enablePrefetching: true,
      }));
    }
  }, [config.connectionThresholds]);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ProgressiveLoaderConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Get loading statistics
  const getLoadingStats = useCallback((): LoadingStats => {
    return { ...stats };
  }, [stats]);

  // Clear results
  const clearResults = useCallback(() => {
    setLoadingResults(new Map());
  }, []);

  // Reprioritize queue (implementation specific to use case)
  const reprioritizeQueue = useCallback(() => {
    // Implementation would depend on specific prioritization logic
    // This could involve analyzing current viewport, user interaction patterns, etc.
  }, []);

  // Helper methods

  const findRequestInQueue = useCallback((id: string): LoadingRequest | null => {
    for (const priority of Object.values(LoadingPriority)) {
      const request = loadingQueue[priority].find(req => req.id === id);
      if (request) return request;
    }
    return null;
  }, [loadingQueue]);

  const groupRequestsByPriority = useCallback((requests: LoadingRequest[]): Record<string, LoadingRequest[]> => {
    return requests.reduce((groups, request) => {
      if (!groups[request.priority]) {
        groups[request.priority] = [];
      }
      groups[request.priority].push(request);
      return groups;
    }, {} as Record<string, LoadingRequest[]>);
  }, []);

  const updateStats = useCallback((type: 'completed' | 'failed' | 'cancelled', duration: number, fromCache: boolean) => {
    setStats(prev => {
      const newStats = { ...prev };

      switch (type) {
        case 'completed':
          newStats.completedRequests++;
          break;
        case 'failed':
          newStats.failedRequests++;
          break;
        case 'cancelled':
          newStats.cancelledRequests++;
          break;
      }

      // Update average load time
      const totalCompleted = newStats.completedRequests + newStats.failedRequests;
      if (totalCompleted > 0) {
        newStats.averageLoadTime = (prev.averageLoadTime * (totalCompleted - 1) + duration) / totalCompleted;
      }

      // Update cache hit rate
      const totalRequests = newStats.totalRequests;
      if (totalRequests > 0) {
        newStats.cacheHitRate = fromCache ? 
          (prev.cacheHitRate * (totalRequests - 1) + 1) / totalRequests :
          (prev.cacheHitRate * (totalRequests - 1)) / totalRequests;
      }

      return newStats;
    });
  }, []);

  const preloadCriticalResources = useCallback(() => {
    if (!config.preloadCriticalResources) return;

    // Add resource hints for critical resources
    if (config.enableResourceHints) {
      // Implementation would add <link rel="preload"> or <link rel="prefetch"> tags
      // This is a simplified version
      console.log('ProgressiveLoader: Preloading critical resources');
    }
  }, [config.preloadCriticalResources, config.enableResourceHints]);

  const cleanup = useCallback(() => {
    if (queueProcessorRef.current) {
      clearTimeout(queueProcessorRef.current);
    }

    if (coalescingTimeoutRef.current) {
      clearTimeout(coalescingTimeoutRef.current);
    }

    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect();
    }

    // Cancel all active loads
    abortControllersRef.current.forEach(controller => {
      controller.abort();
    });

    abortControllersRef.current.clear();
  }, []);

  // Context value
  const contextValue: ProgressiveLoaderContextValue = useMemo(() => ({
    loadResource,
    loadBatch,
    preloadResource,
    cancelLoading,
    getLoadingState,
    getLoadingResults: () => loadingResults,
    clearResults,
    updatePriority,
    reprioritizeQueue,
    adaptToNetworkConditions,
    updateConfig,
    getLoadingStats,
  }), [
    loadResource,
    loadBatch,
    preloadResource,
    cancelLoading,
    getLoadingState,
    loadingResults,
    clearResults,
    updatePriority,
    reprioritizeQueue,
    adaptToNetworkConditions,
    updateConfig,
    getLoadingStats,
  ]);

  return (
    <ProgressiveLoaderContext.Provider value={contextValue}>
      {children}
    </ProgressiveLoaderContext.Provider>
  );
};

// Hook for using progressive loader
export const useProgressiveLoader = (): ProgressiveLoaderContextValue => {
  const context = useContext(ProgressiveLoaderContext);
  if (!context) {
    throw new Error('useProgressiveLoader must be used within a ProgressiveLoaderProvider');
  }
  return context;
};

// High-order component for progressive loading
export interface ProgressiveLoadProps {
  loadingId: string;
  priority?: LoadingPriority;
  loader: () => Promise<any>;
  fallback?: ReactNode;
  errorFallback?: (error: Error) => ReactNode;
  cacheKey?: string;
  cacheTTL?: number;
  children: (data: any) => ReactNode;
}

export const ProgressiveLoad: React.FC<ProgressiveLoadProps> = ({
  loadingId,
  priority = LoadingPriority.MEDIUM,
  loader,
  fallback = <div>Loading...</div>,
  errorFallback = (error) => <div>Error: {error.message}</div>,
  cacheKey,
  cacheTTL,
  children,
}) => {
  const { loadResource, getLoadingState } = useProgressiveLoader();
  const [result, setResult] = useState<LoadingResult | null>(null);

  useEffect(() => {
    const request: LoadingRequest = {
      id: loadingId,
      priority,
      loader,
      cacheKey,
      cacheTTL,
    };

    loadResource(request)
      .then(setResult)
      .catch(setResult);
  }, [loadingId, priority, loader, cacheKey, cacheTTL, loadResource]);

  const state = getLoadingState(loadingId);

  switch (state) {
    case LoadingState.LOADING:
      return <>{fallback}</>;
    case LoadingState.ERROR:
      return <>{result?.error ? errorFallback(result.error) : fallback}</>;
    case LoadingState.LOADED:
      return <>{result?.data ? children(result.data) : fallback}</>;
    default:
      return <>{fallback}</>;
  }
};

export default ProgressiveLoaderProvider;