/**
 * Health check API routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { Pool } = require('pg');
const Redis = require('redis');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'email_management',
  user: process.env.DB_USER || 'email_admin',
  password: process.env.DB_PASSWORD,
});

/**
 * Basic health check (public)
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    // Basic database connectivity check
    await pool.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'apple-mcp-backend',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

/**
 * Detailed health check (requires authentication)
 * GET /api/health/detailed
 */
router.get('/detailed', 
  authenticateToken,
  async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {}
    };

    // Check PostgreSQL
    try {
      const dbResult = await pool.query('SELECT version()');
      health.services.postgresql = {
        status: 'healthy',
        version: dbResult.rows[0].version,
        activeConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount
      };
    } catch (error) {
      health.services.postgresql = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check Redis
    try {
      const redis = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      await redis.connect();
      const redisInfo = await redis.info('server');
      await redis.quit();
      
      health.services.redis = {
        status: 'healthy',
        info: redisInfo.split('\\n').slice(0, 5).join(', ')
      };
    } catch (error) {
      health.services.redis = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check AI service
    try {
      const ai_service = require('../../../ai_service');
      health.services.ai = {
        status: 'healthy',
        requestCount: ai_service.getRequestCount(),
        lastRequest: ai_service.getLastRequestTime()
      };
    } catch (error) {
      health.services.ai = {
        status: 'unhealthy',
        error: 'AI service not available'
      };
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  }
);

module.exports = router;