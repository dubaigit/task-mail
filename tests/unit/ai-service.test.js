const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const OpenAI = require('openai');
const Redis = require('redis');

// Mock external dependencies
jest.mock('openai');
jest.mock('redis');
jest.mock('dotenv', () => ({ config: jest.fn() }));

const aiService = require('../../ai_service.js');

describe('AI Service', () => {
  let mockOpenAI;
  let mockRedis;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup OpenAI mock
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockImplementation(() => mockOpenAI);

    // Setup Redis mock
    mockRedis = {
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      isReady: true,
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    Redis.createClient.mockReturnValue(mockRedis);

    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_DAILY_BUDGET = '10.0';
    process.env.OPENAI_MONTHLY_BUDGET = '100.0';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_DAILY_BUDGET;
    delete process.env.OPENAI_MONTHLY_BUDGET;
  });

  describe('Email Classification', () => {
    test('should classify email as CREATE_TASK with high confidence', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              classification: 'CREATE_TASK',
              urgency: 'HIGH',
              confidence: 95,
              suggested_action: 'Schedule meeting',
              task_title: 'Project Review Meeting',
              task_description: 'Review Q4 project deliverables'
            })
          }
        }],
        usage: { total_tokens: 150 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      mockRedis.get.mockResolvedValue(null); // No cache hit

      const result = await aiService.classifyEmail(
        'We need to schedule a meeting to review the Q4 project deliverables.',
        'Project Review Meeting',
        'manager@company.com'
      );

      expect(result.classification).toBe('CREATE_TASK');
      expect(result.confidence).toBe(95);
      expect(result.suggested_action).toBe('Schedule meeting');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    test('should return cached classification when available', async () => {
      const cachedResult = {
        classification: 'FYI_ONLY',
        confidence: 80,
        suggested_action: 'File for reference'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await aiService.classifyEmail(
        'FYI: New policy update',
        'Policy Update',
        'hr@company.com'
      );

      expect(result).toEqual(cachedResult);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully with fallback', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
      mockRedis.get.mockResolvedValue(null);

      const result = await aiService.classifyEmail(
        'Please reply to this email',
        'Quick Question',
        'client@company.com'
      );

      expect(result.classification).toBe('NEEDS_REPLY');
      expect(result.confidence).toBe(50);
      expect(result.suggested_action).toBe('Manual review recommended');
    });

    test('should validate classification response schema', async () => {
      const invalidResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              classification: 'INVALID_TYPE',
              confidence: 150 // Invalid: > 100
            })
          }
        }],
        usage: { total_tokens: 100 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(invalidResponse);
      mockRedis.get.mockResolvedValue(null);

      await expect(aiService.classifyEmail(
        'Test email',
        'Test',
        'test@example.com'
      )).rejects.toThrow('Invalid AI response format');
    });
  });

  describe('Chat Response Generation', () => {
    test('should generate contextual chat response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'I can help you analyze your email backlog and suggest priority actions.'
          }
        }],
        usage: { total_tokens: 120 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      mockRedis.get.mockResolvedValue(null);

      const result = await aiService.generateChatResponse(
        'What can you help me with today?',
        { taskCount: 15, urgentTasks: 3 }
      );

      expect(result).toContain('help you analyze');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      );
    });
  });

  describe('Draft Reply Generation', () => {
    test('should generate professional email draft', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Thank you for your email. I will review the proposal and get back to you by Friday.'
          }
        }],
        usage: { total_tokens: 200 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await aiService.generateDraftReply(
        'Please review the attached proposal',
        'Proposal Review Request',
        'client@company.com',
        { urgency: 'normal', relationship: 'professional' }
      );

      expect(result.draft).toContain('Thank you for your email');
      expect(result.model_used).toBeDefined();
      expect(result.tokens_used).toBe(200);
    });
  });

  describe('Budget Tracking', () => {
    test('should track spending within daily limits', () => {
      const stats = aiService.getUsageStats();
      
      expect(stats).toHaveProperty('gpt5_nano');
      expect(stats).toHaveProperty('gpt5_mini');
      expect(stats).toHaveProperty('total_requests');
      expect(stats).toHaveProperty('cache_hits');
      expect(stats.monthly_budget).toBe(100);
    });
  });

  describe('Cache Performance', () => {
    test('should provide cache statistics', () => {
      const cacheStats = aiService.getCacheStats();
      
      expect(cacheStats).toHaveProperty('localCacheSize');
      expect(cacheStats).toHaveProperty('cache_hit_rate');
      expect(cacheStats).toHaveProperty('total_requests');
      expect(cacheStats).toHaveProperty('redisConnected');
    });
  });

  describe('Model Selection', () => {
    test('should select appropriate model based on task complexity', () => {
      const classificationModel = aiService.selectModel('classification');
      const draftModel = aiService.selectModel('draft_generation');
      const urgentModel = aiService.selectModel('classification', 'CRITICAL');

      expect(classificationModel).toMatch(/nano/);
      expect(draftModel).toMatch(/mini/);
      expect(urgentModel).toMatch(/mini/);
    });
  });
});