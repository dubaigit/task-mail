/**
 * Migration Adapter - Backward compatibility layer
 * Helps transition from legacy PostgreSQL + Redis to Supabase
 */

const { db } = require('./supabase');

class MigrationAdapter {
  constructor() {
    this.logger = {
      info: (msg) => console.log(`🔄 [MIGRATION] ${msg}`),
      warn: (msg) => console.warn(`⚠️ [MIGRATION] ${msg}`),
      error: (msg) => console.error(`❌ [MIGRATION] ${msg}`)
    };
  }

  // ===================
  // LEGACY DATABASE INTERFACE
  // ===================

  /**
   * Legacy query method - maps basic SQL to Supabase operations
   * @deprecated Use Supabase client directly
   */
  async query(sql, params = []) {
    this.logger.warn('Using legacy query method - please update to Supabase client');
    
    const sqlLower = sql.toLowerCase().trim();
    
    try {
      // SELECT operations mapping
      if (sqlLower.startsWith('select')) {
        return await this.handleSelectQuery(sqlLower, params);
      }
      
      // INSERT operations mapping
      if (sqlLower.startsWith('insert')) {
        return await this.handleInsertQuery(sqlLower, params);
      }
      
      // UPDATE operations mapping
      if (sqlLower.startsWith('update')) {
        return await this.handleUpdateQuery(sqlLower, params);
      }
      
      // DELETE operations mapping
      if (sqlLower.startsWith('delete')) {
        return await this.handleDeleteQuery(sqlLower, params);
      }
      
      throw new Error(`Unsupported legacy SQL operation: ${sql.substring(0, 50)}...`);
    } catch (error) {
      this.logger.error(`Legacy query failed: ${error.message}`);
      throw error;
    }
  }

  async handleSelectQuery(sql, params) {
    // Basic table detection
    if (sql.includes('from emails')) {
      const userId = params[0] || 'unknown';
      const data = await db.getEmails(userId);
      return { rows: data, rowCount: data.length };
    }
    
    if (sql.includes('from tasks')) {
      const userId = params[0] || 'unknown';
      const data = await db.getTasks(userId);
      return { rows: data, rowCount: data.length };
    }
    
    if (sql.includes('from profiles')) {
      const userId = params[0] || 'unknown';
      const data = await db.getProfile(userId);
      return { rows: data ? [data] : [], rowCount: data ? 1 : 0 };
    }
    
    if (sql.includes('from categories')) {
      const userId = params[0] || 'unknown';
      const data = await db.getCategories(userId);
      return { rows: data, rowCount: data.length };
    }
    
    if (sql.includes('from drafts')) {
      const userId = params[0] || 'unknown';
      const data = await db.getDrafts(userId);
      return { rows: data, rowCount: data.length };
    }
    
    throw new Error('Unsupported SELECT query pattern');
  }

  async handleInsertQuery(sql, params) {
    if (sql.includes('into emails')) {
      const data = await db.createEmail(params[0]);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('into tasks')) {
      const data = await db.createTask(params[0]);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('into profiles')) {
      const data = await db.createProfile(params[0]);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('into categories')) {
      const data = await db.createCategory(params[0]);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('into drafts')) {
      const data = await db.createDraft(params[0]);
      return { rows: [data], rowCount: 1 };
    }
    
    throw new Error('Unsupported INSERT query pattern');
  }

  async handleUpdateQuery(sql, params) {
    const [updates, id, userId] = params;
    
    if (sql.includes('emails set')) {
      const data = await db.updateEmail(id, updates, userId);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('tasks set')) {
      const data = await db.updateTask(id, updates, userId);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('profiles set')) {
      const data = await db.updateProfile(userId, updates);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('categories set')) {
      const data = await db.updateCategory(id, updates, userId);
      return { rows: [data], rowCount: 1 };
    }
    
    if (sql.includes('drafts set')) {
      const data = await db.updateDraft(id, updates, userId);
      return { rows: [data], rowCount: 1 };
    }
    
    throw new Error('Unsupported UPDATE query pattern');
  }

  async handleDeleteQuery(sql, params) {
    const [id, userId] = params;
    
    if (sql.includes('from emails')) {
      await db.deleteEmail(id, userId);
      return { rows: [], rowCount: 1 };
    }
    
    if (sql.includes('from tasks')) {
      await db.deleteTask(id, userId);
      return { rows: [], rowCount: 1 };
    }
    
    if (sql.includes('from categories')) {
      await db.deleteCategory(id, userId);
      return { rows: [], rowCount: 1 };
    }
    
    if (sql.includes('from drafts')) {
      await db.deleteDraft(id, userId);
      return { rows: [], rowCount: 1 };
    }
    
    throw new Error('Unsupported DELETE query pattern');
  }

  // ===================
  // CONNECTION MANAGEMENT
  // ===================

