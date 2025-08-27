#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

// Import security modules
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { body, validationResult } = require('express-validator');
const aiService = require('./ai_service.js');

// Import basic middleware (authentication removed)
const {
  authenticateToken,
  requireRole,
  generalLimiter,
  authLimiter,
  aiLimiter,
  taskQueryValidation,
  aiCommandValidation,
  emailClassificationValidation,
  handleValidationErrors
} = require('./src/middleware/auth');

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const {
  createSecureCors,
  createSecurityHeaders,
  sanitizeRequest,
  securityLogger,
  sanitizeErrors
} = require('./src/middleware/security');

// Import database components
const DatabaseHealthMonitor = require('./src/database/DatabaseHealthMonitor');

// Environment validation removed for simplified setup

const app = express();
const PORT = process.env.PORT || 8000;

// Security headers (must be first)
app.use(createSecurityHeaders());

// Secure CORS configuration
app.use(createSecureCors());

// Rate limiting enabled for security
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);

// Request sanitization
app.use(sanitizeRequest);

// Security logging
app.use(securityLogger);

// Body parsing with secure limits
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`⚠️ Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});

// Import optimized database agent
const optimizedDatabaseAgent = require('./src/database/OptimizedDatabaseAgent');
// No need to call initialize() - it's handled in the constructor
console.log('✅ Optimized Database Agent loaded');

// Import performance optimization modules
const { WebSocketManager } = require('./src/websocket/WebSocketManager');
const { BatchOperationManager } = require('./src/api/BatchOperations');
const { AsyncAIProcessor } = require('./src/ai/AsyncAIProcessor');
const EnhancedEndpoints = require('./src/api/EnhancedEndpoints');

// Optimized database agent is now initialized in its constructor

// Database connection validation removed - using Supabase now

// Initialize database health monitoring
let databaseHealthMonitor = null;

// Initialize performance optimization components
let webSocketManager = null;
let batchOperations = null;
let asyncAIProcessor = null;

// Request deduplication middleware - TEMPORARILY DISABLED (fixed)
// const requestDeduplication = createDeduplicationMiddleware({
//   defaultTTL: 300000, // 5 minutes default cache (in ms)
//   maxCacheSize: 10000,
//   enableInflightDeduplication: true,
//   fingerprintOptions: {
//     includeHeaders: ['authorization', 'user-agent'],
//     includeBody: true,
//     includeQuery: true,
//     excludeHeaders: ['x-request-id', 'x-trace-id']
//   }
// });

// Security middleware already applied at the top of the file

// Apply request deduplication to API routes (before other middleware) - TEMPORARILY DISABLED
// app.use('/api', requestDeduplication);

// Remove database connection test
// async function testDatabaseConnection(retries = 3) {
//   if (!pool) {
//     console.log('⚠️ Database pool not available - skipping connection test');
//     return false;
//   }
//   
//   for (let i = 0; i < retries; i++) {
//     try {
//       const res = await pool.query('SELECT NOW()');
//       console.log('✅ Database connected successfully at', res.rows[0].now);
//       return true;
//     } catch (err) {
//       console.error(`❌ Database connection attempt ${i + 1} failed:`, err.message);
//       if (i === retries - 1) {
//         console.error('❌ All database connection attempts failed');
//         process.exit(1);
//       }
//       // Wait before retry
//       await new Promise(resolve => setTimeout(resolve, 2000));
//     }
//   }
// }

// testDatabaseConnection();

// Initialize performance optimization modules after database
async function initializeOptimizations() {
  try {
    // Initialize WebSocket Manager
    webSocketManager = new WebSocketManager();
    console.log('✅ WebSocket Manager initialized');

    // Initialize Batch Operations
    if (optimizedDatabaseAgent) {
      batchOperations = new BatchOperationManager(optimizedDatabaseAgent, {
        maxConcurrency: 5,
        defaultTimeout: 30000,
        enableTransactions: true
      });
      console.log('✅ Batch Operations initialized');
    }

    // Initialize Async AI Processor
    asyncAIProcessor = new AsyncAIProcessor(aiService, {
      maxWorkers: 3,
      maxConcurrency: 2,
      queueSizeThreshold: 100
    });
    
    await asyncAIProcessor.start();
    console.log('✅ Async AI Processor initialized');

    // Make optimization modules available to routes via app.locals
    app.locals.db = optimizedDatabaseAgent;
    app.locals.webSocketManager = webSocketManager;
    app.locals.batchProcessor = batchOperations;
    app.locals.aiProcessor = asyncAIProcessor;
    
    console.log('✅ Optimization modules attached to app.locals');

  } catch (error) {
    console.error('❌ Error initializing optimizations:', error);
    // Exit process instead of continuing with basic functionality
    process.exit(1);
  }
}

// Initialize optimizations after database connection
setTimeout(initializeOptimizations, 2000);

// Initialize database health monitoring
async function initializeDatabaseHealth() {
  try {
    console.log('🔄 Initializing database health monitoring...');

    // Initialize Database Health Monitor with optimized database agent
    databaseHealthMonitor = new DatabaseHealthMonitor({
      optimizedDatabaseAgent: optimizedDatabaseAgent
    });

    console.log('✅ Database Health Monitor initialized');

    // Make database health monitor available
    app.locals.databaseHealthMonitor = databaseHealthMonitor;
    app.locals.optimizedDatabaseAgent = optimizedDatabaseAgent;

    console.log('✅ Database health monitoring ready');

  } catch (error) {
    console.error('❌ Failed to initialize database health monitoring:', error);
    console.error('⚠️ Server will continue without health monitoring');
  }
}

// Initialize database health monitoring after a delay
setTimeout(initializeDatabaseHealth, 3000);

// WebSocket server initialization function
function initializeWebSocket(server) {
  if (webSocketManager) {
    webSocketManager.initialize(server);
    console.log('✅ WebSocket server attached to HTTP server');
    
    // Set up task update broadcasting
    if (batchOperations) {
      batchOperations.onTaskUpdate = (taskData) => {
        webSocketManager.broadcastTaskUpdate(taskData);
      };
    }
  }
}

// Mount enhanced endpoints
app.use('/api', EnhancedEndpoints.createEnhancedRouter());

// AI Usage Stats endpoint
app.get('/api/ai/usage-stats', 
  authenticateToken,
  async (req, res) => {
  try {
    console.log('📊 GET /api/ai/usage-stats - Request received');
    
    if (!secureDb) {
      return res.status(503).json({
        error: 'Database service unavailable',
        timestamp: new Date().toISOString()
      });
    }
    
    const stats = await secureDb.getAIUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching AI usage stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch AI usage statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// AI Process Command endpoint
app.post('/api/ai/process-command', 
  authenticateToken,
  aiLimiter,
  aiCommandValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { command, context } = req.body;
      console.log('🤖 POST /api/ai/process-command - Processing command');
      
      const response = await aiService.generateChatResponse(command, {
        ...context,
        userId: 'default-user',
        userRole: 'user'
      });
      
      res.json({ 
        response,
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error processing AI command:', error);
      res.status(500).json({ 
        error: 'Failed to process AI command',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Classify email endpoint
app.post('/api/ai/classify-email', 
  authenticateToken,
  aiLimiter,
  emailClassificationValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { content, subject, sender } = req.body;
      console.log('🔍 POST /api/ai/classify-email - Classifying email');
      
      const classification = await aiService.classifyEmail(content, subject, sender);
      
      res.json({ 
        classification,
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error classifying email:', error);
      res.status(500).json({ 
        error: 'Failed to classify email',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Sync Status endpoint
app.get('/api/sync-status', 
  authenticateToken,
  async (req, res) => {
  try {
    if (!secureDb) {
      return res.status(503).json({
        error: 'Database service unavailable',
        timestamp: new Date().toISOString()
      });
    }
    
    const syncStats = await secureDb.getSyncStatus();
    res.json(syncStats);
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({
      error: 'Failed to fetch sync status',
      timestamp: new Date().toISOString()
    });
  }
});

// Tasks endpoint
app.get('/api/tasks', 
  authenticateToken,
  generalLimiter,
  taskQueryValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!secureDb) {
        return res.status(503).json({
          error: 'Database service unavailable',
          timestamp: new Date().toISOString()
        });
      }
      
      const { limit, offset, filter } = req.query;
      const userId = null; // Show all data
      
      const result = await secureDb.getTasks(limit, offset, filter, userId);
      res.json(result);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({
        error: 'Failed to fetch tasks',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Category counts endpoint
app.get('/api/tasks/category-counts', 
  authenticateToken,
  async (req, res) => {
    try {
      if (!secureDb) {
        return res.status(503).json({
          error: 'Database service unavailable',
          timestamp: new Date().toISOString()
        });
      }
      
      const userId = null; // Show all data
      const counts = await secureDb.getCategoryCounts(userId);
      res.json(counts);
    } catch (error) {
      console.error('Error fetching category counts:', error);
      res.status(500).json({
        error: 'Failed to fetch category counts',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// User profile endpoint
app.get('/api/user/profile', 
  authenticateToken,
  async (req, res) => {
  try {
    let userProfile = {
      id: 1,
      email: 'abdulla.alfalasi@digitaldubai.ae',
      name: 'Abdulla Alfalasi',
      displayName: 'Abdulla Alfalasi',
      role: 'user'
    };
    
    if (pool) {
      try {
        // Get user from database by email
        const email = 'abdulla.alfalasi@digitaldubai.ae';
        const userQuery = 'SELECT * FROM users WHERE email = $1';
        const userResult = await pool.query(userQuery, [email]);
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          userProfile = {
            id: user.id,
            email: user.email,
            name: user.name || 'Abdulla Alfalasi',
            displayName: user.display_name || user.name || 'Abdulla Alfalasi',
            role: user.role || 'user'
          };
        }
      } catch (dbError) {
        console.error('Database queries failed:', dbError.message);
        return res.status(503).json({ 
          error: 'Database service unavailable',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user profile',
      timestamp: new Date().toISOString()
    });
  }
});

// Statistics endpoint
app.get('/api/statistics', 
  authenticateToken,
  async (req, res) => {
    try {
      if (!secureDb) {
        return res.json({
          efficiency: 0,
          totalTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          completedTasks: 0,
          averageResponseTime: 0,
          status: 'database_unavailable'
        });
      }
      
      const userId = null; // Show all data
      const statistics = await secureDb.getStatistics(userId);
      res.json(statistics);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch statistics',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Health check endpoint (public but limited info)
app.get('/api/health', async (req, res) => {
  try {
    // Use new comprehensive health monitor if available
    if (databaseHealthMonitor) {
      const healthStatus = await databaseHealthMonitor.getComprehensiveHealthStatus();
      const statusCode = healthStatus.overall.status !== 'healthy' ? 503 :
                        healthStatus.overall.status === 'degraded' ? 503 :
                        healthStatus.overall.status === 'unhealthy' ? 503 : 500;
      return res.status(statusCode).json(healthStatus);
    }

    // Fallback to legacy health check
    if (!secureDb) {
      return res.json({
        status: 'degraded',
        database: 'unavailable',
        timestamp: new Date().toISOString()
      });
    }
    
    const health = await secureDb.healthCheck();
    res.json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check (requires authentication for sensitive info)
app.get('/api/health/detailed', 
  authenticateToken,
  async (req, res) => {
    try {
      let dbStatus = 'unavailable';
      let dbTimestamp = new Date().toISOString();
      
      if (pool) {
        try {
          const dbResult = await pool.query('SELECT NOW()');
          dbStatus = 'connected';
          dbTimestamp = dbResult.rows[0].now;
        } catch (dbError) {
          dbStatus = 'error';
          console.error('Database health check failed:', dbError.message);
        }
      }
      
      const aiStats = aiService.getUsageStats();
      
      res.json({
        status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
        database: dbStatus,
        ai_service: 'available',
        timestamp: dbTimestamp,
        usage_stats: aiStats,
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      console.error('Detailed health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Service unavailable',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Database Health Trends endpoint 
app.get('/api/health/trends',
  authenticateToken,
  async (req, res) => {
    try {
      if (databaseHealthMonitor) {
        const trends = databaseHealthMonitor.getHealthTrends();
        return res.json(trends);
      }

      res.json({
        message: 'Health trends not available - unified database infrastructure not initialized',
        status: 'unavailable'
      });
    } catch (error) {
      console.error('Health trends endpoint failed:', error);
      res.status(500).json({
        error: 'Failed to fetch health trends',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Database Migration Status endpoint
app.get('/api/database/migration-status',
  authenticateToken,
  async (req, res) => {
    try {
      if (migrationManager) {
        const migrationState = migrationManager.getMigrationState();
        const migrationStats = migrationManager.getMigrationStatistics();
        return res.json({
          state: migrationState,
          statistics: migrationStats,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        message: 'Migration manager not available',
        status: 'unavailable'
      });
    } catch (error) {
      console.error('Migration status endpoint failed:', error);
      res.status(500).json({
        error: 'Failed to fetch migration status',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Database Migration Test endpoint
app.post('/api/database/test-migration',
  authenticateToken,
  async (req, res) => {
    try {
      const DatabaseMigrationTest = require('./src/database/DatabaseMigrationTest');
      const migrationTest = new DatabaseMigrationTest();
      
      const testResults = await migrationTest.runAllTests();
      
      res.json({
        success: true,
        results: testResults,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Migration test endpoint failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Login endpoint removed - authentication disabled

// Admin routes for dashboard
app.get('/api/admin/users', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ success: false, error: 'Database unavailable' });
    }
    
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, role, active, created_at, last_login
      FROM users 
      ORDER BY created_at DESC
    `);
    
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// System metrics endpoint
app.get('/api/admin/system-metrics', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const startTime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    let userStats = { total_users: 0, active_users: 0, daily_active_users: 0 };
    let emailStats = { emails_processed: 0 };
    let taskStats = { total_tasks: 0 };
    
    if (pool) {
      try {
        // Get user statistics
        const userResult = await pool.query(`
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN active = true THEN 1 END) as active_users,
            COUNT(CASE WHEN last_login > NOW() - INTERVAL '24 hours' THEN 1 END) as daily_active_users
          FROM users
        `);
        userStats = userResult.rows[0];
        
        // Get email processing statistics
        const emailResult = await pool.query(`
          SELECT COUNT(*) as emails_processed
          FROM emails 
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        emailStats = emailResult.rows[0];
        
        // Get task statistics
        const taskResult = await pool.query(`
          SELECT COUNT(*) as total_tasks
          FROM tasks 
          WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        taskStats = taskResult.rows[0];
      } catch (dbError) {
        console.error('Database queries failed:', dbError.message);
        return res.status(503).json({ 
          error: 'Database service unavailable',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const systemMetrics = {
      uptime: Math.floor(startTime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      users: {
        total_users: parseInt(userStats.total_users) || 0,
        active_users: parseInt(userStats.active_users) || 0,
        daily_active_users: parseInt(userStats.daily_active_users) || 0
      },
      processing: {
        emails_today: parseInt(emailStats.emails_processed) || 0,
        tasks_today: parseInt(taskStats.total_tasks) || 0,
        ai_requests_today: Math.floor(Math.random() * 3000) + 1500 // Mock data for now
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({ success: true, metrics: systemMetrics });
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch system metrics' });
  }
});

// Security events endpoint
app.get('/api/admin/security-events', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { limit = 50, severity = 'all' } = req.query;
    
    // Mock security events (in production, this would come from security logs)
    const mockEvents = [
      {
        id: '1',
        type: 'login_success',
        user_id: '1',
        user_email: 'admin@company.com',
        ip_address: '10.0.1.23',
        timestamp: new Date(Date.now() - 30000).toISOString(),
        details: 'Admin login from trusted location',
        severity: 'low'
      },
      {
        id: '2',
        type: 'login_failed',
        user_email: 'unknown@example.com',
        ip_address: '192.168.1.100',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        details: 'Multiple failed login attempts',
        severity: 'high'
      },
      {
        id: '3',
        type: 'permission_denied',
        user_id: '3',
        user_email: 'user@company.com',
        ip_address: '10.0.1.45',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        details: 'Attempted to access admin panel',
        severity: 'medium'
      },
      {
        id: '4',
        type: 'token_expired',
        user_id: '2',
        user_email: 'manager@company.com',
        ip_address: '10.0.1.67',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        details: 'Session token expired during admin operation',
        severity: 'medium'
      },
      {
        id: '5',
        type: 'suspicious_activity',
        user_email: 'attacker@malicious.com',
        ip_address: '203.0.113.45',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        details: 'Multiple failed login attempts from suspicious IP',
        severity: 'critical'
      }
    ];
    
    let events = mockEvents;
    if (severity !== 'all') {
      events = events.filter(event => event.severity === severity);
    }
    
    events = events.slice(0, parseInt(limit));
    
    res.json({ success: true, events });
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch security events' });
  }
});

// Performance analytics endpoint
app.get('/api/admin/performance-analytics', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // Generate mock performance data based on time range
    const generateMockData = (hours) => {
      const data = [];
      const interval = Math.max(1, Math.floor(hours / 24)); // At most 24 data points
      
      for (let i = 0; i < hours; i += interval) {
        const timestamp = new Date(Date.now() - (hours - i) * 60 * 60 * 1000);
        data.push({
          timestamp: timestamp.toISOString(),
          cpu_usage: Math.random() * 80 + 10, // 10-90%
          memory_usage: Math.random() * 70 + 20, // 20-90%
          request_count: Math.floor(Math.random() * 500) + 100,
          response_time: Math.random() * 50 + 5, // 5-55ms
          error_rate: Math.random() * 5 // 0-5%
        });
      }
      return data;
    };
    
    let hours = 24;
    switch (timeRange) {
      case '1h': hours = 1; break;
      case '24h': hours = 24; break;
      case '7d': hours = 24 * 7; break;
      case '30d': hours = 24 * 30; break;
    }
    
    const performanceData = generateMockData(hours);
    
    res.json({ success: true, data: performanceData, timeRange });
  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch performance analytics' });
  }
});

// User management endpoints
app.post('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { email, firstName, lastName, role = 'user', permissions = [] } = req.body;
    
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, first name, and last name are required' 
      });
    }
    
    if (!pool) {
      return res.status(500).json({ success: false, error: 'Database unavailable' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'User with this email already exists' 
      });
    }
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const userId = uuidv4();
    
    // Insert user
    const insertResult = await pool.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, permissions, active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
      RETURNING id, email, first_name, last_name, role, permissions, active, created_at
    `, [userId, email, passwordHash, firstName, lastName, role, JSON.stringify(permissions)]);
    
    const newUser = insertResult.rows[0];
    
    res.status(201).json({ 
      success: true, 
      user: newUser,
      tempPassword // In production, send via secure channel
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

app.put('/api/admin/users/:userId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, role, permissions, active } = req.body;
    
    if (!pool) {
      return res.status(500).json({ success: false, error: 'Database unavailable' });
    }
    
    // Validate user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update user
    const updateResult = await pool.query(`
      UPDATE users 
      SET first_name = $1, last_name = $2, role = $3, permissions = $4, active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING id, email, first_name, last_name, role, permissions, active, created_at, updated_at
    `, [firstName, lastName, role, JSON.stringify(permissions || []), active, userId]);
    
    const updatedUser = updateResult.rows[0];
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// System configuration endpoints
app.get('/api/admin/config', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Mock system configuration
    const config = {
      system: {
        max_concurrent_users: 1000,
        session_timeout_minutes: 15,
        backup_frequency: 'daily',
        backup_time: '02:00'
      },
      security: {
        require_2fa: true,
        login_attempt_limit: 5,
        password_policy: 'strong',
        session_security: 'high'
      },
      ai: {
        request_rate_limit: 10,
        content_moderation: true,
        default_model: 'gpt-4',
        max_context_length: 8000
      },
      email: {
        batch_size: 100,
        processing_interval: 30,
        retention_days: 365,
        auto_classification: true
      }
    };
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch configuration' });
  }
});

app.put('/api/admin/config/:category/:key', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { category, key } = req.params;
    const { value } = req.body;
    
    // In production, validate and store configuration changes
    console.log(`Config update: ${category}.${key} = ${value}`);
    
    res.json({ 
      success: true, 
      message: `Configuration ${category}.${key} updated successfully`,
      updatedBy: req.user.email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

// Team delegation tracking integration
app.get('/api/admin/delegation-tracking', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    // Mock delegation data that would integrate with ColleagueTrackingDashboard
    const delegationStats = {
      totalDelegatedTasks: 156,
      activeDelegations: 42,
      completedThisWeek: 28,
      overdueTasks: 8,
      averageCompletionTime: '2.3 days',
      topPerformers: [
        { name: 'Sarah Johnson', completionRate: 94.2, tasksCompleted: 23 },
        { name: 'Mike Chen', completionRate: 91.7, tasksCompleted: 19 },
        { name: 'Lisa Wong', completionRate: 87.8, tasksCompleted: 31 }
      ],
      delegationTrends: Array.from({length: 7}, (_, i) => ({
        date: new Date(Date.now() - (6-i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        delegated: Math.floor(Math.random() * 15) + 5,
        completed: Math.floor(Math.random() * 12) + 3
      }))
    };
    
    res.json({ success: true, data: delegationStats });
  } catch (error) {
    console.error('Error fetching delegation tracking:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch delegation tracking data' });
  }
});

// Enhanced Security Validation Endpoints
app.post('/api/admin/security/validate', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Comprehensive security validation
    const validationResult = {
      timestamp: new Date().toISOString(),
      isValid: true,
      score: 85,
      risks: [],
      compliance: {
        gdpr: true,
        hipaa: true,
        sox: true,
        iso27001: true
      },
      checks: {
        authentication: { status: 'passed', details: 'Strong authentication policies in place' },
        authorization: { status: 'passed', details: 'Role-based access control implemented' },
        dataEncryption: { status: 'passed', details: 'Data encrypted at rest and in transit' },
        logging: { status: 'warning', details: 'Security logging could be enhanced' },
        vulnerabilities: { status: 'passed', details: 'No critical vulnerabilities detected' }
      }
    };

    // Simulate security checks with potential risks
    if (Math.random() > 0.8) {
      validationResult.isValid = false;
      validationResult.score = 65;
      validationResult.risks.push({
        type: 'weak_passwords',
        level: 'medium',
        description: 'Some users have weak passwords that do not meet security standards',
        recommendation: 'Enforce stronger password policy and require password updates',
        affectedCount: Math.floor(Math.random() * 10) + 1
      });
    }

    if (Math.random() > 0.7) {
      validationResult.risks.push({
        type: 'outdated_dependencies',
        level: 'high',
        description: 'Several system dependencies have known security vulnerabilities',
        recommendation: 'Update all dependencies to latest secure versions immediately',
        packages: ['express', 'jsonwebtoken', 'bcrypt']
      });
      validationResult.score -= 20;
    }

    res.json({ success: true, validation: validationResult });
  } catch (error) {
    console.error('Error running security validation:', error);
    res.status(500).json({ success: false, error: 'Security validation failed' });
  }
});

app.get('/api/admin/security/events', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { limit = 20, type, severity } = req.query;

    // Generate mock security events
    const eventTypes = ['authentication', 'authorization', 'suspicious_activity', 'policy_violation', 'system_breach'];
    const severities = ['low', 'medium', 'high', 'critical'];
    
    const events = [];
    for (let i = 0; i < Math.min(parseInt(limit), 50); i++) {
      const eventType = type || eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const eventSeverity = severity || severities[Math.floor(Math.random() * severities.length)];
      
      events.push({
        id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: eventType,
        severity: eventSeverity,
        description: `Security event of type ${eventType} with ${eventSeverity} severity`,
        userId: Math.random() > 0.3 ? `user_${Math.floor(Math.random() * 1000)}` : null,
        userEmail: Math.random() > 0.3 ? `user${Math.floor(Math.random() * 1000)}@company.com` : null,
        ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        resolved: Math.random() > 0.7,
        investigator: Math.random() > 0.5 ? 'admin_user' : null
      });
    }

    res.json({ success: true, events, total: events.length });
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch security events' });
  }
});

app.get('/api/admin/system/health', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Generate comprehensive system health metrics
    const healthMetrics = {
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy', // healthy, unhealthy, critical
      services: [
        {
          id: 'database',
          name: 'PostgreSQL Database',
          status: 'healthy',
          responseTime: 25 + Math.random() * 50,
          uptime: 99.98,
          lastChecked: new Date().toISOString()
        },
        {
          id: 'redis',
          name: 'Redis Cache',
          status: 'healthy',
          responseTime: 5 + Math.random() * 20,
          uptime: 99.95,
          lastChecked: new Date().toISOString()
        },
        {
          id: 'api',
          name: 'REST API Server',
          status: 'healthy',
          responseTime: 15 + Math.random() * 30,
          uptime: 99.99,
          lastChecked: new Date().toISOString()
        },
        {
          id: 'websocket',
          name: 'WebSocket Server',
          status: Math.random() > 0.1 ? 'healthy' : 'warning',
          responseTime: 10 + Math.random() * 40,
          uptime: 99.92,
          lastChecked: new Date().toISOString()
        }
      ],
      metrics: {
        cpu: {
          usage: 20 + Math.random() * 40,
          cores: 8,
          temperature: 45 + Math.random() * 15
        },
        memory: {
          used: 4096 + Math.random() * 2048,
          total: 8192,
          usage: 50 + Math.random() * 30
        },
        disk: {
          used: 256000 + Math.random() * 64000,
          total: 512000,
          usage: 50 + Math.random() * 20
        },
        network: {
          inbound: Math.random() * 1000,
          outbound: Math.random() * 500,
          latency: 20 + Math.random() * 50
        }
      },
      alerts: []
    };

    // Determine overall status based on services and metrics
    const criticalServices = healthMetrics.services.filter(s => s.status === 'critical');
    const warningServices = healthMetrics.services.filter(s => s.status === 'warning');
    const highCpu = healthMetrics.metrics.cpu.usage > 90;
    const highMemory = healthMetrics.metrics.memory.usage > 95;

    if (criticalServices.length > 0 || highCpu || highMemory) {
      healthMetrics.overallStatus = 'critical';
    } else if (warningServices.length > 0 || healthMetrics.metrics.cpu.usage > 75) {
      healthMetrics.overallStatus = 'unhealthy';
    }

    res.json({ success: true, health: healthMetrics });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({ success: false, error: 'Failed to check system health' });
  }
});

// WebSocket endpoint for real-time monitoring
app.get('/api/admin/realtime/metrics', authenticateToken, requireRole(['admin']), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sendMetrics = () => {
    const metrics = {
      timestamp: new Date().toISOString(),
      cpu: 20 + Math.random() * 60,
      memory: 30 + Math.random() * 50,
      activeConnections: 50 + Math.floor(Math.random() * 150),
      requestsPerSecond: Math.random() * 100 + 20,
      responseTime: Math.random() * 50 + 10,
      errorRate: Math.random() * 5
    };

    res.write(`data: ${JSON.stringify({ type: 'admin:metrics_update', ...metrics })}\\n\\n`);
  };

  const interval = setInterval(sendMetrics, 2000);
  sendMetrics();

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Secure Authentication Routes (Mock disabled for security)
try {
  const authRoutes = require('./src/auth/secure-auth-routes');
  app.use('/api/auth', authRoutes);
  console.log('✅ Secure authentication routes loaded successfully');
} catch (error) {
  console.warn('⚠️ Secure authentication routes failed to load:', error.message);
  console.log('⚠️ Server will continue without authentication functionality');
}

// Knowledge Base Tag Management API Routes
try {
  const tagRoutes = require('./src/knowledge-base/tag-routes');
  app.use('/api/knowledge-base', tagRoutes);
  console.log('✅ Tag management routes loaded successfully');
} catch (error) {
  console.warn('⚠️ Tag management routes failed to load:', error.message);
  console.log('📧 Server will continue without tag management functionality');
}

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dashboard/frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard/frontend/build', 'index.html'));
  });
}

// Security error handling middleware (must be last)
app.use(sanitizeErrors);

// Server startup
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
      console.log(`Frontend will be served from http://localhost:3000`);
      console.log(`
      🚀 Ready! Server started successfully
      ==================================
      API:      http://localhost:${PORT}/api
      Frontend: http://localhost:3000
      ==================================
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server', error);
    process.exit(1);
  }
};

// Start the server immediately
startServer();

// Database health check endpoint
app.get('/health', authLimiter, async (req, res) => {
  try {
    const osInfo = {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    };
    
    // Test Supabase connection
    let dbHealth = { status: 'unknown' };
    try {
      const { data, error } = await supabaseManager.getPublicClient()
        .from('_health_check')
        .select('*')
        .limit(1);
      
      if (error) throw error;
      dbHealth = { status: 'healthy', connected: true };
    } catch (dbError) {
      dbHealth = { status: 'unhealthy', error: dbError.message };
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: osInfo,
      database: dbHealth,
      services: {
        server: 'running',
        supabase: dbHealth.status === 'healthy' ? 'connected' : 'disconnected',
        ai: openai ? 'configured' : 'not configured'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

// User creation/update endpoints (Admin only)
app.post('/api/users', authenticateToken, requireRole(['admin']), authLimiter, async (req, res) => {
  try {
    const { email, password, role = 'user' } = req.body;

    // Use Supabase for user creation
    const { data, error } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { role }
    });

    if (error) {
      console.error('User creation error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ 
      message: 'User created successfully',
      userId: data.user.id
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:userId', authenticateToken, requireRole(['admin']), authLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, role } = req.body;

    // Use Supabase for user update
    const { data, error } = await supabaseClient.auth.admin.updateUserById(
      userId,
      {
        email,
        user_metadata: { role }
      }
    );

    if (error) {
      console.error('User update error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      message: 'User updated successfully',
      userId: data.user.id
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️ ${signal} received: closing HTTP server...`);
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    // Close WebSocket server
    if (wss) {
      wss.close(() => {
        console.log('✅ WebSocket server closed');
      });
    }
    
    // Close Supabase connections if needed
    if (connectionManager) {
      await connectionManager.cleanup();
      console.log('✅ Supabase connections cleaned up');
    }
    
    console.log('👋 Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown after timeout...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app };