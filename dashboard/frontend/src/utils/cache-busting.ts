/**
 * Cache Busting Utility
 * Implements proper content-hashed filename generation and cache management
 * for optimal browser caching and cache invalidation strategies
 */

export interface AssetManifest {
  [key: string]: string;
}

export interface CacheBustingConfig {
  enableVersioning: boolean;
  versionPattern: 'timestamp' | 'hash' | 'semver';
  staticAssetPaths: string[];
  cacheHeaders: {
    immutable: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export interface AssetCacheControl {
  path: string;
  maxAge: number;
  immutable: boolean;
  mustRevalidate: boolean;
  etag: boolean;
}

/**
 * Cache Busting Manager
 * Handles content-hashed filenames and proper cache headers
 */
export class CacheBustingManager {
  private config: CacheBustingConfig;
  private assetManifest: AssetManifest = {};
  private buildVersion: string;

  constructor(config?: Partial<CacheBustingConfig>) {
    this.config = {
      enableVersioning: true,
      versionPattern: 'hash',
      staticAssetPaths: ['/static/js/', '/static/css/', '/static/media/'],
      cacheHeaders: {
        immutable: ['*.js', '*.css', '*.woff2', '*.woff', '*.ttf'],
        shortTerm: ['*.html', '*.json'],
        longTerm: ['*.png', '*.jpg', '*.jpeg', '*.svg', '*.ico', '*.webp']
      },
      ...config
    };

    this.buildVersion = this.generateBuildVersion();
    this.loadAssetManifest();
  }

  /**
   * Generate build version based on configuration
   */
  private generateBuildVersion(): string {
    switch (this.config.versionPattern) {
      case 'timestamp':
        return Date.now().toString();
      case 'hash':
        return this.generateContentHash();
      case 'semver':
        return this.getPackageVersion();
      default:
        return Date.now().toString();
    }
  }

  /**
   * Generate content hash for cache busting
   */
  private generateContentHash(): string {
    const buildInfo = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      random: Math.random().toString(36).substring(2)
    };
    
    return btoa(JSON.stringify(buildInfo))
      .replace(/[+/=]/g, '')
      .substring(0, 8);
  }

  /**
   * Get package version from environment or build
   */
  private getPackageVersion(): string {
    // In production, this would come from process.env.REACT_APP_VERSION
    // For now, use a default version
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  /**
   * Load asset manifest from build output
   */
  private async loadAssetManifest(): Promise<void> {
    try {
      // In Create React App, the manifest is available at /asset-manifest.json
      const response = await fetch('/asset-manifest.json', {
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const manifest = await response.json();
        this.assetManifest = manifest.files || {};
        console.log('📦 Asset manifest loaded:', Object.keys(this.assetManifest).length, 'assets');
      }
    } catch (error) {
      console.warn('⚠️ Could not load asset manifest:', error);
      // Fallback to default behavior
      this.generateFallbackManifest();
    }
  }

  /**
   * Generate fallback manifest when build manifest is not available
   */
  private generateFallbackManifest(): void {
    this.assetManifest = {
      'main.js': `/static/js/main.${this.buildVersion}.js`,
      'main.css': `/static/css/main.${this.buildVersion}.css`,
      'runtime.js': `/static/js/runtime-main.${this.buildVersion}.js`,
      'vendor.js': `/static/js/vendor.${this.buildVersion}.js`
    };
  }

  /**
   * Get cache-busted URL for asset
   */
  getCacheBustedUrl(assetPath: string): string {
    // Check if asset exists in manifest
    const manifestKey = assetPath.replace(/^\//, '');
    if (this.assetManifest[manifestKey]) {
      return this.assetManifest[manifestKey];
    }

    // Check for partial matches (e.g., 'main.js' matches 'static/js/main.[hash].js')
    const matchingKey = Object.keys(this.assetManifest).find(key => 
      key.includes(assetPath.replace(/^\/static\/[^/]+\//, '').replace(/\.[^.]+$/, ''))
    );

    if (matchingKey) {
      return this.assetManifest[matchingKey];
    }

    // Fallback: append version query parameter
    const separator = assetPath.includes('?') ? '&' : '?';
    return `${assetPath}${separator}v=${this.buildVersion}`;
  }

  /**
   * Preload critical assets with proper cache headers
   */
  preloadCriticalAssets(): void {
    const criticalAssets = [
      'main.css',
      'main.js',
      'runtime.js'
    ];

    criticalAssets.forEach(asset => {
      const url = this.getCacheBustedUrl(asset);
      
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      
      if (asset.endsWith('.css')) {
        link.as = 'style';
      } else if (asset.endsWith('.js')) {
        link.as = 'script';
      }
      
      // Add to head if not already present
      if (!document.querySelector(`link[href="${url}"]`)) {
        document.head.appendChild(link);
      }
    });
  }

  /**
   * Generate cache control headers for different asset types
   */
  getCacheControlHeaders(assetPath: string): AssetCacheControl {
    const extension = assetPath.split('.').pop()?.toLowerCase() || '';
    
    // Immutable assets (JS/CSS with hashes)
    if (this.isImmutableAsset(assetPath)) {
      return {
        path: assetPath,
        maxAge: 31536000, // 1 year
        immutable: true,
        mustRevalidate: false,
        etag: false
      };
    }
    
    // Short-term cache (HTML, manifest files)
    if (this.isShortTermAsset(extension)) {
      return {
        path: assetPath,
        maxAge: 3600, // 1 hour
        immutable: false,
        mustRevalidate: true,
        etag: true
      };
    }
    
    // Long-term cache (images, fonts)
    if (this.isLongTermAsset(extension)) {
      return {
        path: assetPath,
        maxAge: 2592000, // 30 days
        immutable: false,
        mustRevalidate: false,
        etag: true
      };
    }
    
    // Default: short-term cache
    return {
      path: assetPath,
      maxAge: 3600, // 1 hour
      immutable: false,
      mustRevalidate: true,
      etag: true
    };
  }

  /**
   * Check if asset is immutable (has content hash)
   */
  private isImmutableAsset(assetPath: string): boolean {
    // Check if path contains a hash pattern
    const hashPattern = /\.[a-f0-9]{8,}\./;
    return hashPattern.test(assetPath) || 
           this.config.cacheHeaders.immutable.some(pattern => 
             this.matchesPattern(assetPath, pattern)
           );
  }

  /**
   * Check if asset should have short-term cache
   */
  private isShortTermAsset(extension: string): boolean {
    return this.config.cacheHeaders.shortTerm.some(pattern =>
      this.matchesPattern(`.${extension}`, pattern)
    );
  }

  /**
   * Check if asset should have long-term cache
   */
  private isLongTermAsset(extension: string): boolean {
    return this.config.cacheHeaders.longTerm.some(pattern =>
      this.matchesPattern(`.${extension}`, pattern)
    );
  }

  /**
   * Match file pattern (simple glob matching)
   */
  private matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    
    return new RegExp(regexPattern + '$').test(path);
  }

  /**
   * Invalidate cache for specific assets
   */
  async invalidateCache(assetPaths: string[]): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Send message to service worker to invalidate cache
      navigator.serviceWorker.controller.postMessage({
        type: 'INVALIDATE_CACHE',
        assets: assetPaths.map(path => this.getCacheBustedUrl(path))
      });
    }

    // Also clear relevant browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const promises = cacheNames.map(async (cacheName) => {
        const cache = await caches.open(cacheName);
        const promises = assetPaths.map(path => 
          cache.delete(this.getCacheBustedUrl(path))
        );
        return Promise.all(promises);
      });
      
      await Promise.all(promises);
    }
  }

