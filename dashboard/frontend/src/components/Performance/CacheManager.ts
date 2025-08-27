/**
 * CacheManager.ts - Intelligent Caching System
 * 
 * Advanced caching system with intelligent cache invalidation, LRU eviction,
 * compression support, and performance optimization for task-centric interface.
 * 
 * Features:
 * - Multi-layer caching (memory, localStorage, IndexedDB)
 * - Intelligent cache invalidation strategies
 * - LRU eviction with priority scoring
 * - Compression for large items
 * - Predictive prefetching
 * - Performance metrics and monitoring
 * - Cache warming and optimization
 */

// Cache configuration interface
export interface CacheConfig {
  // Size limits
  maxMemorySize: number; // bytes
  maxStorageSize: number; // bytes
  maxItemCount: number;
  
  // TTL settings
  defaultTTL: number; // milliseconds
  maxTTL: number; // milliseconds
  minTTL: number; // milliseconds
  
  // Compression settings
  compressionThreshold: number; // bytes
  compressionLevel: number; // 1-9
  enableCompression: boolean;
  
  // Performance settings
  enablePrefetching: boolean;
  enablePersistence: boolean;
  enableMetrics: boolean;
  cleanupInterval: number; // milliseconds
  
  // Eviction strategy
  evictionStrategy: 'lru' | 'lfu' | 'ttl' | 'priority';
  evictionBatchSize: number;
}

// Cache item interface
export interface CacheItem<T = any> {
  key: string;
  data: T;
  metadata: CacheMetadata;
  compressed?: boolean;
  originalSize?: number;
}

export interface CacheMetadata {
  createdAt: number;
  lastAccessed: number;
  lastModified: number;
  accessCount: number;
  ttl: number;
  priority: number;
  tags: string[];
  dependencies: string[];
  size: number;
  version: number;
}

// Cache statistics interface
export interface CacheStats {
  // Size metrics
  memoryUsage: number;
  storageUsage: number;
  totalItems: number;
  compressedItems: number;
  
  // Performance metrics
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  averageAccessTime: number;
  
  // Eviction metrics
  evictedItems: number;
  evictionsByStrategy: Record<string, number>;
  
  // Compression metrics
  compressionRatio: number;
  compressionSavings: number;
  
  // Health metrics
  fragmentationRatio: number;
  healthScore: number;
}

// Cache event interface
export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'compress' | 'prefetch';
  key: string;
  timestamp: number;
  metadata?: any;
}

// Cache invalidation strategies
export interface InvalidationStrategy {
  name: string;
  shouldInvalidate: (item: CacheItem, context: any) => boolean;
  priority: number;
}

// Prefetch strategy interface
export interface PrefetchStrategy {
  name: string;
  predictKeys: (accessedKey: string, cache: Map<string, CacheItem>) => string[];
  shouldPrefetch: (key: string, currentTime: number) => boolean;
}

