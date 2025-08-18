/**
 * Service Worker Registration with Cache Busting Integration
 * Handles SW lifecycle, updates, and cache management
 */

import { cacheBustingManager } from './cache-busting';

export interface ServiceWorkerConfig {
  updateInterval: number; // Check for updates every N milliseconds
  enableUpdateNotifications: boolean;
  skipWaiting: boolean; // Immediately activate new SW
  enableCacheManagement: boolean;
}

export interface ServiceWorkerStatus {
  registered: boolean;
  activated: boolean;
  updateAvailable: boolean;
  controllerChange: boolean;
  error?: string;
}

/**
 * Service Worker Manager
 * Handles registration, updates, and cache coordination
 */
export class ServiceWorkerManager {
  private config: ServiceWorkerConfig;
  private registration: ServiceWorkerRegistration | null = null;
  private updateCheckInterval?: number;
  private listeners: Map<string, Function[]> = new Map();

  constructor(config?: Partial<ServiceWorkerConfig>) {
    this.config = {
      updateInterval: 60000, // 1 minute
      enableUpdateNotifications: true,
      skipWaiting: false,
      enableCacheManagement: true,
      ...config
    };

    this.initializeListeners();
  }

  /**
   * Register service worker
   */
  async register(swUrl: string = '/sw.js'): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service workers not supported');
      return null;
    }

    try {
      console.log('[SW] Registering service worker...');
      
      this.registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/'
      });

      console.log('[SW] Service worker registered:', this.registration.scope);

      // Set up event listeners
      this.setupRegistrationListeners();

      // Start update checks
      if (this.config.updateInterval > 0) {
        this.startUpdateChecks();
      }

      // Preload critical assets after registration
      if (this.config.enableCacheManagement) {
        setTimeout(() => {
          cacheBustingManager.preloadCriticalAssets();
        }, 1000);
      }

      this.emit('registered', this.registration);
      return this.registration;

    } catch (error) {
      console.error('[SW] Service worker registration failed:', error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      console.warn('[SW] No service worker registered');
      return false;
    }

    try {
      const result = await this.registration.unregister();
      
      if (result) {
        console.log('[SW] Service worker unregistered');
        this.stopUpdateChecks();
        this.registration = null;
        this.emit('unregistered');
      }

      return result;
    } catch (error) {
      console.error('[SW] Service worker unregistration failed:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      console.log('[SW] Checking for updates...');
      
      // Check for SW updates
      await this.registration.update();

      // Also check for asset updates
      const hasAssetUpdates = await cacheBustingManager.checkForUpdates();
      
      if (hasAssetUpdates) {
        console.log('[SW] Asset updates detected');
        this.emit('assetsUpdated');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[SW] Update check failed:', error);
      return false;
    }
  }

  /**
   * Skip waiting for new service worker
   */
  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      console.log('[SW] Skipping waiting...');
      
      // Send skip waiting message
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Wait for controller change
      return new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW] Controller changed');
          this.emit('controllerchange');
          resolve();
        }, { once: true });
      });
    }
  }

  /**
   * Get cache size information
   */
  async getCacheSize(): Promise<{bytes: number, megabytes: number, caches: number}> {
    if (!this.registration || !navigator.serviceWorker.controller) {
      return { bytes: 0, megabytes: 0, caches: 0 };
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_SIZE') {
          resolve(event.data.size);
        }
      };

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_CACHE_SIZE' },
          [messageChannel.port2]
        );
      }

      // Timeout after 5 seconds
      setTimeout(() => {
        resolve({ bytes: 0, megabytes: 0, caches: 0 });
      }, 5000);
    });
  }

  /**
   * Clear all service worker caches
   */
  async clearCache(): Promise<void> {
    if (!this.registration || !navigator.serviceWorker.controller) {
      console.warn('[SW] No active service worker to clear cache');
      return;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_CLEARED') {
          console.log('[SW] All caches cleared');
          this.emit('cacheCleared');
          resolve();
        }
      };

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        resolve();
      }, 10000);
    });
  }

  /**
   * Invalidate specific cached assets
   */
  async invalidateAssets(assetPaths: string[]): Promise<void> {
    if (!navigator.serviceWorker.controller) {
      console.warn('[SW] No active service worker to invalidate cache');
      return;
    }

    const cacheBustedUrls = assetPaths.map(path => 
      cacheBustingManager.getCacheBustedUrl(path)
    );

    navigator.serviceWorker.controller.postMessage({
      type: 'INVALIDATE_CACHE',
      assets: cacheBustedUrls
    });

    console.log('[SW] Invalidated cache for', assetPaths.length, 'assets');
  }

  /**
   * Get current service worker status
   */
  getStatus(): ServiceWorkerStatus {
    return {
      registered: !!this.registration,
      activated: !!this.registration?.active,
      updateAvailable: !!this.registration?.waiting,
      controllerChange: !!navigator.serviceWorker.controller
    };
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[SW] Event listener error:', error);
        }
      });
    }
  }

  /**
   * Initialize navigator service worker listeners
   */
  private initializeListeners(): void {
    if (!('serviceWorker' in navigator)) return;

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed');
      this.emit('controllerchange');
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { data } = event;
      console.log('[SW] Message from service worker:', data);
      this.emit('message', data);
    });
  }

  /**
   * Set up service worker registration listeners
   */
  private setupRegistrationListeners(): void {
    if (!this.registration) return;

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      console.log('[SW] Update found');
      this.emit('updatefound');

      const newWorker = this.registration!.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          console.log('[SW] New worker state:', newWorker.state);
          
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New content available');
            this.emit('updateavailable', newWorker);
            
            if (this.config.enableUpdateNotifications) {
              this.notifyUpdate();
            }
            
            if (this.config.skipWaiting) {
              this.skipWaiting();
            }
          }
        });
      }
    });
  }

  /**
   * Start periodic update checks
   */
  private startUpdateChecks(): void {
    this.updateCheckInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, this.config.updateInterval);

    console.log('[SW] Started update checks every', this.config.updateInterval, 'ms');
  }

  /**
   * Stop periodic update checks
   */
  private stopUpdateChecks(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = undefined;
      console.log('[SW] Stopped update checks');
    }
  }

  /**
   * Notify user about available updates
   */
  private notifyUpdate(): void {
    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'sw-update-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1976d2;
        color: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="font-weight: 600; margin-bottom: 8px;">
          📦 App Update Available
        </div>
        <div style="font-size: 14px; margin-bottom: 12px;">
          A new version is ready. Reload to get the latest features.
        </div>
        <div style="display: flex; gap: 8px;">
          <button 
            onclick="location.reload()" 
            style="
              background: white;
              color: #1976d2;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 600;
              font-size: 12px;
            "
          >
            Reload
          </button>
          <button 
            onclick="this.closest('.sw-update-notification').remove()" 
            style="
              background: transparent;
              color: white;
              border: 1px solid white;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            "
          >
            Later
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 30000);
  }

  /**
   * Dispose of service worker manager
   */
  dispose(): void {
    this.stopUpdateChecks();
    this.listeners.clear();
  }
}

/**
 * React Hook for Service Worker functionality
 */
export function useServiceWorker(config?: Partial<ServiceWorkerConfig>) {
  const swManager = new ServiceWorkerManager(config);

  return {
    register: (swUrl?: string) => swManager.register(swUrl),
    unregister: () => swManager.unregister(),
    checkForUpdates: () => swManager.checkForUpdates(),
    skipWaiting: () => swManager.skipWaiting(),
    getCacheSize: () => swManager.getCacheSize(),
    clearCache: () => swManager.clearCache(),
    invalidateAssets: (paths: string[]) => swManager.invalidateAssets(paths),
    getStatus: () => swManager.getStatus(),
    on: (event: string, callback: Function) => swManager.on(event, callback),
    off: (event: string, callback: Function) => swManager.off(event, callback)
  };
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Auto-register service worker in production
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  // Register on load
  window.addEventListener('load', () => {
    serviceWorkerManager.register('/sw.js');
  });
}

export default ServiceWorkerManager;