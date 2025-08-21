/**
 * Cache-Busting Utility Tests
 * Critical test coverage for cache management and asset versioning
 */

import { CacheBustingManager } from '../cache-busting';

// Mock service worker registration
const mockServiceWorker = {
  register: jest.fn(),
  ready: Promise.resolve({
    active: {
      postMessage: jest.fn()
    }
  }),
  controller: {
    postMessage: jest.fn()
  }
};

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock asset manifest
const mockAssetManifest = {
  'static/js/main.js': 'static/js/main.abc123.js',
  'static/css/main.css': 'static/css/main.def456.css',
  'static/media/logo.svg': 'static/media/logo.ghi789.svg',
  'index.html': 'index.html'
};

describe('CacheBustingManager', () => {
  let cacheBustingManager: CacheBustingManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorker,
      writable: true
    });
    
    // Reset localStorage
    localStorage.clear();
    
    // Create fresh instance
    cacheBustingManager = new CacheBustingManager();
  });

  afterEach(() => {
    // Clean up
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with correct default values', () => {
      expect(cacheBustingManager.isServiceWorkerSupported()).toBe(true);
      expect(cacheBustingManager.getAssetManifest()).toEqual({});
      expect(cacheBustingManager.getVersionInfo()).toEqual({
        buildTime: null,
        gitCommit: null,
        version: null
      });
    });

    it('detects service worker support correctly', () => {
      // Test with service worker support
      expect(cacheBustingManager.isServiceWorkerSupported()).toBe(true);
      
      // Test without service worker support
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true
      });
      
      const managerWithoutSW = new CacheBustingManager();
      expect(managerWithoutSW.isServiceWorkerSupported()).toBe(false);
    });

    it('loads configuration from environment', () => {
      // Mock environment variables
      process.env.REACT_APP_BUILD_TIME = '2024-01-15T10:00:00Z';
      process.env.REACT_APP_GIT_COMMIT = 'abc123def';
      process.env.REACT_APP_VERSION = '1.2.3';
      
      const manager = new CacheBustingManager();
      const versionInfo = manager.getVersionInfo();
      
      expect(versionInfo.buildTime).toBe('2024-01-15T10:00:00Z');
      expect(versionInfo.gitCommit).toBe('abc123def');
      expect(versionInfo.version).toBe('1.2.3');
    });
  });

  describe('Asset Manifest Loading', () => {
    it('loads asset manifest successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAssetManifest
      });
      
      await cacheBustingManager.loadAssetManifest();
      
      expect(mockFetch).toHaveBeenCalledWith('/asset-manifest.json');
      expect(cacheBustingManager.getAssetManifest()).toEqual(mockAssetManifest);
    });

    it('handles manifest loading errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      await cacheBustingManager.loadAssetManifest();
      
      expect(cacheBustingManager.getAssetManifest()).toEqual({});
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load asset manifest')
      );
    });

    it('handles manifest parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });
      
      await cacheBustingManager.loadAssetManifest();
      
      expect(cacheBustingManager.getAssetManifest()).toEqual({});
    });

    it('handles 404 response for missing manifest', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
      
      await cacheBustingManager.loadAssetManifest();
      
      expect(cacheBustingManager.getAssetManifest()).toEqual({});
    });
  });

  describe('Cache-Busted URL Generation', () => {
    beforeEach(() => {
      cacheBustingManager['assetManifest'] = mockAssetManifest;
    });

    it('returns cache-busted URL for known assets', () => {
      const url = cacheBustingManager.getCacheBustedUrl('static/js/main.js');
      expect(url).toBe('static/js/main.abc123.js');
    });

    it('returns original URL for unknown assets', () => {
      const url = cacheBustingManager.getCacheBustedUrl('static/js/unknown.js');
      expect(url).toBe('static/js/unknown.js');
    });

    it('handles URLs with leading slash', () => {
      const url = cacheBustingManager.getCacheBustedUrl('/static/js/main.js');
      expect(url).toBe('static/js/main.abc123.js');
    });

    it('handles full URLs correctly', () => {
      const fullUrl = 'https://example.com/static/js/main.js';
      const url = cacheBustingManager.getCacheBustedUrl(fullUrl);
      expect(url).toBe(fullUrl); // Should return as-is for full URLs
    });

    it('adds timestamp fallback for unknown assets in development', () => {
      process.env.NODE_ENV = 'development';
      
      const manager = new CacheBustingManager();
      const url = manager.getCacheBustedUrl('static/js/unknown.js');
      
      expect(url).toMatch(/static\/js\/unknown\.js\?t=\d+/);
    });
  });

  describe('Service Worker Integration', () => {
    it('registers service worker successfully', async () => {
      mockServiceWorker.register.mockResolvedValueOnce({
        installing: null,
        waiting: null,
        active: { postMessage: jest.fn() }
      });
      
      const result = await cacheBustingManager.registerServiceWorker('/sw.js');
      
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
      expect(result).toBe(true);
    });

    it('handles service worker registration failure', async () => {
      mockServiceWorker.register.mockRejectedValueOnce(new Error('Registration failed'));
      
      const result = await cacheBustingManager.registerServiceWorker('/sw.js');
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Service worker registration failed')
      );
    });

    it('skips registration when service worker not supported', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true
      });
      
      const manager = new CacheBustingManager();
      const result = await manager.registerServiceWorker('/sw.js');
      
      expect(result).toBe(false);
    });

    it('sends cache update message to service worker', async () => {
      const mockController = { postMessage: jest.fn() };
      mockServiceWorker.ready = Promise.resolve({
        active: mockController
      });
      
      await cacheBustingManager.notifyServiceWorkerUpdate();
      
      expect(mockController.postMessage).toHaveBeenCalledWith({
        action: 'UPDATE_CACHE',
        manifest: expect.any(Object)
      });
    });
  });

  describe('Version Checking', () => {
    beforeEach(() => {
      cacheBustingManager['versionInfo'] = {
        buildTime: '2024-01-15T10:00:00Z',
        gitCommit: 'abc123',
        version: '1.0.0'
      };
    });

    it('detects when update is available', async () => {
      const newerVersion = {
        buildTime: '2024-01-15T11:00:00Z',
        gitCommit: 'def456',
        version: '1.0.1'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newerVersion
      });
      
      const hasUpdate = await cacheBustingManager.checkForUpdates();
      
      expect(hasUpdate).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/version.json');
    });

    it('detects when no update is available', async () => {
      const sameVersion = {
        buildTime: '2024-01-15T10:00:00Z',
        gitCommit: 'abc123',
        version: '1.0.0'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sameVersion
      });
      
      const hasUpdate = await cacheBustingManager.checkForUpdates();
      
      expect(hasUpdate).toBe(false);
    });

    it('handles version check errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const hasUpdate = await cacheBustingManager.checkForUpdates();
      
      expect(hasUpdate).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check for updates')
      );
    });

    it('compares versions by build time when available', async () => {
      const olderVersion = {
        buildTime: '2024-01-15T09:00:00Z',
        gitCommit: 'xyz789',
        version: '1.0.0'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => olderVersion
      });
      
      const hasUpdate = await cacheBustingManager.checkForUpdates();
      expect(hasUpdate).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('clears all caches successfully', async () => {
      const mockCache = {
        keys: jest.fn().mockResolvedValue(['cache1', 'cache2']),
        delete: jest.fn().mockResolvedValue(true)
      };
      
      global.caches = {
        keys: jest.fn().mockResolvedValue(['cache1', 'cache2']),
        delete: jest.fn().mockResolvedValue(true)
      };
      
      await cacheBustingManager.clearAllCaches();
      
      expect(global.caches.keys).toHaveBeenCalled();
      expect(global.caches.delete).toHaveBeenCalledWith('cache1');
      expect(global.caches.delete).toHaveBeenCalledWith('cache2');
    });

    it('handles cache clearing errors', async () => {
      global.caches = {
        keys: jest.fn().mockRejectedValue(new Error('Cache error'))
      };
      
      await cacheBustingManager.clearAllCaches();
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear caches')
      );
    });

    it('forces page reload after cache clear', async () => {
      const mockReload = jest.fn();
      Object.defineProperty(window.location, 'reload', {
        value: mockReload,
        writable: true
      });
      
      global.caches = {
        keys: jest.fn().mockResolvedValue([]),
        delete: jest.fn()
      };
      
      await cacheBustingManager.forceReload();
      
      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('Storage Management', () => {
    it('persists version info to localStorage', () => {
      const versionInfo = {
        buildTime: '2024-01-15T10:00:00Z',
        gitCommit: 'abc123',
        version: '1.0.0'
      };
      
      cacheBustingManager.setVersionInfo(versionInfo);
      
      const stored = localStorage.getItem('cache-busting-version');
      expect(JSON.parse(stored!)).toEqual(versionInfo);
    });

    it('loads version info from localStorage', () => {
      const versionInfo = {
        buildTime: '2024-01-15T10:00:00Z',
        gitCommit: 'abc123',
        version: '1.0.0'
      };
      
      localStorage.setItem('cache-busting-version', JSON.stringify(versionInfo));
      
      const manager = new CacheBustingManager();
      expect(manager.getVersionInfo()).toEqual(versionInfo);
    });

    it('handles corrupted localStorage data', () => {
      localStorage.setItem('cache-busting-version', 'invalid-json');
      
      const manager = new CacheBustingManager();
      expect(manager.getVersionInfo()).toEqual({
        buildTime: null,
        gitCommit: null,
        version: null
      });
    });

    it('persists asset manifest to localStorage', () => {
      cacheBustingManager.setAssetManifest(mockAssetManifest);
      
      const stored = localStorage.getItem('cache-busting-manifest');
      expect(JSON.parse(stored!)).toEqual(mockAssetManifest);
    });
  });

  describe('Event Handling', () => {
    it('sets up update check listeners', () => {
      const addEventListener = jest.spyOn(window, 'addEventListener');
      
      cacheBustingManager.setupUpdateChecker();
      
      expect(addEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('checks for updates on window focus', async () => {
      const checkForUpdates = jest.spyOn(cacheBustingManager, 'checkForUpdates');
      checkForUpdates.mockResolvedValue(false);
      
      cacheBustingManager.setupUpdateChecker();
      
      // Simulate window focus
      window.dispatchEvent(new Event('focus'));
      
      expect(checkForUpdates).toHaveBeenCalled();
    });

    it('emits update available event', () => {
      const eventListener = jest.fn();
      window.addEventListener('cache-update-available', eventListener);
      
      cacheBustingManager.emitUpdateEvent();
      
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cache-update-available'
        })
      );
    });
  });

  describe('Performance', () => {
    it('debounces rapid update checks', async () => {
      const checkForUpdates = jest.spyOn(cacheBustingManager, 'checkForUpdates');
      checkForUpdates.mockResolvedValue(false);
      
      cacheBustingManager.setupUpdateChecker();
      
      // Trigger multiple rapid checks
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('caches manifest requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAssetManifest
      });
      
      await cacheBustingManager.loadAssetManifest();
      await cacheBustingManager.loadAssetManifest();
      
      // Should only fetch once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles concurrent manifest loads', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAssetManifest
      });
      
      // Start multiple concurrent loads
      const promises = [
        cacheBustingManager.loadAssetManifest(),
        cacheBustingManager.loadAssetManifest(),
        cacheBustingManager.loadAssetManifest()
      ];
      
      await Promise.all(promises);
      
      // Should only fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery', () => {
    it('recovers from service worker errors', async () => {
      mockServiceWorker.register.mockRejectedValueOnce(new Error('First attempt failed'));
      mockServiceWorker.register.mockResolvedValueOnce({ active: null });
      
      // First attempt should fail
      let result = await cacheBustingManager.registerServiceWorker('/sw.js');
      expect(result).toBe(false);
      
      // Second attempt should succeed
      result = await cacheBustingManager.registerServiceWorker('/sw.js');
      expect(result).toBe(true);
    });

    it('falls back gracefully when caches API unavailable', async () => {
      delete (global as any).caches;
      
      await cacheBustingManager.clearAllCaches();
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache API not available')
      );
    });

    it('continues operation with partial failures', async () => {
      // Mock partial manifest loading failure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'static/js/main.js': 'static/js/main.abc123.js'
          // Missing other assets
        })
      });
      
      await cacheBustingManager.loadAssetManifest();
      
      const manifest = cacheBustingManager.getAssetManifest();
      expect(manifest['static/js/main.js']).toBe('static/js/main.abc123.js');
      expect(manifest['static/css/main.css']).toBeUndefined();
    });
  });
});