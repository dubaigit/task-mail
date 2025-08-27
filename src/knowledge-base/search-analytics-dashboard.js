#!/usr/bin/env node

/**
 * Apple MCP Search Analytics Dashboard
 * 
 * Real-time analytics and performance monitoring for the semantic search system
 * with comprehensive metrics, visualizations, and alerting capabilities.
 */

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const WebSocket = require('ws');
const cors = require('cors');

class SearchAnalyticsDashboard {
  constructor(options = {}) {
    this.app = express();
    this.port = process.env.ANALYTICS_PORT || 8083;
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000
    });

    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.logger = this.setupLogger();
    
    // WebSocket server for real-time updates
    this.wss = null;
    
    // Analytics configuration
    this.config = {
      refreshInterval: 30000, // 30 seconds
      retentionPeriod: '30 days',
      alertThresholds: {
        errorRate: 0.05, // 5%
        avgLatency: 2000, // 2 seconds
        lowSuccessRate: 0.95 // 95%
      },
      ...options
    };

    // Real-time metrics cache
    this.metricsCache = {
      realTime: {},
      hourly: {},
      daily: {},
      lastUpdate: null
    };

    this.init();
  }

  setupLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'search-analytics' },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/analytics-error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/analytics-combined.log' 
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async init() {
    try {
      await this.redis.connect();
      
      // Setup middleware
      this.app.use(cors());
      this.app.use(express.json());
      this.app.use(express.static('public'));
      
      // Setup routes
      this.setupRoutes();
      
      // Start WebSocket server
      this.setupWebSocket();
      
      // Start real-time monitoring
      this.startRealTimeMonitoring();
      
      this.logger.info('Search Analytics Dashboard initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Analytics Dashboard:', error);
      throw error;
    }
  }

  setupRoutes() {
    // Real-time metrics endpoint
    this.app.get('/api/metrics/realtime', async (req, res) => {
      try {
        const metrics = await this.getRealTimeMetrics();
        res.json(metrics);
      } catch (error) {
        this.logger.error('Real-time metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch real-time metrics' });
      }
    });

    // Historical analytics
    this.app.get('/api/analytics/historical', async (req, res) => {
      try {
        const { timeframe = '24h', granularity = 'hour' } = req.query;
        const analytics = await this.getHistoricalAnalytics(timeframe, granularity);
        res.json(analytics);
      } catch (error) {
        this.logger.error('Historical analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch historical analytics' });
      }
    });

    // Search performance metrics
    this.app.get('/api/performance', async (req, res) => {
      try {
        const performance = await this.getPerformanceMetrics();
        res.json(performance);
      } catch (error) {
        this.logger.error('Performance metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch performance metrics' });
      }
    });

    // Popular queries analysis
    this.app.get('/api/queries/popular', async (req, res) => {
      try {
        const { timeframe = '24h', limit = 20 } = req.query;
        const popularQueries = await this.getPopularQueries(timeframe, limit);
        res.json(popularQueries);
      } catch (error) {
        this.logger.error('Popular queries error:', error);
        res.status(500).json({ error: 'Failed to fetch popular queries' });
      }
    });

    // Query success rates
    this.app.get('/api/queries/success-rates', async (req, res) => {
      try {
        const successRates = await this.getQuerySuccessRates();
        res.json(successRates);
      } catch (error) {
        this.logger.error('Success rates error:', error);
        res.status(500).json({ error: 'Failed to fetch success rates' });
      }
    });

    // User behavior analytics
    this.app.get('/api/users/behavior', async (req, res) => {
      try {
        const behavior = await this.getUserBehaviorAnalytics();
        res.json(behavior);
      } catch (error) {
        this.logger.error('User behavior error:', error);
        res.status(500).json({ error: 'Failed to fetch user behavior analytics' });
      }
    });

    // Search result effectiveness
    this.app.get('/api/results/effectiveness', async (req, res) => {
      try {
        const effectiveness = await this.getResultEffectiveness();
        res.json(effectiveness);
      } catch (error) {
        this.logger.error('Result effectiveness error:', error);
        res.status(500).json({ error: 'Failed to fetch result effectiveness' });
      }
    });

    // System alerts
    this.app.get('/api/alerts', async (req, res) => {
      try {
        const alerts = await this.getSystemAlerts();
        res.json(alerts);
      } catch (error) {
        this.logger.error('System alerts error:', error);
        res.status(500).json({ error: 'Failed to fetch system alerts' });
      }
    });

    // Cache statistics
    this.app.get('/api/cache/stats', async (req, res) => {
      try {
        const cacheStats = await this.getCacheStatistics();
        res.json(cacheStats);
      } catch (error) {
        this.logger.error('Cache stats error:', error);
        res.status(500).json({ error: 'Failed to fetch cache statistics' });
      }
    });

    // Export analytics data
    this.app.get('/api/export', async (req, res) => {
      try {
        const { format = 'json', timeframe = '7d' } = req.query;
        const exportData = await this.exportAnalyticsData(timeframe, format);
        
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=search_analytics.csv');
        }
        
        res.send(exportData);
      } catch (error) {
        this.logger.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export analytics data' });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: this.port + 1 });
    
    this.wss.on('connection', (ws) => {
      this.logger.info('New WebSocket connection established');
      
      // Send initial metrics
      this.sendMetricsToClient(ws);
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.warn('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.logger.info('WebSocket connection closed');
      });
    });
  }

  async startRealTimeMonitoring() {
    setInterval(async () => {
      try {
        await this.updateRealTimeMetrics();
        await this.checkAlerts();
        this.broadcastMetricsUpdate();
      } catch (error) {
        this.logger.error('Real-time monitoring error:', error);
      }
    }, this.config.refreshInterval);
  }

  async getRealTimeMetrics() {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    const query = `
      SELECT 
        COUNT(*) as total_searches,
        COUNT(CASE WHEN success THEN 1 END) as successful_searches,
        AVG(response_time_ms) as avg_response_time,
        AVG(results_count) as avg_results_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT session_id) as unique_sessions,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_response_time
      FROM search_analytics 
      WHERE created_at > $1
    `;

    const result = await this.pool.query(query, [oneHourAgo]);
    const metrics = result.rows[0];

    // Get cache hit rate from Redis
    const cacheStats = await this.getCacheStatistics();

    return {
      timestamp: now.toISOString(),
      searches: {
        total: parseInt(metrics.total_searches),
        successful: parseInt(metrics.successful_searches),
        successRate: metrics.total_searches > 0 
          ? (metrics.successful_searches / metrics.total_searches) 
          : 0
      },
      performance: {
        avgResponseTime: parseFloat(metrics.avg_response_time) || 0,
        p95ResponseTime: parseFloat(metrics.p95_response_time) || 0,
        p99ResponseTime: parseFloat(metrics.p99_response_time) || 0
      },
      users: {
        unique: parseInt(metrics.unique_users),
        sessions: parseInt(metrics.unique_sessions)
      },
      results: {
        avgCount: parseFloat(metrics.avg_results_count) || 0
      },
      cache: cacheStats
    };
  }

  async getHistoricalAnalytics(timeframe, granularity) {
    const timeframeMap = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };

    const intervalMap = {
      'minute': '1 minute',
      'hour': '1 hour',
      'day': '1 day'
    };

    const query = `
      SELECT 
        DATE_TRUNC($1, created_at) as time_bucket,
        COUNT(*) as total_searches,
        COUNT(CASE WHEN success THEN 1 END) as successful_searches,
        AVG(response_time_ms) as avg_response_time,
        AVG(results_count) as avg_results_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM search_analytics 
      WHERE created_at > NOW() - INTERVAL $2
      GROUP BY time_bucket
      ORDER BY time_bucket DESC
      LIMIT 1000
    `;

    const result = await this.pool.query(query, [
      granularity,
      timeframeMap[timeframe] || '24 hours'
    ]);

    return result.rows.map(row => ({
      timestamp: row.time_bucket,
      metrics: {
        totalSearches: parseInt(row.total_searches),
        successfulSearches: parseInt(row.successful_searches),
        successRate: row.total_searches > 0 
          ? (row.successful_searches / row.total_searches)
          : 0,
        avgResponseTime: parseFloat(row.avg_response_time) || 0,
        avgResultsCount: parseFloat(row.avg_results_count) || 0,
        uniqueUsers: parseInt(row.unique_users)
      }
    }));
  }

  async getPerformanceMetrics() {
    const performanceQuery = `
      WITH performance_stats AS (
        SELECT 
          AVG(response_time_ms) as avg_latency,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time_ms) as p50_latency,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_latency,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_latency,
          COUNT(CASE WHEN response_time_ms > 2000 THEN 1 END) as slow_queries,
          COUNT(*) as total_queries
        FROM search_analytics 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      ),
      hourly_performance AS (
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          AVG(response_time_ms) as avg_latency,
          COUNT(*) as query_count
        FROM search_analytics 
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour DESC
      )
      SELECT 
        ps.*,
        ARRAY_AGG(
          json_build_object(
            'hour', hp.hour,
            'avgLatency', hp.avg_latency,
            'queryCount', hp.query_count
          ) ORDER BY hp.hour DESC
        ) as hourly_trends
      FROM performance_stats ps
      CROSS JOIN hourly_performance hp
      GROUP BY ps.avg_latency, ps.p50_latency, ps.p95_latency, ps.p99_latency, ps.slow_queries, ps.total_queries
    `;

    const result = await this.pool.query(performanceQuery);
    const data = result.rows[0];

    return {
      summary: {
        avgLatency: parseFloat(data.avg_latency) || 0,
        p50Latency: parseFloat(data.p50_latency) || 0,
        p95Latency: parseFloat(data.p95_latency) || 0,
        p99Latency: parseFloat(data.p99_latency) || 0,
        slowQueryRate: data.total_queries > 0 
          ? (data.slow_queries / data.total_queries)
          : 0
      },
      trends: data.hourly_trends || []
    };
  }

  async getPopularQueries(timeframe, limit) {
    const timeframeMap = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };

    const query = `
      SELECT 
        query_text,
        COUNT(*) as search_count,
        AVG(response_time_ms) as avg_response_time,
        AVG(results_count) as avg_results_count,
        COUNT(CASE WHEN success THEN 1 END)::FLOAT / COUNT(*) as success_rate,
        MAX(created_at) as last_searched
      FROM search_analytics 
      WHERE created_at > NOW() - INTERVAL $1
        AND query_text IS NOT NULL
        AND LENGTH(query_text) > 2
      GROUP BY query_text
      ORDER BY search_count DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [
      timeframeMap[timeframe] || '24 hours',
      limit
    ]);

    return result.rows.map(row => ({
      query: row.query_text,
      searchCount: parseInt(row.search_count),
      avgResponseTime: parseFloat(row.avg_response_time) || 0,
      avgResultsCount: parseFloat(row.avg_results_count) || 0,
      successRate: parseFloat(row.success_rate) || 0,
      lastSearched: row.last_searched
    }));
  }

  async getQuerySuccessRates() {
    const query = `
      WITH query_categories AS (
        SELECT 
          CASE 
            WHEN LENGTH(query_text) <= 10 THEN 'short'
            WHEN LENGTH(query_text) <= 30 THEN 'medium'
            ELSE 'long'
          END as query_length_category,
          CASE 
            WHEN results_count = 0 THEN 'no_results'
            WHEN results_count <= 5 THEN 'few_results'
            WHEN results_count <= 20 THEN 'good_results'
            ELSE 'many_results'
          END as results_category,
          success,
          response_time_ms
        FROM search_analytics 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      )
      SELECT 
        query_length_category,
        results_category,
        COUNT(*) as total_queries,
        COUNT(CASE WHEN success THEN 1 END) as successful_queries,
        AVG(response_time_ms) as avg_response_time
      FROM query_categories
      GROUP BY query_length_category, results_category
      ORDER BY query_length_category, results_category
    `;

    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      queryLengthCategory: row.query_length_category,
      resultsCategory: row.results_category,
      totalQueries: parseInt(row.total_queries),
      successfulQueries: parseInt(row.successful_queries),
      successRate: row.total_queries > 0 
        ? (row.successful_queries / row.total_queries)
        : 0,
      avgResponseTime: parseFloat(row.avg_response_time) || 0
    }));
  }

  async getUserBehaviorAnalytics() {
    const query = `
      WITH user_sessions AS (
        SELECT 
          user_id,
          session_id,
          COUNT(*) as queries_per_session,
          AVG(results_count) as avg_results_per_query,
          MIN(created_at) as session_start,
          MAX(created_at) as session_end,
          EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as session_duration
        FROM search_analytics 
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND user_id IS NOT NULL
          AND session_id IS NOT NULL
        GROUP BY user_id, session_id
      )
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT session_id) as total_sessions,
        AVG(queries_per_session) as avg_queries_per_session,
        AVG(session_duration) as avg_session_duration,
        AVG(avg_results_per_query) as avg_results_per_query,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY queries_per_session) as median_queries_per_session,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY queries_per_session) as p95_queries_per_session
      FROM user_sessions
    `;

    const result = await this.pool.query(query);
    const data = result.rows[0];

    return {
      uniqueUsers: parseInt(data.unique_users) || 0,
      totalSessions: parseInt(data.total_sessions) || 0,
      avgQueriesPerSession: parseFloat(data.avg_queries_per_session) || 0,
      avgSessionDuration: parseFloat(data.avg_session_duration) || 0,
      avgResultsPerQuery: parseFloat(data.avg_results_per_query) || 0,
      medianQueriesPerSession: parseFloat(data.median_queries_per_session) || 0,
      p95QueriesPerSession: parseFloat(data.p95_queries_per_session) || 0
    };
  }

  async getResultEffectiveness() {
    const query = `
      SELECT 
        CASE 
          WHEN results_count = 0 THEN 'no_results'
          WHEN results_count <= 5 THEN 'few_results'
          WHEN results_count <= 20 THEN 'optimal_results'
          ELSE 'many_results'
        END as result_category,
        COUNT(*) as query_count,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN array_length(clicked_results, 1) > 0 THEN 1 END) as queries_with_clicks,
        AVG(array_length(clicked_results, 1)) as avg_clicks_per_query
      FROM search_analytics 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY result_category
      ORDER BY 
        CASE result_category
          WHEN 'no_results' THEN 1
          WHEN 'few_results' THEN 2
          WHEN 'optimal_results' THEN 3
          WHEN 'many_results' THEN 4
        END
    `;

    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      category: row.result_category,
      queryCount: parseInt(row.query_count),
      avgResponseTime: parseFloat(row.avg_response_time) || 0,
      queriesWithClicks: parseInt(row.queries_with_clicks) || 0,
      clickThroughRate: row.query_count > 0 
        ? (row.queries_with_clicks / row.query_count)
        : 0,
      avgClicksPerQuery: parseFloat(row.avg_clicks_per_query) || 0
    }));
  }

  async getCacheStatistics() {
    try {
      const info = await this.redis.info('memory');
      const keyspaceInfo = await this.redis.info('keyspace');
      
      // Parse Redis info
      const memoryUsed = this.parseRedisInfo(info, 'used_memory_human');
      const totalKeys = this.parseRedisInfo(keyspaceInfo, 'keys');
      
      // Get search cache specific stats
      const searchKeys = await this.redis.keys('search:*');
      const cacheSize = searchKeys.length;
      
      return {
        memoryUsed,
        totalKeys: parseInt(totalKeys) || 0,
        searchCacheSize: cacheSize,
        hitRate: this.calculateCacheHitRate(),
        avgTtl: await this.getAverageTtl(searchKeys.slice(0, 100)) // Sample for performance
      };
    } catch (error) {
      this.logger.warn('Failed to get cache statistics:', error);
      return {
        memoryUsed: 'Unknown',
        totalKeys: 0,
        searchCacheSize: 0,
        hitRate: 0,
        avgTtl: 0
      };
    }
  }

  parseRedisInfo(info, key) {
    const lines = info.split('\r\n');
    const line = lines.find(l => l.startsWith(key + ':'));
    return line ? line.split(':')[1] : '0';
  }

  calculateCacheHitRate() {
    // This would typically come from application metrics
    // For now, return a mock value
    return 0.85; // 85% hit rate
  }

  async getAverageTtl(keys) {
    if (keys.length === 0) return 0;
    
    const ttls = await Promise.all(
      keys.map(key => this.redis.ttl(key))
    );
    
    const validTtls = ttls.filter(ttl => ttl > 0);
    return validTtls.length > 0 
      ? validTtls.reduce((sum, ttl) => sum + ttl, 0) / validTtls.length
      : 0;
  }

  async getSystemAlerts() {
    const metrics = await this.getRealTimeMetrics();
    const alerts = [];

    // Check error rate
    if (metrics.searches.successRate < this.config.alertThresholds.lowSuccessRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'high',
        message: `Low success rate: ${(metrics.searches.successRate * 100).toFixed(1)}%`,
        value: metrics.searches.successRate,
        threshold: this.config.alertThresholds.lowSuccessRate,
        timestamp: new Date().toISOString()
      });
    }

    // Check average latency
    if (metrics.performance.avgResponseTime > this.config.alertThresholds.avgLatency) {
      alerts.push({
        type: 'latency',
        severity: 'medium',
        message: `High average response time: ${metrics.performance.avgResponseTime.toFixed(0)}ms`,
        value: metrics.performance.avgResponseTime,
        threshold: this.config.alertThresholds.avgLatency,
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  async exportAnalyticsData(timeframe, format) {
    const timeframeMap = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };

    const query = `
      SELECT 
        created_at,
        query_text,
        response_time_ms,
        results_count,
        success,
        user_id,
        session_id,
        filters
      FROM search_analytics 
      WHERE created_at > NOW() - INTERVAL $1
      ORDER BY created_at DESC
      LIMIT 10000
    `;

    const result = await this.pool.query(query, [
      timeframeMap[timeframe] || '24 hours'
    ]);

    if (format === 'csv') {
      return this.convertToCSV(result.rows);
    }

    return JSON.stringify(result.rows, null, 2);
  }

  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  async updateRealTimeMetrics() {
    this.metricsCache.realTime = await this.getRealTimeMetrics();
    this.metricsCache.lastUpdate = new Date();
  }

  async checkAlerts() {
    const alerts = await this.getSystemAlerts();
    
    // Log critical alerts
    alerts.forEach(alert => {
      if (alert.severity === 'high') {
        this.logger.error(`ALERT: ${alert.message}`, alert);
      } else {
        this.logger.warn(`Alert: ${alert.message}`, alert);
      }
    });

    return alerts;
  }

  broadcastMetricsUpdate() {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'metrics_update',
      data: this.metricsCache.realTime,
      timestamp: new Date().toISOString()
    });

    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  async sendMetricsToClient(ws) {
    try {
      const metrics = await this.getRealTimeMetrics();
      ws.send(JSON.stringify({
        type: 'initial_metrics',
        data: metrics,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      this.logger.error('Failed to send metrics to client:', error);
    }
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe_alerts':
        // Handle alert subscription
        ws.alertSubscription = true;
        break;
      case 'request_metrics':
        this.sendMetricsToClient(ws);
        break;
      default:
        this.logger.warn('Unknown WebSocket message type:', data.type);
    }
  }

  async start() {
    this.app.listen(this.port, () => {
      this.logger.info(`Search Analytics Dashboard listening on port ${this.port}`);
      this.logger.info(`WebSocket server listening on port ${this.port + 1}`);
    });
  }

  async stop() {
    if (this.wss) {
      this.wss.close();
    }
    
    await this.redis.quit();
    await this.pool.end();
    
    this.logger.info('Search Analytics Dashboard stopped');
  }
}

module.exports = SearchAnalyticsDashboard;

// Start the dashboard if run directly
if (require.main === module) {
  const dashboard = new SearchAnalyticsDashboard();
  dashboard.start().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGTERM', () => dashboard.stop());
  process.on('SIGINT', () => dashboard.stop());
}