/**
 * Advanced Caching Strategies System
 * 
 * Implements intelligent caching with multiple storage layers, cache invalidation,
 * compression, and performance-aware cache management for optimal user experience.
 */

export interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size in bytes
  compressionThreshold: number; // Compress items larger than this size
  enablePersistence: boolean; // Use localStorage/IndexedDB
  enableCompression: boolean; // Enable compression
  enablePrefetch: boolean; // Enable predictive prefetching
  cleanupInterval: number; // Cleanup interval in milliseconds
  enablePerformanceTracking: boolean;
}

export interface CacheItem<T = any> {
  key: string;
  data: T | string; // Can be original data or compressed string
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  compressed?: boolean;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  totalSize: number;
  itemCount: number;
  averageAccessTime: number;
  evictionCount: number;
  compressionRatio: number;
}

export interface CacheStrategy {
  name: string;
  shouldEvict: (item: CacheItem, allItems: CacheItem[]) => boolean;
  priority: (item: CacheItem) => number;
}

class AdvancedCacheManager {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheItem> = new Map();
  private stats: CacheStats;
  private cleanupInterval?: number;
  private strategies: Map<string, CacheStrategy> = new Map();
  private prefetchQueue: Set<string> = new Set();
  private performanceTimings: Map<string, number[]> = new Map();

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 50 * 1024 * 1024, // 50MB
      compressionThreshold: 1024, // 1KB
      enablePersistence: true,
      enableCompression: true,
      enablePrefetch: true,
      cleanupInterval: 60 * 1000, // 1 minute
      enablePerformanceTracking: true,
      ...config
    };

    this.stats = {
      hitRate: 0,
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      totalSize: 0,
      itemCount: 0,
      averageAccessTime: 0,
      evictionCount: 0,
      compressionRatio: 0
    };

    this.initializeStrategies();
    this.startCleanupProcess();
    this.loadPersistedCache();
  }

  /**
   * Initialize cache eviction strategies
   */
  private initializeStrategies(): void {
    // Least Recently Used (LRU)
    this.strategies.set('lru', {
      name: 'LRU',
      shouldEvict: (item, allItems) => {
        const sortedByAccess = allItems.sort((a, b) => a.lastAccessed - b.lastAccessed);
        return sortedByAccess.indexOf(item) < sortedByAccess.length * 0.2; // Evict oldest 20%
      },
      priority: (item) => item.lastAccessed
    });

    // Least Frequently Used (LFU)
    this.strategies.set('lfu', {
      name: 'LFU',
      shouldEvict: (item, allItems) => {
        const sortedByFrequency = allItems.sort((a, b) => a.accessCount - b.accessCount);
        return sortedByFrequency.indexOf(item) < sortedByFrequency.length * 0.2;
      },
      priority: (item) => item.accessCount
    });

    // Time-based TTL
    this.strategies.set('ttl', {
      name: 'TTL',
      shouldEvict: (item) => Date.now() > (item.timestamp + item.ttl),
      priority: (item) => item.timestamp + item.ttl
    });

    // Size-based eviction
    this.strategies.set('size', {
      name: 'Size',
      shouldEvict: (item, allItems) => {
        const totalSize = allItems.reduce((sum, i) => sum + i.size, 0);
        return totalSize > this.config.maxSize && item.size > this.config.compressionThreshold;
      },
      priority: (item) => -item.size // Larger items have lower priority
    });

    // Adaptive strategy based on usage patterns
    this.strategies.set('adaptive', {
      name: 'Adaptive',
      shouldEvict: (item, allItems) => {
        const score = this.calculateAdaptiveScore(item);
        const avgScore = allItems.reduce((sum, i) => sum + this.calculateAdaptiveScore(i), 0) / allItems.length;
        return score < avgScore * 0.5;
      },
      priority: (item) => this.calculateAdaptiveScore(item)
    });
  }

  /**
   * Calculate adaptive score for cache items
   */
  private calculateAdaptiveScore(item: CacheItem): number {
    const now = Date.now();
    const ageScore = 1 - Math.min((now - item.timestamp) / item.ttl, 1);
    const frequencyScore = Math.log(item.accessCount + 1);
    const recencyScore = 1 - Math.min((now - item.lastAccessed) / (60 * 60 * 1000), 1); // 1 hour
    const sizeScore = 1 - Math.min(item.size / this.config.compressionThreshold, 1);
    
    return (ageScore * 0.3) + (frequencyScore * 0.3) + (recencyScore * 0.3) + (sizeScore * 0.1);
  }

  /**
   * Store item in cache
   */
  async set<T>(
    key: string, 
    data: T, 
    options?: {
      ttl?: number;
      strategy?: string;
      metadata?: Record<string, any>;
      priority?: number;
    }
  ): Promise<void> {
    const startTime = this.config.enablePerformanceTracking ? performance.now() : 0;
    
    try {
      const ttl = options?.ttl || this.config.defaultTTL;
      let serializedData = JSON.stringify(data);
      let compressed = false;
      
      // Compress if enabled and data is large enough
      if (this.config.enableCompression && serializedData.length > this.config.compressionThreshold) {
        serializedData = await this.compressData(serializedData);
        compressed = true;
      }
      
      const item: CacheItem<T> = {
        key,
        data: compressed ? serializedData : data,
        timestamp: Date.now(),
        ttl,
        accessCount: 0,
        lastAccessed: Date.now(),
        size: new Blob([serializedData]).size,
        compressed,
        metadata: options?.metadata
      };

      // Check if we need to evict items
      await this.ensureSpace(item.size);
      
      this.memoryCache.set(key, item);
      this.updateStats('set', item.size);
      
      // Persist to storage if enabled
      if (this.config.enablePersistence) {
        await this.persistItem(item);
      }
      
      // Track performance
      if (this.config.enablePerformanceTracking) {
        this.trackPerformance('set', performance.now() - startTime);
      }
      
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Retrieve item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = this.config.enablePerformanceTracking ? performance.now() : 0;
    
    try {
      let item = this.memoryCache.get(key);
      
      // Try to load from persistent storage if not in memory
      if (!item && this.config.enablePersistence) {
        item = await this.loadPersistedItem(key);
        if (item) {
          this.memoryCache.set(key, item);
        }
      }
      
      if (!item) {
        this.stats.totalMisses++;
        this.updateHitRate();
        return null;
      }
      
      // Check if expired
      if (Date.now() > (item.timestamp + item.ttl)) {
        await this.delete(key);
        this.stats.totalMisses++;
        this.updateHitRate();
        return null;
      }
      
      // Update access statistics
      item.accessCount++;
      item.lastAccessed = Date.now();
      
      this.stats.totalHits++;
      this.updateHitRate();
      
      // Decompress if needed
      let data = item.data;
      if (item.compressed && typeof data === 'string') {
        data = await this.decompressData(data);
        data = JSON.parse(data);
      }
      
      // Track performance
      if (this.config.enablePerformanceTracking) {
        this.trackPerformance('get', performance.now() - startTime);
      }
      
      // Trigger prefetch for related items
      if (this.config.enablePrefetch) {
        this.triggerPrefetch(key);
      }
      
      return data as T;
      
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.totalMisses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Delete item from cache
   */
  async delete(key: string): Promise<boolean> {
    const item = this.memoryCache.get(key);
    if (!item) return false;
    
    this.memoryCache.delete(key);
    this.updateStats('delete', -item.size);
    
    // Remove from persistent storage
    if (this.config.enablePersistence) {
      await this.removePersistedItem(key);
    }
    
    return true;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const item = this.memoryCache.get(key);
    if (!item) return false;
    
    // Check if expired
    if (Date.now() > (item.timestamp + item.ttl)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.resetStats();
    
    if (this.config.enablePersistence) {
      await this.clearPersistedCache();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Ensure there's enough space for new item
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = Array.from(this.memoryCache.values())
      .reduce((sum, item) => sum + item.size, 0);
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }
    
    // Use adaptive strategy by default
    const strategy = this.strategies.get('adaptive')!;
    const allItems = Array.from(this.memoryCache.values());
    
    // Sort by priority (lowest first for eviction)
    const itemsToEvict = allItems
      .filter(item => strategy.shouldEvict(item, allItems))
      .sort((a, b) => strategy.priority(a) - strategy.priority(b));
    
    let freedSpace = 0;
    for (const item of itemsToEvict) {
      if (freedSpace >= requiredSize) break;
      
      await this.delete(item.key);
      freedSpace += item.size;
      this.stats.evictionCount++;
    }
  }

  /**
   * Compress data using built-in compression
   */
  private async compressData(data: string): Promise<string> {
    try {
      // Use CompressionStream if available (modern browsers)
      if ('CompressionStream' in window) {
        const stream = new (window as any).CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(new TextEncoder().encode(data));
        writer.close();
        
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
      }
      
      // Fallback to LZ-string or similar compression library
      // For now, return original data
      return data;
      
    } catch (error) {
      console.error('Compression error:', error);
      return data;
    }
  }

  /**
   * Decompress data
   */
  private async decompressData(compressedData: string): Promise<string> {
    try {
      // Use DecompressionStream if available
      if ('DecompressionStream' in window) {
        const compressed = new Uint8Array(
          atob(compressedData).split('').map(char => char.charCodeAt(0))
        );
        
        const stream = new (window as any).DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(compressed);
        writer.close();
        
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        
        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        return new TextDecoder().decode(decompressed);
      }
      
      // Fallback
      return compressedData;
      
    } catch (error) {
      console.error('Decompression error:', error);
      return compressedData;
    }
  }

  /**
   * Persist item to storage
   */
  private async persistItem(item: CacheItem): Promise<void> {
    try {
      if ('indexedDB' in window) {
        // Use IndexedDB for better performance and larger storage
        await this.storeInIndexedDB(item);
      } else {
        // Fallback to localStorage
        localStorage.setItem(`cache_${item.key}`, JSON.stringify(item));
      }
    } catch (error) {
      console.error('Persistence error:', error);
    }
  }

  /**
   * Load persisted item
   */
  private async loadPersistedItem(key: string): Promise<CacheItem | undefined> {
    try {
      if ('indexedDB' in window) {
        return await this.loadFromIndexedDB(key);
      } else {
        const stored = localStorage.getItem(`cache_${key}`);
        return stored ? JSON.parse(stored) : undefined;
      }
    } catch (error) {
      console.error('Load persistence error:', error);
      return undefined;
    }
  }

  /**
   * Remove persisted item
   */
  private async removePersistedItem(key: string): Promise<void> {
    try {
      if ('indexedDB' in window) {
        await this.removeFromIndexedDB(key);
      } else {
        localStorage.removeItem(`cache_${key}`);
      }
    } catch (error) {
      console.error('Remove persistence error:', error);
    }
  }

  /**
   * IndexedDB operations
   */
  private async storeInIndexedDB(item: CacheItem): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AdvancedCache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        
        store.put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('cache', { keyPath: 'key' });
      };
    });
  }

  private async loadFromIndexedDB(key: string): Promise<CacheItem | undefined> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AdvancedCache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['cache'], 'readonly');
        const store = transaction.objectStore('cache');
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => resolve(getRequest.result || undefined);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  private async removeFromIndexedDB(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AdvancedCache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        
        store.delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  /**
   * Clear persisted cache
   */
  private async clearPersistedCache(): Promise<void> {
    try {
      if ('indexedDB' in window) {
        await new Promise<void>((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase('AdvancedCache');
          deleteReq.onsuccess = () => resolve();
          deleteReq.onerror = () => reject(deleteReq.error);
        });
      } else {
        // Clear localStorage cache items
        Object.keys(localStorage)
          .filter(key => key.startsWith('cache_'))
          .forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      console.error('Clear persistence error:', error);
    }
  }

  /**
   * Load persisted cache on initialization
   */
  private async loadPersistedCache(): Promise<void> {
    if (!this.config.enablePersistence) return;
    
    try {
      // This would load all persisted items
      // Simplified for demo
    } catch (error) {
      console.error('Load persisted cache error:', error);
    }
  }

  /**
   * Trigger prefetch for related items
   */
  private triggerPrefetch(key: string): void {
    // Implement predictive prefetching based on usage patterns
    // This is a simplified implementation
    const relatedKeys = this.predictRelatedKeys(key);
    
    relatedKeys.forEach(relatedKey => {
      if (!this.has(relatedKey) && !this.prefetchQueue.has(relatedKey)) {
        this.prefetchQueue.add(relatedKey);
        // Trigger async prefetch
        this.performPrefetch(relatedKey);
      }
    });
  }

  /**
   * Predict related keys for prefetching
   */
  private predictRelatedKeys(key: string): string[] {
    // Implement machine learning or pattern-based prediction
    // For now, return simple related keys
    const related: string[] = [];
    
    if (key.includes('email')) {
      related.push('email-list', 'email-analytics');
    }
    
    if (key.includes('analytics')) {
      related.push('dashboard-metrics', 'performance-data');
    }
    
    return related;
  }

  /**
   * Perform actual prefetch operation
   */
  private async performPrefetch(key: string): Promise<void> {
    // This would fetch data from API and cache it
    // Implementation depends on specific use case
    setTimeout(() => {
      this.prefetchQueue.delete(key);
    }, 1000);
  }

  /**
   * Update cache statistics
   */
  private updateStats(operation: 'set' | 'get' | 'delete', sizeChange: number = 0): void {
    switch (operation) {
      case 'set':
        this.stats.itemCount++;
        this.stats.totalSize += sizeChange;
        break;
      case 'delete':
        this.stats.itemCount--;
        this.stats.totalSize += sizeChange; // sizeChange is negative for delete
        break;
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? (this.stats.totalHits / total) * 100 : 0;
    this.stats.missRate = 100 - this.stats.hitRate;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hitRate: 0,
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      totalSize: 0,
      itemCount: 0,
      averageAccessTime: 0,
      evictionCount: 0,
      compressionRatio: 0
    };
  }

  /**
   * Track performance timings
   */
  private trackPerformance(operation: string, time: number): void {
    if (!this.performanceTimings.has(operation)) {
      this.performanceTimings.set(operation, []);
    }
    
    const timings = this.performanceTimings.get(operation)!;
    timings.push(time);
    
    // Keep only recent timings
    if (timings.length > 100) {
      timings.splice(0, timings.length - 100);
    }
    
    // Update average access time
    const allTimings = Array.from(this.performanceTimings.values()).flat();
    this.stats.averageAccessTime = allTimings.reduce((sum, t) => sum + t, 0) / allTimings.length;
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.runCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Run cache cleanup
   */
  private async runCleanup(): Promise<void> {
    const strategy = this.strategies.get('ttl')!;
    const allItems = Array.from(this.memoryCache.values());
    
    for (const item of allItems) {
      if (strategy.shouldEvict(item, allItems)) {
        await this.delete(item.key);
      }
    }
  }

  /**
   * Dispose cache manager
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const advancedCache = new AdvancedCacheManager();

// React hook for cache management
export function useAdvancedCache() {
  return {
    cache: advancedCache,
    set: <T>(key: string, data: T, options?: any) => advancedCache.set(key, data, options),
    get: <T>(key: string) => advancedCache.get<T>(key),
    delete: (key: string) => advancedCache.delete(key),
    has: (key: string) => advancedCache.has(key),
    clear: () => advancedCache.clear(),
    getStats: () => advancedCache.getStats()
  };
}

export default AdvancedCacheManager;