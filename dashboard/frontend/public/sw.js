/**
 * Service Worker for Cache Busting and Performance
 * Implements proper cache strategies with content-hashed filenames
 */

const CACHE_NAME = 'email-intelligence-v1';
const PRECACHE_NAME = 'email-intelligence-precache-v1';
const RUNTIME_CACHE_NAME = 'email-intelligence-runtime-v1';

// Assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/static/js/runtime-main.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
  // Immutable assets (with content hashes) - Cache First with long TTL
  IMMUTABLE: {
    pattern: /\.(js|css)$/,
    strategy: 'CacheFirst',
    maxAge: 365 * 24 * 60 * 60, // 1 year
    maxEntries: 100
  },
  
  // Images and media - Cache First with medium TTL
  MEDIA: {
    pattern: /\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$/,
    strategy: 'CacheFirst',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    maxEntries: 200
  },
  
  // API calls - Network First with short fallback cache
  API: {
    pattern: /^https?:.*\/api\//,
    strategy: 'NetworkFirst',
    maxAge: 5 * 60, // 5 minutes
    maxEntries: 50
  },
  
  // HTML pages - Network First with stale-while-revalidate
  HTML: {
    pattern: /\.html$/,
    strategy: 'StaleWhileRevalidate',
    maxAge: 24 * 60 * 60, // 1 day
    maxEntries: 25
  }
};

/**
 * Install event - precache critical resources
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        // Open precache
        const precache = await caches.open(PRECACHE_NAME);
        
        // Fetch and cache precache URLs
        await precache.addAll(PRECACHE_URLS);
        
        // Try to load asset manifest and cache hashed assets
        try {
          const manifestResponse = await fetch('/asset-manifest.json');
          if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            const assetUrls = Object.values(manifest.files || {});
            
            if (assetUrls.length > 0) {
              await precache.addAll(assetUrls.slice(0, 10)); // Cache first 10 critical assets
              console.log('[SW] Precached', assetUrls.length, 'assets from manifest');
            }
          }
        } catch (manifestError) {
          console.warn('[SW] Could not load asset manifest:', manifestError);
        }
        
        console.log('[SW] Precaching complete');
        
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Precaching failed:', error);
      }
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name !== CACHE_NAME && 
          name !== PRECACHE_NAME && 
          name !== RUNTIME_CACHE_NAME
        );
        
        await Promise.all(oldCaches.map(name => caches.delete(name)));
        
        if (oldCaches.length > 0) {
          console.log('[SW] Deleted', oldCaches.length, 'old caches');
        }
        
        // Take control of all clients
        await clients.claim();
        
        console.log('[SW] Service worker activated');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

/**
 * Fetch event - implement cache strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== 'GET' || url.protocol.startsWith('chrome-extension:')) {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

/**
 * Handle fetch with appropriate cache strategy
 */
