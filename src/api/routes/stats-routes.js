/**
 * Statistics and analytics API routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, generalLimiter } = require('../../middleware/auth');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'email_management',
  user: process.env.DB_USER || 'email_admin',
  password: process.env.DB_PASSWORD,
});

/**
 * Get overall statistics
 * GET /api/statistics
 */
router.get('/', 
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const stats = {};
      
      // Get task statistics
      const taskStats = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress
        FROM tasks
      `);
      
      stats.tasks = {
        total: parseInt(taskStats.rows[0].total),
        completed: parseInt(taskStats.rows[0].completed),
        pending: parseInt(taskStats.rows[0].pending),
        inProgress: parseInt(taskStats.rows[0].in_progress),
        completionRate: taskStats.rows[0].total > 0 
          ? (taskStats.rows[0].completed / taskStats.rows[0].total * 100).toFixed(2)
          : 0
      };
      
      // Get email statistics (if table exists)
      try {
        const emailStats = await pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN read = true THEN 1 END) as read,
            COUNT(CASE WHEN starred = true THEN 1 END) as starred
          FROM emails
        `);
        
        stats.emails = {
          total: parseInt(emailStats.rows[0].total),
          read: parseInt(emailStats.rows[0].read),
          unread: parseInt(emailStats.rows[0].total) - parseInt(emailStats.rows[0].read),
          starred: parseInt(emailStats.rows[0].starred)
        };
      } catch (error) {
        stats.emails = { error: 'Email table not available' };
      }
      
      // Get user activity statistics
      try {
        const userStats = await pool.query(`
          SELECT 
            COUNT(DISTINCT user_id) as active_users,
            COUNT(*) as total_logins
          FROM login_attempts
          WHERE success = true
            AND created_at > NOW() - INTERVAL '30 days'
        `);
        
        stats.users = {
          activeUsers: parseInt(userStats.rows[0].active_users),
          totalLogins: parseInt(userStats.rows[0].total_logins)
        };
      } catch (error) {
        stats.users = { activeUsers: 0, totalLogins: 0 };
      }
      
      // Add timestamp
      stats.timestamp = new Date().toISOString();
      
      res.json(stats);
    } catch (error) {
      console.error('❌ Error fetching statistics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  }
);

/**
 * Get time-based analytics
 * GET /api/statistics/analytics
 */
router.get('/analytics',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const { period = '7d', groupBy = 'day' } = req.query;
      
      const periodMap = {
        '24h': '1 day',
        '7d': '7 days',
        '30d': '30 days',
        '90d': '90 days'
      };
      
      const intervalMap = {
        'hour': 'hour',
        'day': 'day',
        'week': 'week',
        'month': 'month'
      };
      
      const query = `
        SELECT 
          DATE_TRUNC($1, created_at) as period,
          COUNT(*) as tasks_created,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as tasks_completed
        FROM tasks
        WHERE created_at > NOW() - INTERVAL $2
        GROUP BY period
        ORDER BY period DESC
      `;
      
      const result = await pool.query(query, [
        intervalMap[groupBy] || 'day',
        periodMap[period] || '7 days'
      ]);
      
      const analytics = result.rows.map(row => ({
        period: row.period,
        tasksCreated: parseInt(row.tasks_created),
        tasksCompleted: parseInt(row.tasks_completed),
        completionRate: row.tasks_created > 0 
          ? (row.tasks_completed / row.tasks_created * 100).toFixed(2)
          : 0
      }));
      
      res.json({
        period,
        groupBy,
        data: analytics
      });
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch analytics',
        message: error.message
      });
    }
  }
);

/**
 * Get performance metrics
 * GET /api/statistics/performance
 */
router.get('/performance',
  authenticateToken,
  generalLimiter,
  async (req, res) => {
    try {
      const metrics = {
        database: {
          activeConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingRequests: pool.waitingCount
        },
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        },
        timestamp: new Date().toISOString()
      };
      
      // Get average response times if available
      try {
        const responseTimeQuery = `
          SELECT 
            AVG(response_time_ms) as avg_response_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_response_time
          FROM api_requests
          WHERE created_at > NOW() - INTERVAL '1 hour'
        `;
        
        const rtResult = await pool.query(responseTimeQuery);
        
        metrics.api = {
          avgResponseTime: parseFloat(rtResult.rows[0].avg_response_time) || 0,
          p95ResponseTime: parseFloat(rtResult.rows[0].p95_response_time) || 0,
          p99ResponseTime: parseFloat(rtResult.rows[0].p99_response_time) || 0
        };
      } catch (error) {
        // API metrics table might not exist
        metrics.api = { note: 'API metrics not available' };
      }
      
      res.json(metrics);
    } catch (error) {
      console.error('❌ Error fetching performance metrics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch performance metrics',
        message: error.message
      });
    }
  }
);

module.exports = router;