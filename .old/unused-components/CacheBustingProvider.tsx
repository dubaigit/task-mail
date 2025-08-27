/**
 * Cache Busting Provider
 * React context provider for cache busting functionality
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { cacheBustingManager, CacheBustingManager } from '../utils/cache-busting';
import { serviceWorkerManager, ServiceWorkerManager } from '../utils/serviceWorkerRegistration';

interface CacheBustingContextType {
  cacheManager: CacheBustingManager;
  serviceWorker: ServiceWorkerManager;
  isUpdateAvailable: boolean;
  buildInfo: {
    version: string;
    assets: number;
    timestamp: number;
  };
  cacheStats: {
    bytes: number;
    megabytes: number;
    caches: number;
  };
  actions: {
    checkForUpdates: () => Promise<boolean>;
    clearCache: () => Promise<void>;
    forceReload: () => Promise<void>;
    invalidateAssets: (paths: string[]) => Promise<void>;
    getCacheBustedUrl: (path: string) => string;
  };
}

const CacheBustingContext = createContext<CacheBustingContextType | null>(null);

interface CacheBustingProviderProps {
  children: ReactNode;
  enableServiceWorker?: boolean;
  enableUpdateChecks?: boolean;
  updateCheckInterval?: number;
}

export const CacheBustingProvider: React.FC<CacheBustingProviderProps> = ({
  children,
  enableServiceWorker = true,
  enableUpdateChecks = true,
  updateCheckInterval = 60000 // 1 minute
}) => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [buildInfo, setBuildInfo] = useState(() => cacheBustingManager.getBuildInfo());
  const [cacheStats, setCacheStats] = useState({
    bytes: 0,
    megabytes: 0,
    caches: 0
  });

  // Initialize service worker and cache management
  useEffect(() => {
    let updateInterval: number;

    const initialize = async () => {
      try {
        // Initialize service worker in production
        if (enableServiceWorker && process.env.NODE_ENV === 'production') {
          await serviceWorkerManager.register('/sw.js');
          
          // Set up service worker event listeners
          serviceWorkerManager.on('updateavailable', () => {
            console.log('🔄 App update available');
            setIsUpdateAvailable(true);
          });

          serviceWorkerManager.on('controllerchange', () => {
            console.log('🔄 Service worker controller changed');
            // Optionally reload the page or show notification
          });

          serviceWorkerManager.on('cacheCleared', () => {
            console.log('🧹 Cache cleared');
            updateCacheStats();
          });
        }

        // Preload critical assets
        cacheBustingManager.preloadCriticalAssets();

        // Update cache stats
        updateCacheStats();

        // Set up periodic update checks
        if (enableUpdateChecks) {
          updateInterval = window.setInterval(async () => {
            try {
              const hasUpdates = await cacheBustingManager.checkForUpdates();
              if (hasUpdates) {
                setIsUpdateAvailable(true);
                setBuildInfo(cacheBustingManager.getBuildInfo());
              }
            } catch (error) {
              console.warn('Update check failed:', error);
            }
          }, updateCheckInterval);
        }

        console.log('✅ Cache busting system initialized');
      } catch (error) {
        console.error('❌ Cache busting initialization failed:', error);
      }
    };

    initialize();

    // Cleanup
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [enableServiceWorker, enableUpdateChecks, updateCheckInterval]);

  // Update cache statistics
  const updateCacheStats = async () => {
    try {
      if (enableServiceWorker) {
        const stats = await serviceWorkerManager.getCacheSize();
        setCacheStats(stats);
      }
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
    }
  };

  // Context actions
  const actions = {
    checkForUpdates: async (): Promise<boolean> => {
      try {
        const hasUpdates = await cacheBustingManager.checkForUpdates();
        if (hasUpdates) {
          setIsUpdateAvailable(true);
          setBuildInfo(cacheBustingManager.getBuildInfo());
        }
        return hasUpdates;
      } catch (error) {
        console.error('Update check failed:', error);
        return false;
      }
    },

    clearCache: async (): Promise<void> => {
      try {
        if (enableServiceWorker) {
          await serviceWorkerManager.clearCache();
        }
        // Also clear advanced cache
        const { advancedCache } = await import('../utils/advancedCache');
        await advancedCache.clear();
        updateCacheStats();
        console.log('✅ All caches cleared');
      } catch (error) {
        console.error('Cache clear failed:', error);
      }
    },

    forceReload: async (): Promise<void> => {
      try {
        await cacheBustingManager.forceReload();
      } catch (error) {
        console.error('Force reload failed:', error);
        // Fallback to regular reload
        window.location.reload();
      }
    },

    invalidateAssets: async (paths: string[]): Promise<void> => {
      try {
        if (enableServiceWorker) {
          await serviceWorkerManager.invalidateAssets(paths);
        }
        console.log('✅ Assets invalidated:', paths);
      } catch (error) {
        console.error('Asset invalidation failed:', error);
      }
    },

    getCacheBustedUrl: (path: string): string => {
      return cacheBustingManager.getCacheBustedUrl(path);
    }
  };

  const contextValue: CacheBustingContextType = {
    cacheManager: cacheBustingManager,
    serviceWorker: serviceWorkerManager,
    isUpdateAvailable,
    buildInfo,
    cacheStats,
    actions
  };

  return (
    <CacheBustingContext.Provider value={contextValue}>
      {children}
      {isUpdateAvailable && <UpdateNotification />}
    </CacheBustingContext.Provider>
  );
};

/**
 * Update notification component
 */
const UpdateNotification: React.FC = () => {
  const context = useContext(CacheBustingContext);
  
  if (!context) return null;

  const handleReload = () => {
    context.actions.forceReload();
  };

  const handleDismiss = () => {
    // This is a simplified dismissal - in a real app you might want to track this in state
    const notification = document.querySelector('.update-notification');
    if (notification) {
      notification.remove();
    }
  };

  return (
    <div className="update-notification fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">
              📦 App Update Available
            </h3>
            <p className="text-sm text-blue-100 mt-1">
              A new version is ready with the latest features and improvements.
            </p>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={handleReload}
                className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-medium hover:bg-blue-50 transition-colors"
              >
                Reload Now
              </button>
              <button
                onClick={handleDismiss}
                className="bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-800 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-blue-200 hover:text-white"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to use cache busting context
 */
export const useCacheBusting = (): CacheBustingContextType => {
  const context = useContext(CacheBustingContext);
  if (!context) {
    throw new Error('useCacheBusting must be used within a CacheBustingProvider');
  }
  return context;
};

/**
 * Hook for cache-busted URLs
 */
export const useCacheBustedUrl = (path: string): string => {
  const { actions } = useCacheBusting();
  return actions.getCacheBustedUrl(path);
};

/**
 * Component for displaying cache information (for debugging)
 */
export const CacheDebugInfo: React.FC = () => {
  const { buildInfo, cacheStats, isUpdateAvailable } = useCacheBusting();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-gray-900 text-white text-xs p-3 rounded-lg font-mono z-50">
      <div className="space-y-1">
        <div>Build: {buildInfo.version}</div>
        <div>Assets: {buildInfo.assets}</div>
        <div>Cache: {cacheStats.megabytes}MB</div>
        <div>Update: {isUpdateAvailable ? '🔄 Available' : '✅ Current'}</div>
      </div>
    </div>
  );
};

export default CacheBustingProvider;