  async connect() {
    this.logger.info('Using Supabase - no connection needed');
    return true;
  }
  
  async disconnect() {
    this.logger.info('Cleaning up Supabase channels');
    await db.cleanup();
    return true;
  }

  async end() {
    return this.disconnect();
  }

  // ===================
  // HEALTH & MONITORING
  // ===================

  async healthCheck() {
    try {
      const health = await db.healthCheck();
      return health.healthy;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  async getConnectionMetrics() {
    return {
      postgresql: {
        totalCount: 'N/A - Using Supabase',
        idleCount: 'N/A - Using Supabase',
        waitingCount: 'N/A - Using Supabase'
      },
      redis: {
        isReady: 'N/A - Using Supabase',
        status: 'N/A - Using Supabase'
      },
      health: await db.healthCheck()
    };
  }

  // ===================
  // CACHE OPERATIONS MAPPING
  // ===================

  async getCachedData(key, options = {}) {
    this.logger.warn(`Cache operation not supported in Supabase migration: getCachedData(${key})`);
    return null;
  }

  async setCachedData(key, data, ttl = 300) {
    this.logger.warn(`Cache operation not supported in Supabase migration: setCachedData(${key})`);
    return false;
  }

  async invalidateCache(pattern) {
    this.logger.warn(`Cache operation not supported in Supabase migration: invalidateCache(${pattern})`);
    return false;
  }

  // ===================
  // TRANSACTION SUPPORT
  // ===================

  async executeTransaction(operations) {
    this.logger.warn('Transaction support limited - executing operations sequentially');
    
    const results = [];
    for (const operation of operations) {
      try {
        const result = await this.query(operation.query, operation.params);
        results.push(result);
      } catch (error) {
        this.logger.error(`Transaction operation failed: ${error.message}`);
        throw error;
      }
    }
    
    return results;
  }

  // ===================
  // MIGRATION UTILITIES
  // ===================

  /**
   * Analyze legacy code for migration opportunities
   */
  analyzeLegacyUsage(codeSnippet) {
    const suggestions = [];
    
    if (codeSnippet.includes('executeQuery(')) {
      suggestions.push({
        type: 'direct_replacement',
        old: 'executeQuery(sql, params)',
        new: 'db.getEmails(userId) or specific method',
        priority: 'high'
      });
    }
    
    if (codeSnippet.includes('getCachedData(')) {
      suggestions.push({
        type: 'cache_removal',
        old: 'getCachedData(key)',
        new: 'Direct database call (Supabase handles caching)',
        priority: 'medium'
      });
    }
    
    if (codeSnippet.includes('executeTransaction(')) {
      suggestions.push({
        type: 'transaction_refactor',
        old: 'executeTransaction(operations)',
        new: 'Sequential operations or RPC functions',
        priority: 'medium'
      });
    }
    
    return suggestions;
  }

  /**
   * Generate migration report
   */
  async generateMigrationReport() {
    const health = await db.healthCheck();
    
    return {
      timestamp: new Date().toISOString(),
      supabase_status: health.healthy ? 'connected' : 'disconnected',
      legacy_methods_available: [
        'query(sql, params)',
        'connect()',
        'disconnect()',
        'healthCheck()',
        'getCachedData(key)',
        'setCachedData(key, data, ttl)',
        'executeTransaction(operations)'
      ],
      recommended_migrations: [
        {
          from: 'databaseAgent.executeQuery("SELECT * FROM emails WHERE user_id = $1", [userId])',
          to: 'db.getEmails(userId)',
          benefit: 'Type safety, better error handling, built-in caching'
        },
        {
          from: 'databaseAgent.getCachedData("user_tasks_" + userId)',
          to: 'db.getTasks(userId)',
          benefit: 'Eliminates cache complexity, Supabase handles optimization'
        },
        {
          from: 'databaseAgent.executeTransaction([...])',
          to: 'db.batchUpdateTasks([...]) or RPC function',
          benefit: 'Atomic operations with better error handling'
        }
      ],
      next_steps: [
        'Replace query() calls with specific db.* methods',
        'Remove cache operations (handled by Supabase)',
        'Update error handling to use Supabase error format',
        'Add TypeScript types for better development experience',
        'Test real-time subscriptions to replace polling'
      ]
    };
  }

  /**
   * Show migration progress
   */
  getMigrationProgress() {
    return {
      legacy_methods_still_in_use: [
        // This would be populated by scanning code
      ],
      supabase_methods_adopted: [
        // This would be populated by usage tracking
      ],
      completion_percentage: 0 // Calculate based on above
    };
  }
}

// Export adapter instance
const migrationAdapter = new MigrationAdapter();

module.exports = {
  MigrationAdapter,
  migrationAdapter,
  // Alias for backward compatibility
  databaseAgent: migrationAdapter
};