/**
 * Email Processing Debug Test Suite
 * Comprehensive testing for email processing issues and fixes
 */

import { test, expect, Page, Browser } from '@playwright/test';

// Test configuration for email processing
const TEST_CONFIG = {
  baseURL: process.env.APP_URL || 'http://localhost:3000',
  apiURL: process.env.API_URL || 'http://localhost:8000',
  timeout: 30000,
  retries: 2
};

interface EmailTestData {
  id: string;
  subject: string;
  sender: string;
  body: string;
  expectedClassification?: string;
  shouldProcessSuccessfully: boolean;
}

// Test email data for various scenarios
const testEmails: EmailTestData[] = [
  {
    id: 'test-email-1',
    subject: 'Urgent: Server Down',
    sender: 'alerts@company.com',
    body: 'Production server is experiencing downtime. Immediate action required.',
    expectedClassification: 'URGENT_RESPONSE',
    shouldProcessSuccessfully: true
  },
  {
    id: 'test-email-2', 
    subject: 'Meeting Request: Project Review',
    sender: 'manager@company.com',
    body: 'Please confirm your availability for next Tuesday at 2 PM.',
    expectedClassification: 'MEETING_REQUEST',
    shouldProcessSuccessfully: true
  },
  {
    id: 'test-email-3',
    subject: 'FYI: Weekly Report',
    sender: 'reports@company.com', 
    body: 'Here is the weekly status report for your review.',
    expectedClassification: 'FYI_ONLY',
    shouldProcessSuccessfully: true
  },
  {
    id: 'test-email-malformed',
    subject: '',
    sender: 'invalid@email',
    body: 'Test email with malformed data',
    shouldProcessSuccessfully: false
  }
];

