const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const request = require('supertest');
const { Pool } = require('pg');

// Mock dependencies
jest.mock('pg');
jest.mock('../../ai_service.js');

const aiService = require('../../ai_service.js');

describe('Server API Endpoints', () => {
  let app;
  let mockPool;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup database mock
    mockPool = {
      query: jest.fn(),
      end: jest.fn()
    };
    Pool.mockImplementation(() => mockPool);

    // Mock AI service
    aiService.classifyEmail = jest.fn();
    aiService.generateChatResponse = jest.fn();
    aiService.getUsageStats = jest.fn().mockReturnValue({
      daily: { total_processed: 10, total_cost: 0.05 },
      balance: 25.00,
      unprocessed: 5,
      isProcessing: false
    });

    // Import app after mocks are set up
    delete require.cache[require.resolve('../../server.js')];
    const serverModule = require('../../server.js');
    app = serverModule.app;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('GET /api/health', () => {
    test('should return healthy status when all services are available', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ now: new Date().toISOString() }]
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBe('connected');
      expect(response.body.ai_service).toBe('available');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should return unhealthy status when database fails', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/health')
        .expect(500);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Database connection failed');
    });
  });

  describe('GET /api/ai/usage-stats', () => {
    test('should return AI usage statistics', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          stats: {
            daily: { total_processed: 50, total_cost: 0.25 },
            balance: 24.75,
            unprocessed: 10,
            isProcessing: true
          }
        }]
      });

      const response = await request(app)
        .get('/api/ai/usage-stats')
        .expect(200);

      expect(response.body.daily.total_processed).toBe(50);
      expect(response.body.balance).toBe(24.75);
      expect(response.body.unprocessed).toBe(10);
      expect(response.body.isProcessing).toBe(true);
    });

    test('should return default stats when database query fails', async () => {
      mockPool.query.mockRejectedValue(new Error('Query failed'));

      const response = await request(app)
        .get('/api/ai/usage-stats')
        .expect(200);

      expect(response.body.daily.total_processed).toBe(0);
      expect(response.body.balance).toBe(25.00);
      expect(response.body.unprocessed).toBe(0);
      expect(response.body.isProcessing).toBe(false);
    });
  });

  describe('POST /api/ai/process-command', () => {
    test('should process AI command successfully', async () => {
      const mockAIResponse = 'Here are your task priorities for today...';
      aiService.generateChatResponse.mockResolvedValue(mockAIResponse);

      const response = await request(app)
        .post('/api/ai/process-command')
        .send({
          command: 'What are my priorities today?',
          context: { taskCount: 15 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toBe(mockAIResponse);
      expect(response.body.timestamp).toBeDefined();
      expect(aiService.generateChatResponse).toHaveBeenCalledWith(
        'What are my priorities today?',
        { taskCount: 15 }
      );
    });

    test('should handle AI service errors gracefully', async () => {
      aiService.generateChatResponse.mockRejectedValue(new Error('AI service unavailable'));

      const response = await request(app)
        .post('/api/ai/process-command')
        .send({
          command: 'Test command',
          context: {}
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to process AI command');
      expect(response.body.details).toBe('AI service unavailable');
    });
  });

  describe('POST /api/ai/classify-email', () => {
    test('should classify email successfully', async () => {
      const mockClassification = {
        classification: 'CREATE_TASK',
        confidence: 95,
        suggested_action: 'Schedule meeting'
      };
      aiService.classifyEmail.mockResolvedValue(mockClassification);

      const response = await request(app)
        .post('/api/ai/classify-email')
        .send({
          content: 'We need to schedule a meeting',
          subject: 'Meeting Request',
          sender: 'colleague@company.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.classification).toEqual(mockClassification);
      expect(aiService.classifyEmail).toHaveBeenCalledWith(
        'We need to schedule a meeting',
        'Meeting Request',
        'colleague@company.com'
      );
    });
  });

  describe('GET /api/sync-status', () => {
    test('should return sync status with email counts', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '150' }] })
        .mockResolvedValueOnce({ rows: [{ unprocessed: '25' }] });

      const response = await request(app)
        .get('/api/sync-status')
        .expect(200);

      expect(response.body.totalEmails).toBe(150);
      expect(response.body.unprocessedEmails).toBe(25);
      expect(response.body.lastSync).toBeDefined();
      expect(response.body.syncInProgress).toBe(false);
    });
  });

  describe('GET /api/tasks', () => {
    test('should return tasks ordered by priority', async () => {
      const mockTasks = [
        {
          id: '1',
          title: 'Urgent Task',
          priority: 'urgent',
          status: 'pending',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Normal Task',
          priority: 'medium',
          status: 'in-progress',
          created_at: new Date().toISOString()
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockTasks });

      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].priority).toBe('urgent');
      expect(response.body[0].title).toBe('Urgent Task');
    });

    test('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/tasks')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch tasks');
    });
  });

  describe('Error Handling Middleware', () => {
    test('should handle uncaught errors', async () => {
      // Mock a route that throws an error
      mockPool.query.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/api/health')
        .expect(500);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Unexpected error');
    });
  });

  describe('CORS Configuration', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeTruthy();
    });
  });
});