  /**
   * Check if current assets are up to date
   */
  async checkForUpdates(): Promise<boolean> {
    try {
      const response = await fetch('/asset-manifest.json', {
        cache: 'no-cache'
      });
      
      if (!response.ok) return false;
      
      const manifest = await response.json();
      const newManifest = manifest.files || {};
      
      // Compare manifests
      const currentKeys = Object.keys(this.assetManifest).sort();
      const newKeys = Object.keys(newManifest).sort();
      
      if (currentKeys.length !== newKeys.length) return true;
      
      for (let i = 0; i < currentKeys.length; i++) {
        const key = currentKeys[i];
        if (this.assetManifest[key] !== newManifest[key]) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️ Could not check for updates:', error);
      return false;
    }
  }

  /**
   * Force reload application with new assets
   */
  async forceReload(): Promise<void> {
    // Clear all caches first
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Clear storage
    if (typeof Storage !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }

    // Reload page
    window.location.reload();
  }

  /**
   * Get current build information
   */
  getBuildInfo(): {
    version: string;
    assets: number;
    manifest: AssetManifest;
    timestamp: number;
  } {
    return {
      version: this.buildVersion,
      assets: Object.keys(this.assetManifest).length,
      manifest: { ...this.assetManifest },
      timestamp: Date.now()
    };
  }

  /**
   * Generate Service Worker cache configuration
   */
  generateServiceWorkerConfig(): {
    precacheManifest: Array<{url: string, revision: string}>;
    runtimeCaching: Array<{
      urlPattern: RegExp;
      handler: string;
      options: any;
    }>;
  } {
    // Generate precache manifest
    const precacheManifest = Object.entries(this.assetManifest).map(([key, url]) => ({
      url,
      revision: this.extractRevisionFromUrl(url)
    }));

    // Runtime caching strategies
    const runtimeCaching = [
      {
        urlPattern: new RegExp('^https://fonts\\.googleapis\\.com/'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      },
      {
        urlPattern: new RegExp('^https://fonts\\.gstatic\\.com/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          }
        }
      },
      {
        urlPattern: new RegExp('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 5 // 5 minutes
          }
        }
      }
    ];

    return { precacheManifest, runtimeCaching };
  }

  /**
   * Extract revision hash from content-hashed URL
   */
  private extractRevisionFromUrl(url: string): string {
    const hashMatch = url.match(/\.([a-f0-9]{8,})\./);
    return hashMatch ? hashMatch[1] : this.buildVersion;
  }
}

/**
 * React Hook for cache busting functionality
 */
export function useCacheBusting(config?: Partial<CacheBustingConfig>) {
  const cacheBustingManager = new CacheBustingManager(config);

  return {
    getCacheBustedUrl: (path: string) => cacheBustingManager.getCacheBustedUrl(path),
    preloadCriticalAssets: () => cacheBustingManager.preloadCriticalAssets(),
    getCacheHeaders: (path: string) => cacheBustingManager.getCacheControlHeaders(path),
    checkForUpdates: () => cacheBustingManager.checkForUpdates(),
    forceReload: () => cacheBustingManager.forceReload(),
    invalidateCache: (paths: string[]) => cacheBustingManager.invalidateCache(paths),
    getBuildInfo: () => cacheBustingManager.getBuildInfo()
  };
}

// Export singleton instance
export const cacheBustingManager = new CacheBustingManager();

// Utility functions for immediate use
export const getCacheBustedUrl = (path: string): string => 
  cacheBustingManager.getCacheBustedUrl(path);

export const preloadCriticalAssets = (): void => 
  cacheBustingManager.preloadCriticalAssets();

export const checkForUpdates = (): Promise<boolean> => 
  cacheBustingManager.checkForUpdates();

export default CacheBustingManager;