test.describe('Email Processing Debug Suite', () => {
  let browser: Browser;
  let context: any;
  let page: Page;

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
    context = await browser.newContext({
      baseURL: TEST_CONFIG.baseURL,
      timeout: TEST_CONFIG.timeout
    });
    page = await context.newPage();
    
    // Navigate to the application
    await page.goto('/');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('should load email dashboard without errors', async () => {
    await page.goto('/dashboard');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="email-dashboard"]')).toBeVisible({
      timeout: 10000
    });
    
    // Check for console errors
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    expect(logs.length).toBe(0);
  });

  test('should process emails correctly', async () => {
    for (const email of testEmails) {
      console.log(`Testing email processing for: ${email.subject}`);
      
      // Navigate to email processing endpoint
      const response = await page.request.post(`${TEST_CONFIG.apiURL}/api/emails/process`, {
        data: {
          subject: email.subject,
          sender: email.sender,
          body: email.body,
          messageId: email.id
        }
      });

      if (email.shouldProcessSuccessfully) {
        expect(response.status()).toBe(200);
        
        const result = await response.json();
        expect(result).toHaveProperty('classification');
        expect(result).toHaveProperty('confidence');
        
        if (email.expectedClassification) {
          expect(result.classification).toBe(email.expectedClassification);
        }
      } else {
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }
    }
  });

  test('should handle AI service errors gracefully', async () => {
    // Test with AI service unavailable
    const response = await page.request.post(`${TEST_CONFIG.apiURL}/api/emails/classify`, {
      data: {
        subject: 'Test Email',
        sender: 'test@example.com',
        body: 'Test body',
        forceAIError: true // Special flag to simulate AI service error
      }
    });

    // Should return fallback classification
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.classification).toBe('FYI_ONLY');
    expect(result.confidence).toBeLessThan(50);
  });

  test('should validate email processing queue', async () => {
    // Check queue status endpoint
    const queueResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/emails/queue/status`);
    expect(queueResponse.status()).toBe(200);
    
    const queueStatus = await queueResponse.json();
    expect(queueStatus).toHaveProperty('pending');
    expect(queueStatus).toHaveProperty('processing');
    expect(queueStatus).toHaveProperty('completed');
    expect(queueStatus).toHaveProperty('failed');
  });

  test('should process draft generation', async () => {
    const draftRequest = {
      subject: 'Re: Meeting Request',
      originalEmail: 'Can we schedule a meeting for next week?',
      sender: 'colleague@company.com',
      context: {
        relationship: 'professional',
        urgency: 'normal'
      }
    };

    const response = await page.request.post(`${TEST_CONFIG.apiURL}/api/emails/generate-draft`, {
      data: draftRequest
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result).toHaveProperty('draft');
    expect(result.draft.length).toBeGreaterThan(10);
  });

  test('should validate database connections', async () => {
    const healthResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/health`);
    expect(healthResponse.status()).toBe(200);
    
    const health = await healthResponse.json();
    expect(health.database).toBe('connected');
    expect(health.redis).toBe('connected');
  });

  test('should handle concurrent email processing', async () => {
    const concurrentEmails = Array.from({ length: 5 }, (_, i) => ({
      subject: `Concurrent Test Email ${i + 1}`,
      sender: `sender${i + 1}@test.com`,
      body: `Test body for concurrent processing ${i + 1}`,
      messageId: `concurrent-test-${i + 1}`
    }));

    // Send all requests concurrently
    const responses = await Promise.all(
      concurrentEmails.map(email =>
        page.request.post(`${TEST_CONFIG.apiURL}/api/emails/process`, { data: email })
      )
    );

    // All should succeed
    responses.forEach((response, index) => {
      expect(response.status()).toBe(200);
      console.log(`Concurrent email ${index + 1} processed successfully`);
    });
  });

  test('should validate email task creation', async () => {
    const email = {
      subject: 'Task Creation Test',
      sender: 'tasktest@example.com',
      body: 'This email should create a task with specific requirements.',
      messageId: 'task-creation-test'
    };

    const processResponse = await page.request.post(`${TEST_CONFIG.apiURL}/api/emails/process`, {
      data: email
    });

    expect(processResponse.status()).toBe(200);
    const result = await processResponse.json();

    // If classified as CREATE_TASK, verify task creation
    if (result.classification === 'CREATE_TASK') {
      const tasksResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/tasks`);
      expect(tasksResponse.status()).toBe(200);
      
      const tasks = await tasksResponse.json();
      const createdTask = tasks.find((task: any) => 
        task.emailSubject === email.subject
      );
      
      expect(createdTask).toBeDefined();
      expect(createdTask.sender).toBe(email.sender);
    }
  });

  test('should handle email processing errors with retry logic', async () => {
    // Simulate processing error
    const errorEmail = {
      subject: 'Error Test Email',
      sender: 'errortest@example.com',
      body: 'This should trigger processing error',
      simulateError: true
    };

    const response = await page.request.post(`${TEST_CONFIG.apiURL}/api/emails/process`, {
      data: errorEmail
    });

    // Check that error is handled gracefully
    expect([200, 500, 503]).toContain(response.status());
    
    // If error occurred, check retry queue
    if (response.status() >= 500) {
      const queueResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/emails/queue/failed`);
      expect(queueResponse.status()).toBe(200);
    }
  });

  test('should validate performance metrics', async () => {
    const metricsResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/metrics/email-processing`);
    expect(metricsResponse.status()).toBe(200);
    
    const metrics = await metricsResponse.json();
    expect(metrics).toHaveProperty('emailsProcessed');
    expect(metrics).toHaveProperty('averageProcessingTime');
    expect(metrics).toHaveProperty('successRate');
    expect(metrics).toHaveProperty('errorRate');
  });

  test('should validate AI service integration', async () => {
    const aiStatusResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/ai/status`);
    expect(aiStatusResponse.status()).toBe(200);
    
    const aiStatus = await aiStatusResponse.json();
    expect(aiStatus).toHaveProperty('available');
    expect(aiStatus).toHaveProperty('model');
    expect(aiStatus).toHaveProperty('responseTime');
  });
});

// Utility functions for email processing tests
export class EmailProcessingTestUtils {
  static async waitForEmailProcessing(page: Page, emailId: string, timeout = 10000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await page.request.get(`${TEST_CONFIG.apiURL}/api/emails/${emailId}/status`);
      if (response.status() === 200) {
        const status = await response.json();
        if (status.processed) {
          return status;
        }
      }
      await page.waitForTimeout(500);
    }
    
    throw new Error(`Email processing timeout for ${emailId}`);
  }

  static async clearProcessingQueue(page: Page): Promise<void> {
    await page.request.delete(`${TEST_CONFIG.apiURL}/api/emails/queue/clear`);
  }

  static async seedTestEmails(page: Page, emails: EmailTestData[]): Promise<void> {
    for (const email of emails) {
      await page.request.post(`${TEST_CONFIG.apiURL}/api/emails/seed`, { data: email });
    }
  }
}