async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Check if this is a content-hashed asset (immutable)
    if (isContentHashedAsset(url.pathname)) {
      return await handleImmutableAsset(request);
    }
    
    // API requests
    if (CACHE_STRATEGIES.API.pattern.test(request.url)) {
      return await handleNetworkFirst(request, RUNTIME_CACHE_NAME, CACHE_STRATEGIES.API);
    }
    
    // Media assets
    if (CACHE_STRATEGIES.MEDIA.pattern.test(url.pathname)) {
      return await handleCacheFirst(request, RUNTIME_CACHE_NAME, CACHE_STRATEGIES.MEDIA);
    }
    
    // HTML pages
    if (CACHE_STRATEGIES.HTML.pattern.test(url.pathname) || url.pathname === '/') {
      return await handleStaleWhileRevalidate(request, RUNTIME_CACHE_NAME, CACHE_STRATEGIES.HTML);
    }
    
    // JavaScript and CSS (may be hashed or not)
    if (CACHE_STRATEGIES.IMMUTABLE.pattern.test(url.pathname)) {
      return await handleCacheFirst(request, RUNTIME_CACHE_NAME, CACHE_STRATEGIES.IMMUTABLE);
    }
    
    // Default: network only
    return await fetch(request);
    
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    
    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.destination === 'document') {
      const offlineResponse = await caches.match('/');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

/**
 * Check if asset has content hash (is immutable)
 */
function isContentHashedAsset(pathname) {
  // Look for hash pattern in filename
  const hashPattern = /\.[a-f0-9]{8,}\./;
  return hashPattern.test(pathname);
}

/**
 * Handle immutable assets (content-hashed) - Cache First with long TTL
 */
async function handleImmutableAsset(request) {
  const cache = await caches.open(PRECACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Fetch and cache
  const response = await fetch(request);
  if (response.ok) {
    // Clone before caching
    cache.put(request, response.clone());
  }
  
  return response;
}

/**
 * Cache First strategy
 */
async function handleCacheFirst(request, cacheName, strategy) {
  const cache = await caches.open(cacheName);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Check if cache entry is still valid
    const cacheDate = cachedResponse.headers.get('date');
    if (cacheDate) {
      const age = (Date.now() - new Date(cacheDate).getTime()) / 1000;
      if (age < strategy.maxAge) {
        return cachedResponse;
      }
    } else {
      // No date header, assume it's valid
      return cachedResponse;
    }
  }
  
  // Fetch from network
  const response = await fetch(request);
  if (response.ok) {
    // Cache successful responses
    await putInCache(cache, request, response.clone(), strategy);
  }
  
  return response;
}

/**
 * Network First strategy
 */
async function handleNetworkFirst(request, cacheName, strategy) {
  const cache = await caches.open(cacheName);
  
  try {
    // Try network first
    const response = await fetch(request, { 
      // Short timeout for API requests
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      // Cache successful responses
      await putInCache(cache, request, response.clone(), strategy);
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache due to network error:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Stale While Revalidate strategy
 */
async function handleStaleWhileRevalidate(request, cacheName, strategy) {
  const cache = await caches.open(cacheName);
  
  // Get cached response
  const cachedResponse = cache.match(request);
  
  // Fetch fresh response (don't await)
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      putInCache(cache, request, response.clone(), strategy);
    }
    return response;
  }).catch(() => {
    // Ignore fetch errors in background
  });
  
  // Return cached response immediately if available, otherwise wait for network
  const cached = await cachedResponse;
  return cached || await fetchPromise;
}

/**
 * Put response in cache with size management
 */
async function putInCache(cache, request, response, strategy) {
  try {
    // Add timestamp header for cache validation
    const responseToCache = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'sw-cache-timestamp': Date.now().toString()
      }
    });
    
    await cache.put(request, responseToCache);
    
    // Manage cache size
    await manageCacheSize(cache, strategy.maxEntries);
  } catch (error) {
    console.error('[SW] Failed to cache response:', error);
  }
}

/**
 * Manage cache size by removing oldest entries
 */
async function manageCacheSize(cache, maxEntries) {
  if (!maxEntries) return;
  
  try {
    const requests = await cache.keys();
    
    if (requests.length > maxEntries) {
      // Remove oldest entries (simple FIFO)
      const toDelete = requests.slice(0, requests.length - maxEntries);
      await Promise.all(toDelete.map(request => cache.delete(request)));
    }
  } catch (error) {
    console.error('[SW] Cache size management failed:', error);
  }
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'INVALIDATE_CACHE':
      invalidateCache(data.assets);
      break;
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
  }
});

/**
 * Invalidate specific cached assets
 */
async function invalidateCache(assetUrls) {
  try {
    const cacheNames = [PRECACHE_NAME, RUNTIME_CACHE_NAME];
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      await Promise.all(assetUrls.map(url => cache.delete(url)));
    }
    
    console.log('[SW] Invalidated cache for', assetUrls.length, 'assets');
  } catch (error) {
    console.error('[SW] Cache invalidation failed:', error);
  }
}

/**
 * Get total cache size
 */
async function getCacheSize() {
  try {
    let totalSize = 0;
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return {
      bytes: totalSize,
      megabytes: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      caches: cacheNames.length
    };
  } catch (error) {
    console.error('[SW] Failed to calculate cache size:', error);
    return { bytes: 0, megabytes: 0, caches: 0 };
  }
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] Cleared all caches');
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
  }
}

console.log('[SW] Service worker script loaded');