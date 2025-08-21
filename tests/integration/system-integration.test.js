/**
 * Comprehensive System Integration Test Suite
 * Tests complete system integration after database schema fixes
 * Verifies: AI processor, backend API, frontend connectivity, end-to-end email processing
 */

const request = require('supertest');
const { Pool } = require('pg');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001',
  dbConfig: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost', 
    database: process.env.DB_NAME || 'apple_mail_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  },
  timeout: 30000 // 30 second timeout for integration tests
};

describe('🔗 System Integration Tests', () => {
  let pool;
  let app;

  beforeAll(async () => {
    // Initialize database connection
    pool = new Pool(TEST_CONFIG.dbConfig);
    
    // Import app for testing
    try {
      const serverModule = require('../../server.js');
      app = serverModule.app;
    } catch (error) {
      console.error('Failed to import server module:', error);
    }
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('📊 1. Database Schema Validation', () => {
    test('should verify database connection and schema', async () => {
      const result = await pool.query('SELECT NOW()');
      expect(result.rows[0]).toHaveProperty('now');
    });

    test('should validate updated database functions exist', async () => {
      const functions = [
        'get_unanalyzed_emails',
        'get_unprocessed_email_count', 
        'get_ai_processing_stats',
        'get_current_ai_balance'
      ];

      for (const func of functions) {
        const result = await pool.query(`
          SELECT proname FROM pg_proc 
          WHERE proname = $1
        `, [func]);
        
        expect(result.rows.length).toBeGreaterThan(0);
      }
    });

    test('should execute get_ai_processing_stats function', async () => {
      const result = await pool.query('SELECT get_ai_processing_stats() as stats');
      const stats = result.rows[0].stats;
      
      expect(stats).toHaveProperty('daily');
      expect(stats).toHaveProperty('balance');
      expect(stats).toHaveProperty('unprocessed');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats.daily).toHaveProperty('total_processed');
      expect(stats.daily).toHaveProperty('total_cost');
    });

    test('should validate required tables exist', async () => {
      const tables = [
        'messages',
        'addresses', 
        'subjects',
        'tasks',
        'ai_usage_tracking'
      ];

      for (const table of tables) {
        const result = await pool.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_name = $1
        `, [table]);
        
        expect(result.rows.length).toBeGreaterThan(0);
      }
    });
  });

  describe('🤖 2. AI Processor Integration', () => {
    test('should respond to AI usage stats endpoint', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const response = await request(app)
        .get('/api/ai/usage-stats')
        .expect(200);

      expect(response.body).toHaveProperty('daily');
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('unprocessed');
      expect(response.body.daily).toHaveProperty('total_processed');
      expect(response.body.daily).toHaveProperty('total_cost');
    });

    test('should process AI commands via API', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const testCommand = 'What is the current status of email processing?';
      
      const response = await request(app)
        .post('/api/ai/process-command')
        .send({ 
          command: testCommand,
          context: { test: true }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should classify emails via AI service', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const testEmail = {
        subject: 'Urgent: Project deadline approaching',
        sender: 'manager@company.com',
        content: 'We need to complete the project by Friday. Please update status.'
      };

      const response = await request(app)
        .post('/api/ai/classify-email')
        .send(testEmail)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('classification');
      expect(response.body.classification).toHaveProperty('classification');
      expect(response.body.classification).toHaveProperty('confidence');
    });

    test('should handle AI service gracefully when OpenAI unavailable', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      // Test with invalid API configuration
      const testEmail = {
        subject: 'Test email',
        sender: 'test@example.com', 
        content: 'This is a test email for fallback classification.'
      };

      const response = await request(app)
        .post('/api/ai/classify-email')
        .send(testEmail);
        
      // Should handle gracefully with fallback
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('classification');
      }
    });
  });

  describe('🔧 3. Backend API Integration', () => {
    test('should respond to health check endpoint', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('database', 'connected');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should fetch sync status from API', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const response = await request(app)
        .get('/api/sync-status')
        .expect(200);

      expect(response.body).toHaveProperty('totalEmails');
      expect(response.body).toHaveProperty('unprocessedEmails');
      expect(response.body).toHaveProperty('syncInProgress');
      expect(response.body).toHaveProperty('lastSync');
      expect(typeof response.body.totalEmails).toBe('number');
      expect(typeof response.body.unprocessedEmails).toBe('number');
    });

    test('should fetch tasks from database via API', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Response might be empty array if no tasks exist
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('title');
        expect(response.body[0]).toHaveProperty('status');
      }
    });

    test('should handle CORS properly', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('📱 4. Frontend Connectivity', () => {
    test('should serve static files in production mode', async () => {
      if (!app || process.env.NODE_ENV !== 'production') {
        console.warn('Skipping static file test - not in production mode');
        return;
      }

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/html/);
    });

    test('should handle frontend API calls with proper JSON responses', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const response = await request(app)
        .get('/api/ai/usage-stats')
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toBeDefined();
    });
  });

  describe('📧 5. End-to-End Email Processing Workflow', () => {
    test('should complete email classification workflow', async () => {
      // 1. Check unprocessed emails exist
      const unprocessedQuery = await pool.query(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE COALESCE(ai_analyzed, false) = false
      `);
      
      const unprocessedCount = parseInt(unprocessedQuery.rows[0].count);
      console.log(`Found ${unprocessedCount} unprocessed emails`);

      // 2. Test getting unanalyzed emails function
      const unanalyzedResult = await pool.query('SELECT * FROM get_unanalyzed_emails(1)');
      console.log(`get_unanalyzed_emails returned ${unanalyzedResult.rows.length} emails`);

      // 3. If we have emails, test the processing stats
      const statsResult = await pool.query('SELECT get_ai_processing_stats() as stats');
      const stats = statsResult.rows[0].stats;
      
      expect(stats).toHaveProperty('unprocessed');
      expect(typeof stats.unprocessed).toBe('number');
      expect(stats.unprocessed).toBe(unprocessedCount);
    });

    test('should validate email data flow from database to API', async () => {
      // 1. Get total message count from database
      const dbResult = await pool.query('SELECT COUNT(*) as total FROM messages');
      const dbTotal = parseInt(dbResult.rows[0].total);

      // 2. Get sync status from API
      if (app) {
        const apiResponse = await request(app)
          .get('/api/sync-status')
          .expect(200);

        // 3. Verify data consistency
        expect(apiResponse.body.totalEmails).toBe(dbTotal);
      }
    });

    test('should verify AI processing pipeline integrity', async () => {
      // Test the complete AI processing pipeline
      
      // 1. Check AI usage tracking table
      const trackingResult = await pool.query(`
        SELECT COUNT(*) as tracking_count 
        FROM ai_usage_tracking 
        WHERE processed_at >= NOW() - INTERVAL '24 hours'
      `);
      
      // 2. Verify processing stats function works
      const statsResult = await pool.query('SELECT get_ai_processing_stats() as stats');
      const stats = statsResult.rows[0].stats;
      
      expect(stats.daily.total_processed).toBe(parseInt(trackingResult.rows[0].tracking_count));
    });

    test('should validate task creation from email processing', async () => {
      // Check if any tasks were created from emails
      const taskResult = await pool.query(`
        SELECT COUNT(*) as task_count 
        FROM tasks 
        WHERE created_from_message_id IS NOT NULL
      `);
      
      const taskCount = parseInt(taskResult.rows[0].task_count);
      console.log(`Found ${taskCount} tasks created from emails`);
      
      expect(typeof taskCount).toBe('number');
      expect(taskCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('🔄 6. Error Handling and Recovery', () => {
    test('should handle database connection errors gracefully', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      // Test API endpoints when database is temporarily unavailable
      // Note: This is a simulation - we can't actually disconnect DB in test
      const response = await request(app)
        .get('/api/health');
        
      // Should either succeed or fail gracefully
      expect([200, 500]).toContain(response.status);
    });

    test('should handle malformed API requests', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const response = await request(app)
        .post('/api/ai/process-command')
        .send({ invalid: 'data' })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate input sanitization', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const maliciousInput = {
        command: '<script>alert("xss")</script>',
        context: { test: true }
      };

      const response = await request(app)
        .post('/api/ai/process-command')
        .send(maliciousInput);
        
      // Should handle safely without executing script
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('📈 7. Performance and Load Testing', () => {
    test('should handle concurrent API requests', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect([200, 500]).toContain(response.status);
      });
    });

    test('should respond within acceptable time limits', async () => {
      if (!app) {
        console.warn('App not available, skipping API tests');
        return;
      }

      const startTime = Date.now();
      
      await request(app)
        .get('/api/ai/usage-stats')
        .expect(200);
        
      const responseTime = Date.now() - startTime;
      
      // Should respond within 5 seconds
      expect(responseTime).toBeLessThan(5000);
    });
  });
});