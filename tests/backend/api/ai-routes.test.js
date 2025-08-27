const request = require('supertest');
const express = require('express');
const aiRoutes = require('../../../src/api/routes/ai-routes');

// Mock dependencies
jest.mock('../../../src/services/GPTService', () => {
  const mockInstance = {
    classifyEmail: jest.fn(),
    generateDraft: jest.fn(),
    searchEmails: jest.fn(),
    generateTasks: jest.fn(),
    processAutomationRules: jest.fn(),
    initialize: jest.fn().mockResolvedValue(undefined)
  };
  
  return jest.fn().mockImplementation(() => mockInstance);
});
jest.mock('../../../src/middleware/auth');

const app = express();
app.use(express.json());
app.use('/ai', aiRoutes);

describe('AI Routes', () => {
  let mockGPTServiceInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth middleware to pass through
    const auth = require('../../../src/middleware/auth');
    auth.authenticateToken = jest.fn((req, res, next) => {
      req.user = { id: 1, email: 'user@example.com' };
      next();
    });

    // Get the mocked GPTService instance
    const GPTService = require('../../../src/services/GPTService');
    mockGPTServiceInstance = new GPTService();
  });

  describe('POST /ai/classify-email', () => {
    it('should classify email successfully', async () => {
      mockGPTServiceInstance.classifyEmail.mockResolvedValue({
        classification: 'task',
        priority: 'medium',
        confidence: 0.85,
        suggestedAction: 'reply'
      });

      const response = await request(app)
        .post('/ai/classify-email')
        .send({
          subject: 'Meeting tomorrow',
          content: 'Can we meet tomorrow at 2pm?',
          sender: 'colleague@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('classification');
      expect(response.body.data).toHaveProperty('priority');
      expect(response.body.data).toHaveProperty('confidence');
    });

    it('should handle classification errors', async () => {
      mockGPTServiceInstance.classifyEmail.mockRejectedValue(new Error('AI service unavailable'));

      const response = await request(app)
        .post('/ai/classify-email')
        .send({
          subject: 'Test email',
          content: 'Test content',
          sender: 'test@example.com'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('AI service unavailable');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/ai/classify-email')
        .send({
          subject: 'Test email'
          // Missing content and sender
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /ai/generate-draft', () => {
    it('should generate draft successfully', async () => {
      mockGPTServiceInstance.generateDraft.mockResolvedValue({
        subject: 'Re: Meeting tomorrow',
        content: 'Yes, I can meet tomorrow at 2pm. Let me know the location.',
        tone: 'professional',
        confidence: 0.92
      });

      const response = await request(app)
        .post('/ai/generate-draft')
        .send({
          originalSubject: 'Meeting tomorrow',
          originalContent: 'Can we meet tomorrow at 2pm?',
          context: 'reply',
          tone: 'professional'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('subject');
      expect(response.body.data).toHaveProperty('content');
    });

    it('should handle draft generation errors', async () => {
      mockGPTServiceInstance.generateDraft.mockRejectedValue(new Error('Token limit exceeded'));

      const response = await request(app)
        .post('/ai/generate-draft')
        .send({
          originalSubject: 'Test',
          originalContent: 'Test content',
          context: 'reply'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /ai/search-emails', () => {
    it('should search emails with AI successfully', async () => {
      mockGPTServiceInstance.searchEmails.mockResolvedValue({
        results: [
          {
            id: '1',
            subject: 'Project update',
            relevance: 0.95,
            snippet: 'Project is on track...'
          }
        ],
        totalResults: 1,
        searchTime: 150
      });

      const response = await request(app)
        .post('/ai/search-emails')
        .send({
          query: 'project status update',
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data.results).toHaveLength(1);
    });

    it('should handle empty search results', async () => {
      mockGPTServiceInstance.searchEmails.mockResolvedValue({
        results: [],
        totalResults: 0,
        searchTime: 50
      });

      const response = await request(app)
        .post('/ai/search-emails')
        .send({
          query: 'nonexistent topic',
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(0);
    });
  });

  describe('POST /ai/generate-tasks', () => {
    it('should generate tasks from email successfully', async () => {
      mockGPTServiceInstance.generateTasks.mockResolvedValue({
        tasks: [
          {
            title: 'Schedule meeting',
            description: 'Schedule meeting for tomorrow at 2pm',
            priority: 'medium',
            estimatedTime: 15,
            dueDate: '2024-01-16'
          }
        ],
        confidence: 0.88
      });

      const response = await request(app)
        .post('/ai/generate-tasks')
        .send({
          emailId: 'email-123',
          subject: 'Meeting tomorrow',
          content: 'Can we meet tomorrow at 2pm?'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tasks');
      expect(response.body.data.tasks).toHaveLength(1);
    });
  });

  describe('POST /ai/process-automation-rules', () => {
    it('should process automation rules successfully', async () => {
      mockGPTServiceInstance.processAutomationRules.mockResolvedValue({
        rulesApplied: 2,
        actions: [
          { type: 'label', value: 'urgent' },
          { type: 'forward', value: 'assistant@example.com' }
        ]
      });

      const response = await request(app)
        .post('/ai/process-automation-rules')
        .send({
          emailId: 'email-123',
          rules: [
            { condition: 'from:boss@company.com', action: 'label:urgent' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('rulesApplied');
    });
  });
});