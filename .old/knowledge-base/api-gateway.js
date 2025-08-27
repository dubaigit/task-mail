#!/usr/bin/env node

/**
 * Apple MCP Knowledge Base - API Gateway
 * 
 * Central API gateway that orchestrates all knowledge base services:
 * - Smart crawling and content ingestion
 * - Semantic search with vector embeddings
 * - Document processing and analysis
 * - Archon project context integration
 * - Authentication, rate limiting, and security
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const httpProxy = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Initialize services
const app = express();
const port = process.env.API_GATEWAY_PORT || 8080;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Redis for caching and rate limiting
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.File({ filename: 'logs/gateway-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/gateway-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Service endpoints
const services = {
  crawler: process.env.CRAWLER_SERVICE_URL || 'http://localhost:8081',
  search: process.env.SEARCH_SERVICE_URL || 'http://localhost:8082',
  processing: process.env.PROCESSING_SERVICE_URL || 'http://localhost:8083'
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://apple-mcp.com',
      'https://knowledge.apple-mcp.com'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  req.startTime = Date.now();
  
  logger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    });
  });
  
  next();
});

// Rate limiting
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: 'RATE_LIMITED', message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests, please try again later'
    });
  }
});

// Apply different rate limits based on endpoint
app.use('/api/v1/search', createRateLimit(15 * 60 * 1000, 100, 'Too many search requests'));
app.use('/api/v1/crawl', createRateLimit(60 * 60 * 1000, 10, 'Too many crawl requests'));
app.use('/api/v1', createRateLimit(15 * 60 * 1000, 1000, 'Too many API requests'));

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Access token required'
    });
  }

  try {
    // Check if it's an API key
    if (token.startsWith('kb_')) {
      const apiKey = await validateApiKey(token);
      if (!apiKey) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid API key'
        });
      }
      req.user = { id: apiKey.user_id, type: 'api_key', permissions: apiKey.permissions };
    } else {
      // JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    logger.warn('Authentication failed', { error: error.message, token: token.substring(0, 10) });
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Invalid token'
    });
  }
};

// Validate API key
async function validateApiKey(apiKey) {
  try {
    const query = `
      SELECT user_id, permissions, rate_limit 
      FROM api_keys 
      WHERE key_hash = $1 AND is_active = true
    `;
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    const result = await pool.query(query, [hashedKey]);
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('API key validation error:', error);
    return null;
  }
}

// Permission checking middleware
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }

  const userPermissions = req.user.permissions || [];
  if (!userPermissions.includes(permission) && !userPermissions.includes('admin')) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Permission '${permission}' required`
    });
  }

  next();
};

// Service proxy configuration
const createProxy = (target, pathRewrite = {}) => httpProxy.createProxyMiddleware({
  target,
  changeOrigin: true,
  pathRewrite,
  onError: (err, req, res) => {
    logger.error('Proxy error:', { error: err.message, target, path: req.path });
    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable'
    });
  },
  onProxyReq: (proxyReq, req) => {
    // Add request context to proxied requests
    proxyReq.setHeader('X-Request-ID', req.requestId);
    proxyReq.setHeader('X-User-ID', req.user?.id || 'anonymous');
  }
});

// Service health check cache
const serviceHealthCache = new Map();
const HEALTH_CACHE_TTL = 30000; // 30 seconds

async function checkServiceHealth(serviceName, url) {
  const cached = serviceHealthCache.get(serviceName);
  if (cached && Date.now() - cached.timestamp < HEALTH_CACHE_TTL) {
    return cached.healthy;
  }

  try {
    const response = await fetch(`${url}/health`, { timeout: 5000 });
    const healthy = response.ok;
    serviceHealthCache.set(serviceName, { healthy, timestamp: Date.now() });
    return healthy;
  } catch (error) {
    serviceHealthCache.set(serviceName, { healthy: false, timestamp: Date.now() });
    return false;
  }
}

// Main API Routes

// Knowledge Base Search API
app.use('/api/v1/search', 
  authenticateToken,
  requirePermission('read'),
  async (req, res, next) => {
    const healthy = await checkServiceHealth('search', services.search);
    if (!healthy) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Search service is currently unavailable'
      });
    }
    next();
  },
  createProxy(services.search, { '^/api/v1/search': '' })
);

// Document Management API
app.get('/api/v1/documents/:id', authenticateToken, requirePermission('read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { includeContent = true, includeMetadata = true } = req.query;

    let query = 'SELECT id, title, url, source_id, content_type, created_at, updated_at';
    
    if (includeContent === 'true') {
      query += ', content';
    }
    
    if (includeMetadata === 'true') {
      query += ', metadata';
    }
    
    query += ' FROM documents WHERE id = $1';
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Document not found'
      });
    }

    const document = result.rows[0];
    
    // Get source information
    const sourceQuery = 'SELECT name, source_type, authority_weight FROM sources WHERE id = $1';
    const sourceResult = await pool.query(sourceQuery, [document.source_id]);
    
    if (sourceResult.rows.length > 0) {
      document.source = sourceResult.rows[0];
    }

    res.json(document);

  } catch (error) {
    logger.error('Document fetch error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch document'
    });
  }
});

app.get('/api/v1/documents', authenticateToken, requirePermission('read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      source,
      technology,
      sortBy = 'relevance'
    } = req.query;

    const offset = (page - 1) * limit;
    let query = `
      SELECT d.id, d.title, d.url, d.content_type, d.created_at, d.updated_at,
             s.name as source_name, s.source_type
      FROM documents d
      JOIN sources s ON d.source_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (source) {
      query += ` AND s.name = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (technology) {
      const technologies = Array.isArray(technology) ? technology : [technology];
      query += ` AND d.metadata->>'technology' = ANY($${paramIndex})`;
      params.push(technologies);
      paramIndex++;
    }

    // Sorting
    switch (sortBy) {
      case 'date':
        query += ' ORDER BY d.updated_at DESC';
        break;
      case 'popularity':
        query += ' ORDER BY d.authority_score DESC';
        break;
      case 'authority':
        query += ' ORDER BY s.authority_weight DESC';
        break;
      default:
        query += ' ORDER BY d.authority_score DESC, d.updated_at DESC';
    }

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM documents d JOIN sources s ON d.source_id = s.id WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (source) {
      countQuery += ` AND s.name = $${countParamIndex}`;
      countParams.push(source);
      countParamIndex++;
    }

    if (technology) {
      const technologies = Array.isArray(technology) ? technology : [technology];
      countQuery += ` AND d.metadata->>'technology' = ANY($${countParamIndex})`;
      countParams.push(technologies);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      documents: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: (page * limit) < total,
        hasPrevious: page > 1
      }
    });

  } catch (error) {
    logger.error('Documents list error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch documents'
    });
  }
});

// Content Sources Management
app.get('/api/v1/sources', authenticateToken, requirePermission('read'), async (req, res) => {
  try {
    const query = `
      SELECT id, name, base_url, source_type, is_active, 
             crawl_frequency, last_crawled, authority_weight,
             (SELECT COUNT(*) FROM documents WHERE source_id = sources.id) as document_count
      FROM sources
      ORDER BY authority_weight DESC, name
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);

  } catch (error) {
    logger.error('Sources list error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch sources'
    });
  }
});

app.post('/api/v1/sources', authenticateToken, requirePermission('write'), async (req, res) => {
  try {
    const {
      name,
      baseUrl,
      sourceType,
      crawlFrequency = '1 day',
      authorityWeight = 1.0,
      crawlConfig = {}
    } = req.body;

    if (!name || !baseUrl || !sourceType) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Name, baseUrl, and sourceType are required'
      });
    }

    const query = `
      INSERT INTO sources (name, base_url, source_type, crawl_frequency, authority_weight, crawl_config)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      name,
      baseUrl,
      sourceType,
      crawlFrequency,
      authorityWeight,
      JSON.stringify(crawlConfig)
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    logger.error('Source creation error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create source'
    });
  }
});

// Crawling API
app.use('/api/v1/crawl',
  authenticateToken,
  requirePermission('write'),
  async (req, res, next) => {
    const healthy = await checkServiceHealth('crawler', services.crawler);
    if (!healthy) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Crawler service is currently unavailable'
      });
    }
    next();
  },
  createProxy(services.crawler, { '^/api/v1/crawl': '/crawl' })
);

// Document Processing API
app.use('/api/v1/processing',
  authenticateToken,
  requirePermission('write'),
  async (req, res, next) => {
    const healthy = await checkServiceHealth('processing', services.processing);
    if (!healthy) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Processing service is currently unavailable'
      });
    }
    next();
  },
  createProxy(services.processing, { '^/api/v1/processing': '' })
);

// Analytics API
app.get('/api/v1/analytics/search', authenticateToken, requirePermission('read'), async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // This would typically pull from an analytics database
    // For now, return basic statistics from the main database
    
    const totalDocsQuery = 'SELECT COUNT(*) FROM documents';
    const totalSourcesQuery = 'SELECT COUNT(*) FROM sources WHERE is_active = true';
    const recentCrawlsQuery = `
      SELECT COUNT(*) FROM crawl_jobs 
      WHERE started_at > NOW() - INTERVAL '${timeRange === '24h' ? '1 day' : '7 days'}'
    `;

    const [totalDocs, totalSources, recentCrawls] = await Promise.all([
      pool.query(totalDocsQuery),
      pool.query(totalSourcesQuery),
      pool.query(recentCrawlsQuery)
    ]);

    res.json({
      metrics: {
        totalDocuments: parseInt(totalDocs.rows[0].count),
        activeSources: parseInt(totalSources.rows[0].count),
        recentCrawls: parseInt(recentCrawls.rows[0].count),
        // Mock data for search metrics
        totalSearches: 1250,
        averageLatency: 180,
        successRate: 0.94
      },
      timeSeries: [] // Would contain actual time series data
    });

  } catch (error) {
    logger.error('Analytics error:', error);
    res.status(500).json({
      error: 'ANALYTICS_ERROR',
      message: 'Failed to get analytics'
    });
  }
});

// System Health Check
app.get('/api/v1/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check Redis
    await redis.ping();
    
    // Check all services
    const serviceHealth = await Promise.all([
      checkServiceHealth('crawler', services.crawler),
      checkServiceHealth('search', services.search),
      checkServiceHealth('processing', services.processing)
    ]);

    const allHealthy = serviceHealth.every(healthy => healthy);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        crawler: serviceHealth[0] ? 'healthy' : 'unhealthy',
        search: serviceHealth[1] ? 'healthy' : 'unhealthy',
        processing: serviceHealth[2] ? 'healthy' : 'unhealthy'
      }
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API Documentation endpoint
app.get('/api/v1/docs', (req, res) => {
  res.json({
    title: 'Apple MCP Knowledge Base API',
    version: '1.0.0',
    description: 'Intelligent knowledge management and search system',
    endpoints: {
      search: {
        'POST /api/v1/search': 'Perform semantic search',
        'POST /api/v1/search/contextual': 'Contextual search with Archon integration'
      },
      documents: {
        'GET /api/v1/documents': 'List documents',
        'GET /api/v1/documents/{id}': 'Get document details'
      },
      sources: {
        'GET /api/v1/sources': 'List content sources',
        'POST /api/v1/sources': 'Add new content source'
      },
      crawling: {
        'POST /api/v1/crawl/trigger': 'Trigger crawl job',
        'GET /api/v1/crawl/jobs/{id}': 'Get crawl job status'
      },
      analytics: {
        'GET /api/v1/analytics/search': 'Search analytics and insights'
      }
    },
    authentication: {
      apiKey: 'Authorization: Bearer kb_your_api_key',
      jwt: 'Authorization: Bearer jwt_token'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    requestId: req.requestId,
    path: req.path
  });

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    requestId: req.requestId
  });
});

// Start server
app.listen(port, () => {
  logger.info(`API Gateway listening on port ${port}`);
  logger.info('Service endpoints:', services);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  await redis.quit();
  await pool.end();
  
  process.exit(0);
});

module.exports = app;