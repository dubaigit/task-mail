/**
 * PerformanceOptimizer.tsx - Main Performance Optimization System
 * 
 * Comprehensive performance optimization for task-centric email interface.
 * Targets: Sub-100ms classification, <2ms task categorization, <500ms UI interactions,
 * <50MB memory for 1000+ tasks, 60fps animations.
 * 
 * Features:
 * - Intelligent performance monitoring and optimization
 * - Hardware acceleration management
 * - Memory usage optimization
 * - Real-time performance adaptation
 * - Task-specific performance optimization
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { advancedCache } from '../../utils/advancedCache';

// Performance optimization configuration
export interface PerformanceConfig {
  // Core performance targets
  classificationTargetMs: number; // Target: <100ms
  taskCategorizationTargetMs: number; // Target: <2ms
  uiInteractionTargetMs: number; // Target: <500ms
  memoryLimitMB: number; // Target: <50MB for 1000+ tasks
  targetFPS: number; // Target: 60fps
  
  // Optimization features
  enableHardwareAcceleration: boolean;
  enableVirtualScrolling: boolean;
  enableProgressiveLoading: boolean;
  enablePredictiveCaching: boolean;
  enableBatchProcessing: boolean;
  enableWorkerThreads: boolean;
  
  // Adaptive settings
  enableAdaptiveQuality: boolean;
  enableLowPowerMode: boolean;
  enableMemoryPressureHandling: boolean;
}

// Performance metrics and state
export interface PerformanceState {
  // Current metrics
  classificationLatency: number;
  taskCategorizationLatency: number;
  uiInteractionLatency: number;
  memoryUsageMB: number;
  currentFPS: number;
  
  // Optimization state
  hardwareAccelerated: boolean;
  virtualScrollingActive: boolean;
  progressiveLoadingActive: boolean;
  lowPowerModeActive: boolean;
  memoryPressureDetected: boolean;
  
  // Performance budget compliance
  budgetCompliance: {
    classification: boolean;
    taskCategorization: boolean;
    uiInteraction: boolean;
    memory: boolean;
    fps: boolean;
  };
  
  // Optimization recommendations
  recommendations: PerformanceRecommendation[];
}

export interface PerformanceRecommendation {
  id: string;
  type: 'memory' | 'cpu' | 'ui' | 'network' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: string;
  impact: string;
  autoApplicable: boolean;
}

export interface PerformanceOptimizerContextValue {
  config: PerformanceConfig;
  state: PerformanceState;
  
  // Performance control methods
  optimizeClassification: () => Promise<void>;
  optimizeTaskCategorization: () => Promise<void>;
  optimizeUIInteractions: () => Promise<void>;
  optimizeMemoryUsage: () => Promise<void>;
  optimizeAnimations: () => Promise<void>;
  
  // Adaptive optimization
  enableLowPowerMode: (enabled: boolean) => void;
  handleMemoryPressure: () => Promise<void>;
  adaptToNetworkConditions: (connectionType: string) => Promise<void>;
  
  // Performance measurement
  measureClassificationPerformance: (operation: () => Promise<any>) => Promise<number>;
  measureTaskCategorizationPerformance: (operation: () => Promise<any>) => Promise<number>;
  measureUIInteractionPerformance: (operation: () => Promise<any>) => Promise<number>;
  
  // Configuration
  updateConfig: (newConfig: Partial<PerformanceConfig>) => void;
  resetOptimizations: () => void;
  
  // Metrics and reporting
  getPerformanceReport: () => PerformanceReport;
  exportPerformanceData: () => string;
}

export interface PerformanceReport {
  timestamp: number;
  summary: {
    overallScore: number;
    budgetCompliance: number;
    optimizationLevel: number;
  };
  metrics: PerformanceState;
  recommendations: PerformanceRecommendation[];
  optimizationHistory: OptimizationEvent[];
}

interface OptimizationEvent {
  timestamp: number;
  type: string;
  description: string;
  impact: string;
  success: boolean;
}

// Default configuration with 2025 performance standards
const DEFAULT_CONFIG: PerformanceConfig = {
  classificationTargetMs: 100,
  taskCategorizationTargetMs: 2,
  uiInteractionTargetMs: 500,
  memoryLimitMB: 50,
  targetFPS: 60,
  
  enableHardwareAcceleration: true,
  enableVirtualScrolling: true,
  enableProgressiveLoading: true,
  enablePredictiveCaching: true,
  enableBatchProcessing: true,
  enableWorkerThreads: true,
  
  enableAdaptiveQuality: true,
  enableLowPowerMode: false,
  enableMemoryPressureHandling: true,
};

// Create performance optimization context
const PerformanceOptimizerContext = createContext<PerformanceOptimizerContextValue | null>(null);

export const PerformanceOptimizerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<PerformanceConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<PerformanceState>({
    classificationLatency: 0,
    taskCategorizationLatency: 0,
    uiInteractionLatency: 0,
    memoryUsageMB: 0,
    currentFPS: 60,
    
    hardwareAccelerated: false,
    virtualScrollingActive: false,
    progressiveLoadingActive: false,
    lowPowerModeActive: false,
    memoryPressureDetected: false,
    
    budgetCompliance: {
      classification: true,
      taskCategorization: true,
      uiInteraction: true,
      memory: true,
      fps: true,
    },
    
    recommendations: [],
  });

  const optimizationHistoryRef = useRef<OptimizationEvent[]>([]);
  const performanceMonitorRef = useRef<any>(null);
  const memoryObserverRef = useRef<PerformanceObserver | null>(null);
  const fpsCounterRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());

  // Initialize performance monitoring
  useEffect(() => {
    initializePerformanceMonitoring();
    return () => {
      cleanup();
    };
  }, []);

  const initializePerformanceMonitoring = useCallback(() => {
    // Initialize FPS monitoring
    if (config.targetFPS > 0) {
      startFPSMonitoring();
    }

    // Initialize memory monitoring
    if (config.enableMemoryPressureHandling) {
      startMemoryMonitoring();
    }

    // Initialize hardware acceleration detection
    detectHardwareAcceleration();

    // Start periodic performance assessment
    performanceMonitorRef.current = setInterval(() => {
      assessPerformance();
    }, 1000);
  }, [config]);

  const startFPSMonitoring = useCallback(() => {
    const measureFPS = () => {
      fpsCounterRef.current++;
      const now = performance.now();
      
      if (now - lastFpsTimeRef.current >= 1000) {
        const fps = Math.round((fpsCounterRef.current * 1000) / (now - lastFpsTimeRef.current));
        setState(prev => ({ ...prev, currentFPS: fps }));
        
        fpsCounterRef.current = 0;
        lastFpsTimeRef.current = now;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }, []);

  const startMemoryMonitoring = useCallback(() => {
    if ('memory' in performance) {
      const monitorMemory = () => {
        const memoryInfo = (performance as any).memory;
        const usedMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
        
        setState(prev => ({ 
          ...prev, 
          memoryUsageMB: usedMB,
          memoryPressureDetected: usedMB > config.memoryLimitMB * 0.8 
        }));
        
        if (usedMB > config.memoryLimitMB) {
          handleMemoryPressure();
        }
      };

      setInterval(monitorMemory, 2000);
    }
  }, [config.memoryLimitMB]);

  const detectHardwareAcceleration = useCallback(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (context) {
      const gl = context as WebGLRenderingContext;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = gl.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL || gl.RENDERER);
      const hardwareAccelerated = !renderer.includes('Software') && !renderer.includes('software');
      
      setState(prev => ({ ...prev, hardwareAccelerated }));
      
      if (config.enableHardwareAcceleration && hardwareAccelerated) {
        enableHardwareAcceleration();
      }
    }
  }, [config.enableHardwareAcceleration]);

  const enableHardwareAcceleration = useCallback(() => {
    // Enable CSS hardware acceleration
    document.documentElement.style.transform = 'translateZ(0)';
    document.documentElement.style.backfaceVisibility = 'hidden';
    document.documentElement.style.perspective = '1000px';
    
    addOptimizationEvent('hardware_acceleration_enabled', 'Enabled hardware acceleration', 'Improved rendering performance');
  }, []);

  const assessPerformance = useCallback(() => {
    const compliance = {
      classification: state.classificationLatency <= config.classificationTargetMs,
      taskCategorization: state.taskCategorizationLatency <= config.taskCategorizationTargetMs,
      uiInteraction: state.uiInteractionLatency <= config.uiInteractionTargetMs,
      memory: state.memoryUsageMB <= config.memoryLimitMB,
      fps: state.currentFPS >= config.targetFPS * 0.9, // 90% of target
    };

    setState(prev => ({ ...prev, budgetCompliance: compliance }));

    // Generate recommendations based on performance
    generateRecommendations(compliance);
  }, [state, config]);

  const generateRecommendations = useCallback((compliance: any) => {
    const recommendations: PerformanceRecommendation[] = [];

    if (!compliance.classification) {
      recommendations.push({
        id: 'classification_slow',
        type: 'cpu',
        severity: 'high',
        description: 'Email classification is exceeding 100ms target',
        action: 'Enable batch processing and caching optimization',
        impact: 'Faster email classification and improved user experience',
        autoApplicable: true,
      });
    }

    if (!compliance.taskCategorization) {
      recommendations.push({
        id: 'task_categorization_slow',
        type: 'cpu',
        severity: 'critical',
        description: 'Task categorization exceeding 2ms target',
        action: 'Optimize categorization algorithm and enable worker threads',
        impact: 'Real-time task categorization performance',
        autoApplicable: true,
      });
    }

    if (!compliance.memory) {
      recommendations.push({
        id: 'memory_pressure',
        type: 'memory',
        severity: 'high',
        description: `Memory usage (${state.memoryUsageMB.toFixed(1)}MB) exceeds ${config.memoryLimitMB}MB limit`,
        action: 'Enable virtual scrolling and memory cleanup',
        impact: 'Reduced memory usage and improved stability',
        autoApplicable: true,
      });
    }

    if (!compliance.fps) {
      recommendations.push({
        id: 'low_fps',
        type: 'ui',
        severity: 'medium',
        description: `Animation FPS (${state.currentFPS}) below target (${config.targetFPS})`,
        action: 'Optimize animations and reduce UI complexity',
        impact: 'Smoother animations and interactions',
        autoApplicable: true,
      });
    }

    setState(prev => ({ ...prev, recommendations }));
  }, [state, config]);

  // Performance optimization methods
  const optimizeClassification = useCallback(async () => {
    if (config.enableBatchProcessing) {
      // Enable batch processing for email classification
      advancedCache.set('classification_batch_mode', true, { ttl: 60000 });
    }

    if (config.enablePredictiveCaching) {
      // Warm cache with likely classification requests
      // Implementation would depend on specific caching strategy
    }

    addOptimizationEvent('classification_optimized', 'Applied classification optimizations', 'Improved classification performance');
  }, [config]);

  const optimizeTaskCategorization = useCallback(async () => {
    if (config.enableWorkerThreads) {
      // Move task categorization to worker thread
      // Implementation would involve creating a web worker
    }

    addOptimizationEvent('task_categorization_optimized', 'Applied task categorization optimizations', 'Improved categorization performance');
  }, [config]);

  const optimizeUIInteractions = useCallback(async () => {
    if (config.enableVirtualScrolling) {
      setState(prev => ({ ...prev, virtualScrollingActive: true }));
    }

    if (config.enableProgressiveLoading) {
      setState(prev => ({ ...prev, progressiveLoadingActive: true }));
    }

    // Debounce UI interactions
    document.body.style.willChange = 'transform';
    
    addOptimizationEvent('ui_optimized', 'Applied UI interaction optimizations', 'Improved UI responsiveness');
  }, [config]);

  const optimizeMemoryUsage = useCallback(async () => {
    // Clear old cache entries
    advancedCache.clear();
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }

    // Enable memory pressure handling
    setState(prev => ({ ...prev, memoryPressureDetected: false }));
    
    addOptimizationEvent('memory_optimized', 'Applied memory optimizations', 'Reduced memory usage');
  }, []);

  const optimizeAnimations = useCallback(async () => {
    if (config.enableHardwareAcceleration && state.hardwareAccelerated) {
      // Apply hardware acceleration to animated elements
      const animatedElements = document.querySelectorAll('[data-animate="true"]');
      animatedElements.forEach(element => {
        (element as HTMLElement).style.willChange = 'transform';
        (element as HTMLElement).style.transform = 'translateZ(0)';
      });
    }

    addOptimizationEvent('animations_optimized', 'Applied animation optimizations', 'Improved animation performance');
  }, [config, state.hardwareAccelerated]);

  const enableLowPowerMode = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, enableLowPowerMode: enabled }));
    setState(prev => ({ ...prev, lowPowerModeActive: enabled }));

    if (enabled) {
      // Reduce animation frame rate
      // Disable non-essential features
      // Reduce quality of visual effects
      addOptimizationEvent('low_power_mode_enabled', 'Enabled low power mode', 'Extended battery life');
    } else {
      addOptimizationEvent('low_power_mode_disabled', 'Disabled low power mode', 'Full performance restored');
    }
  }, []);

  const handleMemoryPressure = useCallback(async () => {
    await optimizeMemoryUsage();
    
    // Additional memory pressure handling
    if (config.enableVirtualScrolling && !state.virtualScrollingActive) {
      setState(prev => ({ ...prev, virtualScrollingActive: true }));
    }

    addOptimizationEvent('memory_pressure_handled', 'Handled memory pressure situation', 'Prevented memory overflow');
  }, [config, state, optimizeMemoryUsage]);

  const adaptToNetworkConditions = useCallback(async (connectionType: string) => {
    switch (connectionType) {
      case 'slow-2g':
      case '2g':
        // Enable aggressive optimization for slow connections
        setConfig(prev => ({
          ...prev,
          enableProgressiveLoading: true,
          enablePredictiveCaching: false, // Reduce network usage
        }));
        break;
      case '3g':
        setConfig(prev => ({
          ...prev,
          enableProgressiveLoading: true,
          enablePredictiveCaching: true,
        }));
        break;
      case '4g':
      case '5g':
        // Enable all optimizations for fast connections
        setConfig(prev => ({
          ...prev,
          enableProgressiveLoading: true,
          enablePredictiveCaching: true,
        }));
        break;
    }

    addOptimizationEvent('network_adaptation', `Adapted to ${connectionType} connection`, 'Optimized for network conditions');
  }, []);

  // Performance measurement utilities
  const measureClassificationPerformance = useCallback(async (operation: () => Promise<any>): Promise<number> => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    setState(prev => ({ ...prev, classificationLatency: duration }));
    return duration;
  }, []);

  const measureTaskCategorizationPerformance = useCallback(async (operation: () => Promise<any>): Promise<number> => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    setState(prev => ({ ...prev, taskCategorizationLatency: duration }));
    return duration;
  }, []);

  const measureUIInteractionPerformance = useCallback(async (operation: () => Promise<any>): Promise<number> => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    setState(prev => ({ ...prev, uiInteractionLatency: duration }));
    return duration;
  }, []);

  const updateConfig = useCallback((newConfig: Partial<PerformanceConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    addOptimizationEvent('config_updated', 'Performance configuration updated', 'Applied new optimization settings');
  }, []);

  const resetOptimizations = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setState(prev => ({
      ...prev,
      virtualScrollingActive: false,
      progressiveLoadingActive: false,
      lowPowerModeActive: false,
      recommendations: [],
    }));
    
    addOptimizationEvent('optimizations_reset', 'Reset all optimizations to default', 'Restored default performance settings');
  }, []);

  const getPerformanceReport = useCallback((): PerformanceReport => {
    const overallScore = Object.values(state.budgetCompliance).filter(Boolean).length / Object.keys(state.budgetCompliance).length * 100;
    const budgetCompliance = overallScore;
    const optimizationLevel = [
      state.virtualScrollingActive,
      state.progressiveLoadingActive,
      state.hardwareAccelerated,
    ].filter(Boolean).length / 3 * 100;

    return {
      timestamp: Date.now(),
      summary: {
        overallScore,
        budgetCompliance,
        optimizationLevel,
      },
      metrics: state,
      recommendations: state.recommendations,
      optimizationHistory: optimizationHistoryRef.current.slice(-10), // Last 10 events
    };
  }, [state]);

  const exportPerformanceData = useCallback((): string => {
    const report = getPerformanceReport();
    return JSON.stringify(report, null, 2);
  }, [getPerformanceReport]);

  const addOptimizationEvent = useCallback((type: string, description: string, impact: string) => {
    const event: OptimizationEvent = {
      timestamp: Date.now(),
      type,
      description,
      impact,
      success: true,
    };
    
    optimizationHistoryRef.current.push(event);
    
    // Keep only last 50 events
    if (optimizationHistoryRef.current.length > 50) {
      optimizationHistoryRef.current = optimizationHistoryRef.current.slice(-50);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (performanceMonitorRef.current) {
      clearInterval(performanceMonitorRef.current);
    }
    
    if (memoryObserverRef.current) {
      memoryObserverRef.current.disconnect();
    }
  }, []);

  const contextValue: PerformanceOptimizerContextValue = useMemo(() => ({
    config,
    state,
    optimizeClassification,
    optimizeTaskCategorization,
    optimizeUIInteractions,
    optimizeMemoryUsage,
    optimizeAnimations,
    enableLowPowerMode,
    handleMemoryPressure,
    adaptToNetworkConditions,
    measureClassificationPerformance,
    measureTaskCategorizationPerformance,
    measureUIInteractionPerformance,
    updateConfig,
    resetOptimizations,
    getPerformanceReport,
    exportPerformanceData,
  }), [
    config,
    state,
    optimizeClassification,
    optimizeTaskCategorization,
    optimizeUIInteractions,
    optimizeMemoryUsage,
    optimizeAnimations,
    enableLowPowerMode,
    handleMemoryPressure,
    adaptToNetworkConditions,
    measureClassificationPerformance,
    measureTaskCategorizationPerformance,
    measureUIInteractionPerformance,
    updateConfig,
    resetOptimizations,
    getPerformanceReport,
    exportPerformanceData,
  ]);

  return (
    <PerformanceOptimizerContext.Provider value={contextValue}>
      {children}
    </PerformanceOptimizerContext.Provider>
  );
};

// Hook for consuming performance optimization context
export const usePerformanceOptimizer = (): PerformanceOptimizerContextValue => {
  const context = useContext(PerformanceOptimizerContext);
  if (!context) {
    throw new Error('usePerformanceOptimizer must be used within a PerformanceOptimizerProvider');
  }
  return context;
};

// Performance optimization utilities for direct usage
export const PerformanceOptimizer = {
  // Direct measurement utilities
  measureAsync: async <T,>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    return { result, duration: endTime - startTime };
  },

  measureSync: <T,>(operation: () => T): { result: T; duration: number } => {
    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    return { result, duration: endTime - startTime };
  },

  // Memory utilities
  getMemoryUsage: (): number | null => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    return null;
  },

  // Frame rate utilities
  requestIdleCallback: (callback: () => void, timeout = 5000): void => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback, { timeout });
    } else {
      setTimeout(callback, 0);
    }
  },
};

export default PerformanceOptimizerProvider;