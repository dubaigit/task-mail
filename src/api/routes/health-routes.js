/**
 * Health check API routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const Redis = require('redis');
const dbAgent = require('../../database/OptimizedDatabaseAgent');


/**
 * Basic health check (public)
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    const health = await dbAgent.performHealthCheck();
    if (!health.sqlite && !health.supabase) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'No database backends available'
      });
    }
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'apple-mcp-backend',
      environment: process.env.NODE_ENV || 'development',
      backends: health
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
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

    try {
      const metrics = dbAgent.getConnectionMetrics();
      health.services.database = {
        status: metrics.sqlite.isReady || metrics.supabase.isReady ? 'healthy' : 'unhealthy',
        backends: metrics
      };
      if (!(metrics.sqlite.isReady || metrics.supabase.isReady)) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.database = {
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
