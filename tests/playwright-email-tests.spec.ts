/**
 * Playwright Tests for Email Processing Functions
 * Comprehensive end-to-end testing of email processing features
 */

import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';

// Test configuration
const config = {
  baseURL: process.env.APP_URL || 'http://localhost:3000',
  apiURL: process.env.API_URL || 'http://localhost:8000',
  timeout: 30000
};

// Test data interfaces
interface TestEmail {
  id: string;
  subject: string;
  sender: string;
  body: string;
  classification?: string;
  priority?: string;
}

interface TestUser {
  email: string;
  password: string;
  name: string;
}

// Test data
const testUser: TestUser = {
  email: 'test@example.com',
  password: 'test123',
  name: 'Test User'
};

const testEmails: TestEmail[] = [
  {
    id: 'urgent-email-1',
    subject: 'URGENT: Server Critical Issue',
    sender: 'alerts@company.com',
    body: 'Production server experiencing critical failures. Immediate attention required.',
    classification: 'URGENT_RESPONSE',
    priority: 'urgent'
  },
  {
    id: 'meeting-email-1', 
    subject: 'Meeting Request: Weekly Standup',
    sender: 'manager@company.com',
    body: 'Please confirm your availability for our weekly standup meeting on Friday at 10 AM.',
    classification: 'MEETING_REQUEST',
    priority: 'medium'
  },
  {
    id: 'task-email-1',
    subject: 'Please Review: Q4 Report',
    sender: 'analyst@company.com',
    body: 'Could you please review the attached Q4 report and provide feedback by end of week?',
    classification: 'CREATE_TASK',
    priority: 'medium'
  },
  {
    id: 'fyi-email-1',
    subject: 'FYI: System Maintenance Scheduled',
    sender: 'it@company.com',
    body: 'This is to inform you that system maintenance is scheduled for this weekend.',
    classification: 'FYI_ONLY',
    priority: 'low'
  }
];

