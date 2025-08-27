const GPTService = require('../../../src/services/GPTService');

// Mock OpenAI
jest.mock('openai');

describe('GPTService', () => {
  let mockOpenAI;
  let gptService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { OpenAI } = require('openai');
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockImplementation(() => mockOpenAI);
    
    // Create GPTService instance
    gptService = new GPTService();
  });

  describe('classifyEmail', () => {
    it('should classify email as task with high confidence', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              classification: 'task',
              priority: 'high',
              confidence: 0.92,
              suggestedAction: 'reply',
              reasoning: 'Email contains action items and deadline'
            })
          }
        }],
        usage: { total_tokens: 150 }
      });

      const result = await gptService.classifyEmail(
        'Urgent: Project deadline tomorrow',
        'Please complete the project by tomorrow EOD. Let me know if you need help.',
        'manager@company.com'
      );

      expect(result.classification).toBe('task');
      expect(result.priority).toBe('high');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.suggestedAction).toBe('reply');
    });

    it('should classify email as FYI with low priority', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              classification: 'fyi',
              priority: 'low',
              confidence: 0.85,
              suggestedAction: 'archive',
              reasoning: 'Informational newsletter content'
            })
          }
        }],
        usage: { total_tokens: 100 }
      });

      const result = await gptService.classifyEmail(
        'Weekly Newsletter',
        'Here are this week\'s updates and news...',
        'newsletter@company.com'
      );

      expect(result.classification).toBe('fyi');
      expect(result.priority).toBe('low');
      expect(result.suggestedAction).toBe('archive');
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(gptService.classifyEmail(
        'Test subject',
        'Test content',
        'test@example.com'
      )).rejects.toThrow('API rate limit exceeded');
    });

    it('should handle invalid JSON responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }],
        usage: { total_tokens: 50 }
      });

      await expect(gptService.classifyEmail(
        'Test subject',
        'Test content',
        'test@example.com'
      )).rejects.toThrow();
    });
  });

  describe('generateDraft', () => {
    it('should generate professional reply draft', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              subject: 'Re: Meeting Request',
              content: 'Thank you for reaching out. I would be happy to meet next Tuesday at 2 PM. Please let me know the location.',
              tone: 'professional',
              confidence: 0.88
            })
          }
        }],
        usage: { total_tokens: 200 }
      });

      const result = await gptService.generateDraft({
        originalSubject: 'Meeting Request',
        originalContent: 'Would you like to meet next week?',
        context: 'reply',
        tone: 'professional',
        senderName: 'John Doe'
      });

      expect(result.subject).toContain('Re:');
      expect(result.content).toContain('Thank you');
      expect(result.tone).toBe('professional');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should generate casual tone draft when requested', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              subject: 'Re: Coffee chat',
              content: 'Hey! Sure, let\'s grab coffee. How about Thursday morning?',
              tone: 'casual',
              confidence: 0.91
            })
          }
        }],
        usage: { total_tokens: 120 }
      });

      const result = await gptService.generateDraft({
        originalSubject: 'Coffee chat',
        originalContent: 'Want to grab coffee sometime?',
        context: 'reply',
        tone: 'casual',
        senderName: 'Sarah'
      });

      expect(result.tone).toBe('casual');
      expect(result.content).toContain('Hey');
    });
  });

  describe('searchEmails', () => {
    it('should return relevant search results', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              results: [
                {
                  id: 'email-1',
                  relevance: 0.95,
                  reasoning: 'Exact match for project status query'
                },
                {
                  id: 'email-2',
                  relevance: 0.78,
                  reasoning: 'Related project discussion'
                }
              ],
              searchStrategy: 'semantic_similarity',
              confidence: 0.89
            })
          }
        }],
        usage: { total_tokens: 180 }
      });

      // Mock database query
      const mockEmails = [
        {
          id: 'email-1',
          subject: 'Project Alpha Status Update',
          content: 'Project Alpha is 80% complete...',
          sender: 'pm@company.com'
        },
        {
          id: 'email-2',
          subject: 'Alpha Team Meeting Notes',
          content: 'Discussed project timeline...',
          sender: 'team@company.com'
        }
      ];

      // Mock the database query that would be called internally
      jest.spyOn(gptService, '_queryEmailDatabase').mockResolvedValue(mockEmails);

      const result = await gptService.searchEmails('project alpha status', 10);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].relevance).toBeGreaterThan(0.9);
      expect(result.totalResults).toBe(2);
    });
  });

  describe('generateTasks', () => {
    it('should extract actionable tasks from email', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              tasks: [
                {
                  title: 'Review quarterly report',
                  description: 'Review and provide feedback on Q4 report by Friday',
                  priority: 'high',
                  estimatedTime: 60,
                  dueDate: '2024-01-19',
                  category: 'review'
                },
                {
                  title: 'Schedule team meeting',
                  description: 'Schedule follow-up meeting with the team',
                  priority: 'medium',
                  estimatedTime: 15,
                  dueDate: '2024-01-17',
                  category: 'meeting'
                }
              ],
              confidence: 0.87,
              reasoning: 'Email contains clear action items with deadlines'
            })
          }
        }],
        usage: { total_tokens: 250 }
      });

      const result = await gptService.generateTasks({
        emailId: 'email-123',
        subject: 'Q4 Report Review Needed',
        content: 'Please review the attached Q4 report and provide feedback by Friday. Also, let\'s schedule a team meeting to discuss.',
        sender: 'director@company.com'
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toContain('Review');
      expect(result.tasks[0].priority).toBe('high');
      expect(result.tasks[1].title).toContain('Schedule');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return empty tasks for non-actionable emails', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              tasks: [],
              confidence: 0.95,
              reasoning: 'Email is purely informational with no action items'
            })
          }
        }],
        usage: { total_tokens: 80 }
      });

      const result = await gptService.generateTasks({
        emailId: 'email-456',
        subject: 'Company Newsletter',
        content: 'Here are this month\'s company updates and news...',
        sender: 'hr@company.com'
      });

      expect(result.tasks).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('processAutomationRules', () => {
    it('should apply matching automation rules', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              matchedRules: [
                {
                  ruleId: 'rule-1',
                  condition: 'from:urgent@company.com',
                  action: 'label:urgent',
                  confidence: 0.98
                }
              ],
              actions: [
                { type: 'label', value: 'urgent' },
                { type: 'priority', value: 'high' }
              ],
              reasoning: 'Email from urgent sender matches high-priority rule'
            })
          }
        }],
        usage: { total_tokens: 120 }
      });

      const rules = [
        {
          id: 'rule-1',
          condition: 'from:urgent@company.com',
          action: 'label:urgent'
        }
      ];

      const result = await gptService.processAutomationRules({
        emailId: 'email-789',
        subject: 'System Alert',
        content: 'Critical system issue detected',
        sender: 'urgent@company.com'
      }, rules);

      expect(result.matchedRules).toHaveLength(1);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].type).toBe('label');
      expect(result.actions[0].value).toBe('urgent');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle network timeouts', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Request timeout')
      );

      await expect(gptService.classifyEmail(
        'Test',
        'Test content',
        'test@example.com'
      )).rejects.toThrow('Request timeout');
    });

    it('should handle token limit errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Token limit exceeded')
      );

      await expect(gptService.generateDraft({
        originalSubject: 'Very long email subject with lots of content',
        originalContent: 'A'.repeat(10000), // Very long content
        context: 'reply'
      })).rejects.toThrow('Token limit exceeded');
    });

    it('should validate input parameters', async () => {
      await expect(gptService.classifyEmail(
        '', // Empty subject
        'Test content',
        'test@example.com'
      )).rejects.toThrow();

      await expect(gptService.generateDraft({
        // Missing required fields
        context: 'reply'
      })).rejects.toThrow();
    });
  });
});