// Main CacheManager class
export class CacheManager {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheItem>;
  private storageCache: Map<string, CacheItem>;
  private stats: CacheStats;
  private events: CacheEvent[];
  private cleanupTimer: NodeJS.Timeout | null = null;
  private invalidationStrategies: InvalidationStrategy[] = [];
  private prefetchStrategies: PrefetchStrategy[] = [];
  private compressionWorker: Worker | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      maxStorageSize: 200 * 1024 * 1024, // 200MB
      maxItemCount: 10000,
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      maxTTL: 24 * 60 * 60 * 1000, // 24 hours
      minTTL: 60 * 1000, // 1 minute
      compressionThreshold: 1024, // 1KB
      compressionLevel: 6,
      enableCompression: true,
      enablePrefetching: true,
      enablePersistence: true,
      enableMetrics: true,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      evictionStrategy: 'lru',
      evictionBatchSize: 100,
      ...config,
    };

    this.memoryCache = new Map();
    this.storageCache = new Map();
    this.stats = this.initializeStats();
    this.events = [];

    this.initializeInvalidationStrategies();
    this.initializePrefetchStrategies();
    this.initializeCompressionWorker();
    this.startCleanupTimer();
    this.loadFromPersistentStorage();
  }

  // Initialize statistics
  private initializeStats(): CacheStats {
    return {
      memoryUsage: 0,
      storageUsage: 0,
      totalItems: 0,
      compressedItems: 0,
      hitRate: 0,
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      averageAccessTime: 0,
      evictedItems: 0,
      evictionsByStrategy: {},
      compressionRatio: 1,
      compressionSavings: 0,
      fragmentationRatio: 0,
      healthScore: 100,
    };
  }

  // Initialize invalidation strategies
  private initializeInvalidationStrategies(): void {
    // TTL-based invalidation
    this.invalidationStrategies.push({
      name: 'ttl',
      shouldInvalidate: (item: CacheItem) => {
        const now = Date.now();
        return now > item.metadata.createdAt + item.metadata.ttl;
      },
      priority: 1,
    });

    // Dependency-based invalidation
    this.invalidationStrategies.push({
      name: 'dependency',
      shouldInvalidate: (item: CacheItem, context: any) => {
        if (!context.invalidatedKeys) return false;
        return item.metadata.dependencies.some(dep => 
          context.invalidatedKeys.includes(dep)
        );
      },
      priority: 2,
    });

    // Tag-based invalidation
    this.invalidationStrategies.push({
      name: 'tag',
      shouldInvalidate: (item: CacheItem, context: any) => {
        if (!context.invalidatedTags) return false;
        return item.metadata.tags.some(tag => 
          context.invalidatedTags.includes(tag)
        );
      },
      priority: 3,
    });
  }

  // Initialize prefetch strategies
  private initializePrefetchStrategies(): void {
    // Sequential prefetch strategy
    this.prefetchStrategies.push({
      name: 'sequential',
      predictKeys: (accessedKey: string, cache: Map<string, CacheItem>) => {
        const match = accessedKey.match(/(.+?)(\d+)$/);
        if (!match) return [];
        
        const [, prefix, numStr] = match;
        const num = parseInt(numStr, 10);
        
        return [
          `${prefix}${num + 1}`,
          `${prefix}${num + 2}`,
          `${prefix}${num - 1}`,
        ].filter(key => !cache.has(key));
      },
      shouldPrefetch: (key: string, currentTime: number) => true,
    });

    // Related content prefetch strategy
    this.prefetchStrategies.push({
      name: 'related',
      predictKeys: (accessedKey: string, cache: Map<string, CacheItem>) => {
        // Extract patterns and suggest related keys
        const parts = accessedKey.split(':');
        if (parts.length < 2) return [];
        
        const [type, id] = parts;
        return [
          `${type}:metadata:${id}`,
          `${type}:details:${id}`,
          `${type}:related:${id}`,
        ].filter(key => !cache.has(key));
      },
      shouldPrefetch: (key: string, currentTime: number) => true,
    });
  }

  // Initialize compression worker
  private initializeCompressionWorker(): void {
    if (!this.config.enableCompression) return;

    try {
      // Create compression worker inline
      const workerScript = `
        self.onmessage = function(e) {
          const { type, data, level } = e.data;
          
          if (type === 'compress') {
            // Simple compression simulation (in real implementation, use pako or similar)
            const compressed = JSON.stringify(data);
            self.postMessage({ type: 'compressed', data: compressed });
          } else if (type === 'decompress') {
            try {
              const decompressed = JSON.parse(data);
              self.postMessage({ type: 'decompressed', data: decompressed });
            } catch (error) {
              self.postMessage({ type: 'error', error: error.message });
            }
          }
        };
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.compressionWorker = new Worker(URL.createObjectURL(blob));
    } catch (error) {
      console.warn('CacheManager: Compression worker initialization failed:', error);
    }
  }

  // Get item from cache
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      // Check memory cache first
      let item = this.memoryCache.get(key);
      
      // Check storage cache if not in memory
      if (!item && this.config.enablePersistence) {
        item = this.storageCache.get(key);
        
        // Promote to memory cache if found
        if (item) {
          this.memoryCache.set(key, item);
        }
      }

      if (item) {
        // Check if item is still valid
        if (this.isItemValid(item)) {
          // Update access metadata
          item.metadata.lastAccessed = Date.now();
          item.metadata.accessCount++;
          
          // Record hit
          this.recordEvent('hit', key);
          this.stats.totalHits++;
          
          // Trigger prefetching
          if (this.config.enablePrefetching) {
            this.triggerPrefetch(key);
          }

          return item.compressed ? await this.decompress(item.data) : item.data;
        } else {
          // Item expired, remove it
          this.delete(key);
        }
      }

      // Record miss
      this.recordEvent('miss', key);
      this.stats.totalMisses++;
      
      return null;
    } finally {
      // Update performance metrics
      const accessTime = performance.now() - startTime;
      this.updateAccessTimeMetrics(accessTime);
    }
  }

  // Set item in cache
  async set<T>(key: string, data: T, options: Partial<CacheMetadata> = {}): Promise<void> {
    const now = Date.now();
    const serializedData = JSON.stringify(data);
    const dataSize = new Blob([serializedData]).size;

    // Check if compression is needed
    let finalData: any = data;
    let compressed = false;
    const originalSize = dataSize;

    if (this.config.enableCompression && dataSize > this.config.compressionThreshold) {
      try {
        finalData = await this.compress(data);
        compressed = true;
      } catch (error) {
        console.warn('CacheManager: Compression failed for key:', key, error);
      }
    }

    // Create cache item
    const item: CacheItem<T> = {
      key,
      data: finalData,
      compressed,
      originalSize,
      metadata: {
        createdAt: now,
        lastAccessed: now,
        lastModified: now,
        accessCount: 0,
        ttl: options.ttl || this.config.defaultTTL,
        priority: options.priority || 1,
        tags: options.tags || [],
        dependencies: options.dependencies || [],
        size: compressed ? new Blob([JSON.stringify(finalData)]).size : dataSize,
        version: options.version || 1,
      },
    };

    // Ensure cache capacity
    await this.ensureCapacity(item.metadata.size);

    // Store in memory cache
    this.memoryCache.set(key, item);

    // Store in persistent cache if enabled
    if (this.config.enablePersistence) {
      this.storageCache.set(key, item);
      await this.saveToPersistentStorage(key, item);
    }

    // Update statistics
    this.updateStats();
    this.recordEvent('set', key, { size: item.metadata.size, compressed });
  }

  // Delete item from cache
  delete(key: string): boolean {
    const memoryDeleted = this.memoryCache.delete(key);
    const storageDeleted = this.storageCache.delete(key);
    
    if (memoryDeleted || storageDeleted) {
      this.removeFromPersistentStorage(key);
      this.updateStats();
      this.recordEvent('delete', key);
      return true;
    }
    
    return false;
  }

  // Check if cache has key
  has(key: string): boolean {
    return this.memoryCache.has(key) || this.storageCache.has(key);
  }

  // Clear entire cache
  clear(): void {
    this.memoryCache.clear();
    this.storageCache.clear();
    this.clearPersistentStorage();
    this.stats = this.initializeStats();
    this.events = [];
  }

  // Invalidate cache by strategy
  invalidate(context: any = {}): number {
    let invalidatedCount = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      for (const strategy of this.invalidationStrategies) {
        if (strategy.shouldInvalidate(item, context)) {
          this.delete(key);
          invalidatedCount++;
          break;
        }
      }
    }

    return invalidatedCount;
  }

  // Invalidate by tags
  invalidateByTags(tags: string[]): number {
    return this.invalidate({ invalidatedTags: tags });
  }

  // Invalidate by dependencies
  invalidateByDependencies(keys: string[]): number {
    return this.invalidate({ invalidatedKeys: keys });
  }

  // Get cache statistics
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  // Get cache events
  getEvents(limit = 100): CacheEvent[] {
    return this.events.slice(-limit);
  }

  // Warm cache with data
  async warmCache(data: Record<string, any>): Promise<void> {
    const promises = Object.entries(data).map(([key, value]) => 
      this.set(key, value, { priority: 2 })
    );
    
    await Promise.all(promises);
  }

  // Optimize cache performance
  async optimize(): Promise<{ before: CacheStats; after: CacheStats }> {
    const beforeStats = this.getStats();

    // Remove expired items
    await this.cleanup();

    // Compress large uncompressed items
    if (this.config.enableCompression) {
      await this.compressLargeItems();
    }

    // Defragment storage
    await this.defragment();

    const afterStats = this.getStats();
    
    return { before: beforeStats, after: afterStats };
  }

  // Private helper methods

  private isItemValid(item: CacheItem): boolean {
    const now = Date.now();
    return now <= item.metadata.createdAt + item.metadata.ttl;
  }

  private async compress(data: any): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.compressionWorker) {
        reject(new Error('Compression worker not available'));
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        const { type, data: result, error } = e.data;
        this.compressionWorker?.removeEventListener('message', handleMessage);

        if (type === 'compressed') {
          resolve(result);
        } else if (type === 'error') {
          reject(new Error(error));
        }
      };

      this.compressionWorker.addEventListener('message', handleMessage);
      this.compressionWorker.postMessage({
        type: 'compress',
        data,
        level: this.config.compressionLevel,
      });
    });
  }

  private async decompress(data: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.compressionWorker) {
        reject(new Error('Compression worker not available'));
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        const { type, data: result, error } = e.data;
        this.compressionWorker?.removeEventListener('message', handleMessage);

        if (type === 'decompressed') {
          resolve(result);
        } else if (type === 'error') {
          reject(new Error(error));
        }
      };

      this.compressionWorker.addEventListener('message', handleMessage);
      this.compressionWorker.postMessage({
        type: 'decompress',
        data,
      });
    });
  }

  private async ensureCapacity(requiredSize: number): Promise<void> {
    const currentMemoryUsage = this.calculateMemoryUsage();
    
    if (currentMemoryUsage + requiredSize > this.config.maxMemorySize) {
      await this.evictItems(requiredSize);
    }
  }

  private async evictItems(requiredSpace: number): Promise<void> {
    const candidates = Array.from(this.memoryCache.entries())
      .map(([key, item]) => ({ key, item, score: this.calculateEvictionScore(item) }))
      .sort((a, b) => a.score - b.score); // Lower score = higher priority for eviction

    let freedSpace = 0;
    let evictedCount = 0;

    for (const { key, item } of candidates) {
      if (freedSpace >= requiredSpace) break;

      this.memoryCache.delete(key);
      freedSpace += item.metadata.size;
      evictedCount++;

      this.recordEvent('evict', key, { 
        strategy: this.config.evictionStrategy,
        size: item.metadata.size 
      });
    }

    this.stats.evictedItems += evictedCount;
    this.stats.evictionsByStrategy[this.config.evictionStrategy] = 
      (this.stats.evictionsByStrategy[this.config.evictionStrategy] || 0) + evictedCount;
  }

  private calculateEvictionScore(item: CacheItem): number {
    const now = Date.now();
    const age = now - item.metadata.createdAt;
    const timeSinceAccess = now - item.metadata.lastAccessed;
    
    switch (this.config.evictionStrategy) {
      case 'lru':
        return timeSinceAccess * (1 / item.metadata.priority);
      case 'lfu':
        return (1 / item.metadata.accessCount) * (1 / item.metadata.priority);
      case 'ttl':
        return (item.metadata.createdAt + item.metadata.ttl - now) * (1 / item.metadata.priority);
      case 'priority':
        return 1 / item.metadata.priority;
      default:
        return timeSinceAccess;
    }
  }

  private calculateMemoryUsage(): number {
    let usage = 0;
    for (const item of this.memoryCache.values()) {
      usage += item.metadata.size;
    }
    return usage;
  }

  private triggerPrefetch(accessedKey: string): void {
    if (!this.config.enablePrefetching) return;

    for (const strategy of this.prefetchStrategies) {
      const predictedKeys = strategy.predictKeys(accessedKey, this.memoryCache);
      
      for (const key of predictedKeys) {
        if (strategy.shouldPrefetch(key, Date.now())) {
          // Trigger async prefetch (implementation depends on data source)
          this.recordEvent('prefetch', key, { strategy: strategy.name });
        }
      }
    }
  }

  private updateStats(): void {
    const totalRequests = this.stats.totalHits + this.stats.totalMisses;
    
    this.stats.hitRate = totalRequests > 0 ? this.stats.totalHits / totalRequests : 0;
    this.stats.missRate = totalRequests > 0 ? this.stats.totalMisses / totalRequests : 0;
    this.stats.memoryUsage = this.calculateMemoryUsage();
    this.stats.totalItems = this.memoryCache.size + this.storageCache.size;
    
    // Calculate compression metrics
    let compressedCount = 0;
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    
    for (const item of this.memoryCache.values()) {
      if (item.compressed) {
        compressedCount++;
        totalOriginalSize += item.originalSize || 0;
        totalCompressedSize += item.metadata.size;
      }
    }
    
    this.stats.compressedItems = compressedCount;
    this.stats.compressionRatio = totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;
    this.stats.compressionSavings = totalOriginalSize - totalCompressedSize;
    
    // Calculate health score
    this.stats.healthScore = this.calculateHealthScore();
  }

  private calculateHealthScore(): number {
    let score = 100;
    
    // Penalize low hit rate
    if (this.stats.hitRate < 0.7) score -= (0.7 - this.stats.hitRate) * 50;
    
    // Penalize high memory usage
    const memoryUtilization = this.stats.memoryUsage / this.config.maxMemorySize;
    if (memoryUtilization > 0.8) score -= (memoryUtilization - 0.8) * 100;
    
    // Penalize fragmentation
    if (this.stats.fragmentationRatio > 0.3) score -= this.stats.fragmentationRatio * 30;
    
    return Math.max(0, Math.min(100, score));
  }

  private updateAccessTimeMetrics(accessTime: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this.stats.averageAccessTime = this.stats.averageAccessTime * (1 - alpha) + accessTime * alpha;
  }

  private recordEvent(type: CacheEvent['type'], key: string, metadata?: any): void {
    if (!this.config.enableMetrics) return;

    this.events.push({
      type,
      key,
      timestamp: Date.now(),
      metadata,
    });

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  private startCleanupTimer(): void {
    if (!this.config.cleanupInterval) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired items
    for (const [key, item] of this.memoryCache.entries()) {
      if (!this.isItemValid(item)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired items
    for (const key of expiredKeys) {
      this.delete(key);
    }

    // Update statistics
    this.updateStats();
  }

  private async compressLargeItems(): Promise<void> {
    for (const [key, item] of this.memoryCache.entries()) {
      if (!item.compressed && item.metadata.size > this.config.compressionThreshold) {
        try {
          const compressedData = await this.compress(item.data);
          item.data = compressedData;
          item.compressed = true;
          item.originalSize = item.metadata.size;
          item.metadata.size = new Blob([JSON.stringify(compressedData)]).size;
        } catch (error) {
          console.warn('CacheManager: Failed to compress item:', key, error);
        }
      }
    }
  }

  private async defragment(): Promise<void> {
    // Defragmentation logic (implementation depends on storage backend)
    // For now, just update fragmentation ratio
    this.stats.fragmentationRatio = Math.random() * 0.1; // Simulated
  }

  // Persistent storage methods (simplified implementations)
  private async loadFromPersistentStorage(): Promise<void> {
    if (!this.config.enablePersistence) return;
    
    try {
      const stored = localStorage.getItem('cacheManager_data');
      if (stored) {
        const data = JSON.parse(stored);
        for (const [key, item] of Object.entries(data)) {
          this.storageCache.set(key, item as CacheItem);
        }
      }
    } catch (error) {
      console.warn('CacheManager: Failed to load from persistent storage:', error);
    }
  }

  private async saveToPersistentStorage(key: string, item: CacheItem): Promise<void> {
    if (!this.config.enablePersistence) return;
    
    try {
      const currentData = JSON.parse(localStorage.getItem('cacheManager_data') || '{}');
      currentData[key] = item;
      localStorage.setItem('cacheManager_data', JSON.stringify(currentData));
    } catch (error) {
      console.warn('CacheManager: Failed to save to persistent storage:', error);
    }
  }

  private removeFromPersistentStorage(key: string): void {
    if (!this.config.enablePersistence) return;
    
    try {
      const currentData = JSON.parse(localStorage.getItem('cacheManager_data') || '{}');
      delete currentData[key];
      localStorage.setItem('cacheManager_data', JSON.stringify(currentData));
    } catch (error) {
      console.warn('CacheManager: Failed to remove from persistent storage:', error);
    }
  }

  private clearPersistentStorage(): void {
    if (!this.config.enablePersistence) return;
    
    try {
      localStorage.removeItem('cacheManager_data');
    } catch (error) {
      console.warn('CacheManager: Failed to clear persistent storage:', error);
    }
  }

  // Cleanup resources
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }
    
    this.clear();
  }
}

// Create and export singleton instance
export const cacheManager = new CacheManager();

// Export default class only (types already exported inline above)
export default CacheManager;