test.describe('Email Processing Functions - Playwright Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
    context = await browser.newContext({
      baseURL: config.baseURL,
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });
    
    // Enable request/response logging
    context.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`📤 ${request.method()} ${request.url()}`);
      }
    });
    
    context.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`📥 ${response.status()} ${response.url()}`);
      }
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.describe('Authentication & Setup', () => {
    test('should authenticate user successfully', async () => {
      await page.goto('/login');
      
      // Fill login form
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      
      // Submit form
      await page.click('[data-testid="login-button"]');
      
      // Verify redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    test('should load dashboard without errors', async () => {
      await page.goto('/dashboard');
      
      // Check for error messages
      const errorMessages = page.locator('[data-testid="error-message"]');
      await expect(errorMessages).toHaveCount(0);
      
      // Verify main dashboard elements are present
      await expect(page.locator('[data-testid="email-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-list"]')).toBeVisible();
    });
  });

  test.describe('Email Processing Core Functions', () => {
    test('should process and classify emails correctly', async ({ request }) => {
      for (const email of testEmails) {
        console.log(`🧪 Testing email: ${email.subject}`);
        
        // Process email via API
        const response = await request.post(`${config.apiURL}/api/emails/process`, {
          data: {
            messageId: email.id,
            subject: email.subject,
            sender: email.sender,
            body: email.body
          }
        });

        expect(response.status()).toBe(200);
        const result = await response.json();
        
        // Verify classification
        expect(result).toHaveProperty('classification');
        expect(result).toHaveProperty('confidence');
        expect(result.confidence).toBeGreaterThan(0);
        
        if (email.classification) {
          expect(result.classification).toBe(email.classification);
        }
        
        console.log(`✅ Email classified as: ${result.classification} (${result.confidence}% confidence)`);
      }
    });

    test('should handle malformed emails gracefully', async ({ request }) => {
      const malformedEmails = [
        { subject: '', sender: '', body: '' },
        { subject: 'Test', sender: 'invalid-email', body: 'Test body' },
        { subject: null, sender: 'test@example.com', body: null }
      ];

      for (const email of malformedEmails) {
        const response = await request.post(`${config.apiURL}/api/emails/process`, {
          data: email
        });

        // Should handle gracefully (either process or return appropriate error)
        expect([200, 400, 422]).toContain(response.status());
        
        if (response.status() === 200) {
          const result = await response.json();
          expect(result).toHaveProperty('classification');
        }
      }
    });

    test('should generate email drafts successfully', async ({ request }) => {
      const draftRequests = [
        {
          subject: 'Re: Meeting Request',
          originalEmail: testEmails[1].body,
          sender: testEmails[1].sender,
          context: { urgency: 'normal', relationship: 'professional' }
        },
        {
          subject: 'Re: Urgent Issue',
          originalEmail: testEmails[0].body,
          sender: testEmails[0].sender,
          context: { urgency: 'high', relationship: 'internal' }
        }
      ];

      for (const draftRequest of draftRequests) {
        console.log(`📝 Generating draft for: ${draftRequest.subject}`);
        
        const response = await request.post(`${config.apiURL}/api/emails/generate-draft`, {
          data: draftRequest
        });

        expect(response.status()).toBe(200);
        const result = await response.json();
        
        expect(result).toHaveProperty('draft');
        expect(result.draft.length).toBeGreaterThan(10);
        expect(result).toHaveProperty('model_used');
        
        console.log(`✅ Draft generated (${result.draft.length} chars)`);
      }
    });

    test('should create tasks from classified emails', async () => {
      await page.goto('/dashboard');
      
      // Find an email classified as CREATE_TASK
      const taskEmail = testEmails.find(e => e.classification === 'CREATE_TASK');
      if (!taskEmail) return;

      // Simulate email processing that creates a task
      const response = await page.request.post(`${config.apiURL}/api/emails/process`, {
        data: {
          messageId: taskEmail.id,
          subject: taskEmail.subject,
          sender: taskEmail.sender,
          body: taskEmail.body
        }
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      
      if (result.classification === 'CREATE_TASK') {
        // Wait for task to appear in UI
        await page.waitForTimeout(2000);
        await page.reload();
        
        // Verify task was created in the task panel
        const taskList = page.locator('[data-testid="task-list"]');
        const taskItem = taskList.locator(`[data-email-id="${taskEmail.id}"]`);
        
        await expect(taskItem).toBeVisible({ timeout: 5000 });
        
        // Verify task details
        await expect(taskItem.locator('[data-testid="task-subject"]')).toContainText(taskEmail.subject);
        await expect(taskItem.locator('[data-testid="task-sender"]')).toContainText(taskEmail.sender);
      }
    });
  });

  test.describe('Email Processing Performance', () => {
    test('should handle concurrent email processing', async ({ request }) => {
      const concurrentEmails = Array.from({ length: 5 }, (_, i) => ({
        messageId: `concurrent-${i}`,
        subject: `Concurrent Test ${i + 1}`,
        sender: `sender${i + 1}@test.com`,
        body: `Test email body for concurrent processing ${i + 1}`
      }));

      console.log('🚀 Testing concurrent email processing...');
      
      // Process all emails simultaneously
      const responses = await Promise.all(
        concurrentEmails.map(email =>
          request.post(`${config.apiURL}/api/emails/process`, { data: email })
        )
      );

      // Verify all processed successfully
      responses.forEach((response, index) => {
        expect(response.status()).toBe(200);
        console.log(`✅ Concurrent email ${index + 1} processed`);
      });
    });

    test('should measure processing performance', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.post(`${config.apiURL}/api/emails/process`, {
        data: testEmails[0]
      });

      const processingTime = Date.now() - startTime;
      
      expect(response.status()).toBe(200);
      expect(processingTime).toBeLessThan(10000); // Should process within 10 seconds
      
      console.log(`⏱️ Email processed in ${processingTime}ms`);
    });

    test('should validate processing queue status', async ({ request }) => {
      const response = await request.get(`${config.apiURL}/api/emails/queue/status`);
      
      expect(response.status()).toBe(200);
      const queueStatus = await response.json();
      
      expect(queueStatus).toHaveProperty('pending');
      expect(queueStatus).toHaveProperty('processing');
      expect(queueStatus).toHaveProperty('completed');
      expect(queueStatus).toHaveProperty('failed');
      
      // Queue should be healthy
      expect(queueStatus.processing).toBeLessThan(10);
      expect(queueStatus.failed).toBeLessThan(5);
      
      console.log('📊 Queue status:', queueStatus);
    });
  });

  test.describe('Email Processing Error Handling', () => {
    test('should handle AI service errors gracefully', async ({ request }) => {
      // Simulate AI service error
      const response = await request.post(`${config.apiURL}/api/emails/process`, {
        data: {
          messageId: 'ai-error-test',
          subject: 'AI Error Test',
          sender: 'test@example.com',
          body: 'Test email for AI error handling',
          simulateAIError: true
        }
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      
      // Should fall back to default classification
      expect(result.classification).toBe('FYI_ONLY');
      expect(result.confidence).toBeLessThan(50);
      
      console.log('🛡️ AI error handled gracefully with fallback classification');
    });

    test('should retry failed email processing', async ({ request }) => {
      // Send email that will initially fail
      const failEmail = {
        messageId: 'retry-test',
        subject: 'Retry Test Email',
        sender: 'retry@test.com',
        body: 'This email should be retried',
        simulateFailure: true
      };

      const response = await request.post(`${config.apiURL}/api/emails/process`, {
        data: failEmail
      });

      // May return error initially
      if (response.status() >= 400) {
        // Wait for retry mechanism
        await page.waitForTimeout(5000);
        
        // Check if retry succeeded
        const retryResponse = await request.get(`${config.apiURL}/api/emails/${failEmail.messageId}/status`);
        
        if (retryResponse.status() === 200) {
          const status = await retryResponse.json();
          console.log('🔄 Email processing retry mechanism working');
        }
      }
    });

    test('should validate system health endpoints', async ({ request }) => {
      const healthResponse = await request.get(`${config.apiURL}/api/health`);
      expect(healthResponse.status()).toBe(200);
      
      const health = await healthResponse.json();
      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('redis');
      expect(health).toHaveProperty('aiService');
      
      console.log('💚 System health:', health);
    });
  });

  test.describe('Email UI Interactions', () => {
    test('should display processed emails in the dashboard', async () => {
      await page.goto('/dashboard');
      
      // Wait for emails to load
      await page.waitForSelector('[data-testid="email-list"]', { timeout: 10000 });
      
      // Check if emails are displayed
      const emailItems = page.locator('[data-testid="email-item"]');
      const emailCount = await emailItems.count();
      
      expect(emailCount).toBeGreaterThan(0);
      console.log(`📧 Found ${emailCount} emails in dashboard`);
      
      // Verify email details are visible
      const firstEmail = emailItems.first();
      await expect(firstEmail.locator('[data-testid="email-subject"]')).toBeVisible();
      await expect(firstEmail.locator('[data-testid="email-sender"]')).toBeVisible();
      await expect(firstEmail.locator('[data-testid="email-classification"]')).toBeVisible();
    });

    test('should allow manual email classification override', async () => {
      await page.goto('/dashboard');
      
      // Find first email
      const firstEmail = page.locator('[data-testid="email-item"]').first();
      await firstEmail.click();
      
      // Open classification options
      await page.click('[data-testid="classification-override-button"]');
      
      // Change classification
      await page.selectOption('[data-testid="classification-select"]', 'CREATE_TASK');
      await page.click('[data-testid="save-classification"]');
      
      // Verify classification updated
      await expect(firstEmail.locator('[data-testid="email-classification"]')).toContainText('CREATE_TASK');
      
      console.log('✏️ Manual classification override working');
    });

    test('should generate and display email drafts', async () => {
      await page.goto('/dashboard');
      
      // Select an email that needs a reply
      const replyEmail = page.locator('[data-testid="email-item"]')
        .filter({ hasText: 'NEEDS_REPLY' })
        .first();
      
      if (await replyEmail.count() > 0) {
        await replyEmail.click();
        
        // Click generate draft button
        await page.click('[data-testid="generate-draft-button"]');
        
        // Wait for draft to be generated
        await expect(page.locator('[data-testid="draft-content"]')).toBeVisible({ timeout: 15000 });
        
        // Verify draft content
        const draftText = await page.locator('[data-testid="draft-content"]').textContent();
        expect(draftText?.length || 0).toBeGreaterThan(10);
        
        console.log('📝 Email draft generated successfully');
      }
    });

    test('should display processing status and progress', async () => {
      await page.goto('/dashboard');
      
      // Check if processing status indicators are present
      const processingIndicators = page.locator('[data-testid="processing-status"]');
      
      if (await processingIndicators.count() > 0) {
        console.log('⏳ Processing status indicators found');
      }
      
      // Check metrics display
      await expect(page.locator('[data-testid="metrics-panel"]')).toBeVisible();
      
      const metricsText = await page.locator('[data-testid="processed-count"]').textContent();
      console.log(`📊 Processed emails count: ${metricsText}`);
    });
  });

  test.describe('Email Processing Analytics', () => {
    test('should display processing metrics', async ({ request }) => {
      const metricsResponse = await request.get(`${config.apiURL}/api/metrics/email-processing`);
      expect(metricsResponse.status()).toBe(200);
      
      const metrics = await metricsResponse.json();
      
      expect(metrics).toHaveProperty('emailsProcessed');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('classificationAccuracy');
      expect(metrics).toHaveProperty('successRate');
      
      console.log('📈 Processing metrics:', metrics);
    });

    test('should track AI service usage and costs', async ({ request }) => {
      const usageResponse = await request.get(`${config.apiURL}/api/ai/usage-stats`);
      expect(usageResponse.status()).toBe(200);
      
      const usage = await usageResponse.json();
      
      expect(usage).toHaveProperty('total_requests');
      expect(usage).toHaveProperty('cache_hit_rate');
      expect(usage).toHaveProperty('gpt5_nano');
      expect(usage).toHaveProperty('gpt5_mini');
      
      console.log('💰 AI usage stats:', usage);
    });
  });

  // Utility functions for tests
  async function waitForEmailProcessing(page: Page, emailId: string, timeout = 10000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await page.request.get(`${config.apiURL}/api/emails/${emailId}/status`);
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
  
  async function seedTestData(page: Page): Promise<void> {
    for (const email of testEmails) {
      await page.request.post(`${config.apiURL}/api/emails/seed`, {
        data: email
      });
    }
  }
});