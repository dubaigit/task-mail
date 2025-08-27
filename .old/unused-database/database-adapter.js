/**
 * Database Adapter for API Endpoints
 * Provides pool and secureDb compatibility layer
 */

const optimizedDatabaseAgent = require('./OptimizedDatabaseAgent');

// Pool-compatible interface for raw SQL queries
const pool = {
  query: async (text, params = []) => {
    try {
      // Use the optimized database agent for queries
      const result = await optimizedDatabaseAgent.executeQuery(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};

// SecureDb-compatible interface for high-level operations
const secureDb = {
  // AI Usage Statistics
  async getAIUsageStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_requests,
          AVG(response_time) as avg_response_time
        FROM ai_requests
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `;
      const result = await pool.query(query);
      return result.rows[0] || {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        avg_response_time: 0
      };
    } catch (error) {
      console.error('Error getting AI usage stats:', error);
      return {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        avg_response_time: 0,
        error: error.message
      };
    }
  },

  // Email Sync Status
  async getSyncStatus() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_emails,
          MAX(last_sync_at) as last_sync,
          COUNT(CASE WHEN status = 'synced' THEN 1 END) as synced_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
        FROM email_sync_status
      `;
      const result = await pool.query(query);
      return result.rows[0] || {
        total_emails: 0,
        last_sync: new Date(),
        synced_count: 0,
        pending_count: 0,
        status: 'idle'
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        total_emails: 0,
        last_sync: new Date(),
        synced_count: 0,
        pending_count: 0,
        status: 'error',
        error: error.message
      };
    }
  },

  // Get Tasks
  async getTasks(limit = 10, offset = 0, filter = {}, userId = null) {
    try {
      let query = `
        SELECT 
          id, title, description, status, priority, 
          created_at, updated_at, assigned_to
        FROM tasks
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND assigned_to = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (filter.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filter.status);
        paramIndex++;
      }

      if (filter.priority) {
        query += ` AND priority = $${paramIndex}`;
        params.push(filter.priority);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return {
        tasks: result.rows || [],
        total: result.rows.length,
        limit,
        offset
      };
    } catch (error) {
      console.error('Error getting tasks:', error);
      return {
        tasks: [],
        total: 0,
        limit,
        offset,
        error: error.message
      };
    }
  },

  // Get Category Counts
  async getCategoryCounts(userId = null) {
    try {
      let query = `
        SELECT 
          category,
          COUNT(*) as count
        FROM emails
        WHERE 1=1
      `;
      const params = [];

      if (userId) {
        query += ` AND user_id = $1`;
        params.push(userId);
      }

      query += ` GROUP BY category ORDER BY count DESC`;

      const result = await pool.query(query, params);
      
      // Transform to object format
      const counts = {};
      (result.rows || []).forEach(row => {
        counts[row.category] = parseInt(row.count);
      });

      // Ensure all categories are present
      const defaultCategories = ['inbox', 'important', 'work', 'personal', 'other'];
      defaultCategories.forEach(cat => {
        if (!counts[cat]) counts[cat] = 0;
      });

      return counts;
    } catch (error) {
      console.error('Error getting category counts:', error);
      return {
        inbox: 0,
        important: 0,
        work: 0,
        personal: 0,
        other: 0,
        error: error.message
      };
    }
  },

  // Get Statistics
  async getStatistics(userId = null) {
    try {
      const stats = {
        emails: {
          total: 0,
          processed: 0,
          pending: 0
        },
        tasks: {
          total: 0,
          completed: 0,
          in_progress: 0,
          pending: 0
        },
        ai: {
          requests_today: 0,
          average_response_time: 0,
          success_rate: 0
        }
      };

      // Email statistics
      let emailQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN processed = true THEN 1 END) as processed,
          COUNT(CASE WHEN processed = false THEN 1 END) as pending
        FROM emails
      `;
      if (userId) emailQuery += ` WHERE user_id = $1`;
      
      const emailResult = await pool.query(emailQuery, userId ? [userId] : []);
      if (emailResult.rows[0]) {
        stats.emails = emailResult.rows[0];
      }

      // Task statistics
      let taskQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
        FROM tasks
      `;
      if (userId) taskQuery += ` WHERE assigned_to = $1`;
      
      const taskResult = await pool.query(taskQuery, userId ? [userId] : []);
      if (taskResult.rows[0]) {
        stats.tasks = taskResult.rows[0];
      }

      // AI statistics
      const aiStats = await this.getAIUsageStats();
      stats.ai = {
        requests_today: aiStats.total_requests || 0,
        average_response_time: aiStats.avg_response_time || 0,
        success_rate: aiStats.total_requests ? 
          (aiStats.successful_requests / aiStats.total_requests * 100) : 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        emails: { total: 0, processed: 0, pending: 0 },
        tasks: { total: 0, completed: 0, in_progress: 0, pending: 0 },
        ai: { requests_today: 0, average_response_time: 0, success_rate: 0 },
        error: error.message
      };
    }
  },

  // Health Check
  async healthCheck() {
    try {
      const result = await pool.query('SELECT NOW() as timestamp, version() as version');
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: result.rows[0]?.timestamp || new Date(),
        version: result.rows[0]?.version || 'unknown'
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
};

module.exports = {
  pool,
  secureDb
};