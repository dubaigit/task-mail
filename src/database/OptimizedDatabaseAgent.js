/**
 * Optimized Database Agent - Enhanced for AI workloads and high performance
 * Hybrid SQLite + Supabase implementation for Apple Mail data
 */

const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const winston = require('winston');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'optimized-database-agent' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Optimized Database Agent with enhanced performance and caching
 * Hybrid SQLite + Supabase implementation
 */
class OptimizedDatabaseAgent {
    constructor() {
        // Initialize SQLite database
        const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'app.db');
        
        try {
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = MEMORY');
            logger.info('✅ SQLite database initialized for Optimized Database Agent');
        } catch (error) {
            logger.error('Failed to initialize SQLite database:', error);
            this.db = null;
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            logger.warn('Supabase credentials not found in environment variables');
            this.supabase = null;
        } else {
            this.supabase = createClient(supabaseUrl, supabaseKey);
            logger.info('✅ Supabase client initialized for Optimized Database Agent');
        }
        
        this.queryCache = new Map();
        this.cacheExpiry = process.env.CACHE_TTL || 30000; // 30 seconds default
        this.cacheStats = { hits: 0, misses: 0 };
        this.isInitialized = true;
    }

    // SQLite query wrapper
    async query(text, params = []) {
        if (!this.db) {
            throw new Error('SQLite database not initialized');
        }
        
        try {
            // Handle different query types
            const queryType = text.trim().toLowerCase();
            
            if (queryType.startsWith('select')) {
                const stmt = this.db.prepare(text);
                const rows = stmt.all(params);
                return { rows };
            } else {
                const stmt = this.db.prepare(text);
                const result = stmt.run(params);
                return { 
                    rows: [], 
                    rowsAffected: result.changes,
                    lastID: result.lastInsertRowid 
                };
            }
        } catch (error) {
            logger.error('Query error:', error);
            throw error;
        }
    }

    // Supabase query wrapper (for cloud operations)
    async querySupabase(table, operation = 'select', options = {}) {
        if (!this.supabase) {
            throw new Error('Supabase client not initialized');
        }
        
        try {
            let query = this.supabase.from(table);
            
            switch (operation) {
                case 'select':
                    query = query.select(options.select || '*');
                    if (options.where) {
                        Object.entries(options.where).forEach(([key, value]) => {
                            query = query.eq(key, value);
                        });
                    }
                    if (options.limit) query = query.limit(options.limit);
                    if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending });
                    break;
                    
                case 'insert':
                    query = query.insert(options.data);
                    break;
                    
                case 'update':
                    query = query.update(options.data);
                    if (options.where) {
                        Object.entries(options.where).forEach(([key, value]) => {
                            query = query.eq(key, value);
                        });
                    }
                    break;
                    
                case 'delete':
                    if (options.where) {
                        Object.entries(options.where).forEach(([key, value]) => {
                            query = query.eq(key, value);
                        });
                    }
                    query = query.delete();
                    break;
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            return { rows: data || [] };
        } catch (error) {
            logger.error('Supabase query error:', error);
            throw error;
        }
    }

    async executeQuery(query, params = [], options = {}) {
        const cacheKey = `${query}_${JSON.stringify(params)}`;
        
        // Check cache for read queries
        if (options.cache !== false) {
            const cached = this.queryCache.get(cacheKey);
            if (cached && cached.expiry > Date.now()) {
                this.cacheStats.hits++;
                return { rows: cached.data, fromCache: true };
            }
        }
        
        this.cacheStats.misses++;
        const result = await this.query(query, params);
        
        // Cache the result with dynamic TTL
        if (options.cache !== false && result.rows.length > 0) {
            const customTTL = options.cacheTTL || this.cacheExpiry;
            this.queryCache.set(cacheKey, {
                data: result.rows,
                expiry: Date.now() + customTTL
            });
        }
        
        return result;
    }

    // Cached query execution
    async executeCachedQuery(query, params = [], cacheTTL = 300) {
        return this.executeQuery(query, params, { cache: true, cacheTTL: cacheTTL * 1000 });
    }

    // Transaction support using SQLite
    async executeTransaction(operations, options = {}) {
        if (!this.db) {
            throw new Error('SQLite database not initialized');
        }
        
        try {
            const results = [];
            
            // Execute operations sequentially
            for (const operation of operations) {
                const result = await this.query(operation.query, operation.params);
                results.push(result);
            }
            
            logger.info('Operations completed successfully', { operationCount: operations.length });
            
            // Invalidate cache if requested
            if (options.invalidateCache) {
                this.queryCache.clear();
            }
            
            return results;
        } catch (error) {
            logger.error('Transaction failed:', error);
            throw error;
        }
    }

    // Common cached queries for the application
    async getTaskCategoryCounts() {
        if (!this.db) {
            return { rows: [] };
        }
        
        try {
            const result = await this.query(`
                SELECT category, COUNT(*) as count 
                FROM tasks 
                GROUP BY category
            `);
            return result;
        } catch (error) {
            logger.error('Error getting task category counts:', error);
            return { rows: [] };
        }
    }

    async getAIProcessingStats() {
        if (!this.db) {
            return { rows: [] };
        }
        
        try {
            const result = await this.query(`
                SELECT * FROM ai_processing 
                ORDER BY created_at DESC 
                LIMIT 100
            `);
            return result;
        } catch (error) {
            logger.error('Error getting AI processing stats:', error);
            return { rows: [] };
        }
    }

    async getUnanalyzedEmails(batchSize = 10) {
        if (!this.db) {
            return { rows: [] };
        }
        
        try {
            const result = await this.query(`
                SELECT * FROM emails 
                WHERE analyzed = 0 
                LIMIT ?
            `, [batchSize]);
            return result;
        } catch (error) {
            logger.error('Error getting unanalyzed emails:', error);
            return { rows: [] };
        }
    }

    // Health check
    async performHealthCheck() {
        const health = {
            sqlite: false,
            supabase: false,
            lastCheck: new Date()
        };
        
        // Check SQLite
        if (this.db) {
            try {
                await this.query('SELECT 1');
                health.sqlite = true;
            } catch {
                health.sqlite = false;
            }
        }
        
        // Check Supabase
        if (this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('system_settings')
                    .select('key')
                    .limit(1);
                health.supabase = !error;
            } catch {
                health.supabase = false;
            }
        }
        
        return health;
    }

    // Metrics and monitoring
    getConnectionMetrics() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        return {
            sqlite: {
                isReady: this.db !== null,
                status: this.db ? 'connected' : 'disconnected'
            },
            supabase: {
                isReady: this.supabase !== null,
                status: this.supabase ? 'connected' : 'disconnected'
            },
            cache: {
                size: this.queryCache.size,
                hitRate: total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0,
                stats: this.cacheStats
            }
        };
    }

    getPerformanceMetrics() {
        return {
            connectionMetrics: this.getConnectionMetrics(),
            health: {
                sqlite: this.db !== null,
                supabase: this.supabase !== null,
                overall: this.db !== null || this.supabase !== null
            }
        };
    }

    getHealth() {
        return {
            sqlite: this.db !== null,
            supabase: this.supabase !== null,
            overall: this.db !== null || this.supabase !== null,
            lastCheck: new Date()
        };
    }

    // Graceful shutdown
    async shutdown() {
        logger.info('Shutting down Optimized Database Agent...');
        
        try {
            // Clear cache
            this.queryCache.clear();
            
            // Close SQLite connection
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            
            // Note: Supabase client doesn't need explicit cleanup
            this.supabase = null;
            
            this.isInitialized = false;
            logger.info('✅ Optimized Database Agent shutdown complete');
        } catch (error) {
            logger.error('Error during shutdown:', error);
        }
    }
}

// Export singleton instance
const optimizedDatabaseAgent = new OptimizedDatabaseAgent();

module.exports = optimizedDatabaseAgent;
