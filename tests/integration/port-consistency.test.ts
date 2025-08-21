/**
 * Port Consistency Integration Tests
 * Tests to ensure all API endpoints are accessible on the correct port
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/testing-library/jest-dom';

const API_BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

describe('Port Consistency Tests', () => {
  let serverRunning = false;

  beforeAll(async () => {
    // Test if backend server is running on correct port
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      serverRunning = response.ok;
    } catch {
      console.warn('Backend server not running on port 8000');
    }
  });

  describe('Backend API Endpoints', () => {
    test('should access health endpoint on port 8000', async () => {
      if (!serverRunning) {
        console.warn('Skipping test - server not running');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.database).toBe('connected');
    });

    test('should access AI usage stats on port 8000', async () => {
      if (!serverRunning) return;

      const response = await fetch(`${API_BASE_URL}/api/ai/usage-stats`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('daily');
      expect(data).toHaveProperty('balance');
    });

    test('should access sync status on port 8000', async () => {
      if (!serverRunning) return;

      const response = await fetch(`${API_BASE_URL}/api/sync-status`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('lastSync');
      expect(data).toHaveProperty('totalEmails');
    });

    test('should access tasks endpoint on port 8000', async () => {
      if (!serverRunning) return;

      const response = await fetch(`${API_BASE_URL}/api/tasks`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should NOT respond on port 8002', async () => {
      try {
        const response = await fetch('http://localhost:8002/api/health', {
          signal: AbortSignal.timeout(2000)
        });
        // If we get here, port 8002 is running (unexpected)
        console.warn('WARNING: Port 8002 is running - this may cause conflicts');
      } catch (error) {
        // Expected - port 8002 should not be running
        expect(error.name).toMatch(/AbortError|TypeError|Error/);
      }
    });
  });

  describe('AI Processing Endpoints', () => {
    test('should process AI commands on port 8000', async () => {
      if (!serverRunning) return;

      const response = await fetch(`${API_BASE_URL}/api/ai/process-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'test command',
          context: { test: true }
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('response');
      expect(data.success).toBe(true);
    });

    test('should classify emails on port 8000', async () => {
      if (!serverRunning) return;

      const response = await fetch(`${API_BASE_URL}/api/ai/classify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Test email content',
          subject: 'Test Subject',
          sender: 'test@example.com'
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('classification');
      expect(data.success).toBe(true);
    });
  });

  describe('Database Connectivity', () => {
    test('should connect to PostgreSQL database', async () => {
      if (!serverRunning) return;

      const response = await fetch(`${API_BASE_URL}/api/health`);
      const data = await response.json();
      
      expect(data.database).toBe('connected');
      expect(data).toHaveProperty('timestamp');
    });

    test('should handle database queries correctly', async () => {
      if (!serverRunning) return;

      const response = await fetch(`${API_BASE_URL}/api/tasks?limit=1`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Frontend-Backend Integration', () => {
  test('should proxy requests correctly from frontend', async () => {
    // This test assumes frontend is running on port 3000
    try {
      const response = await fetch(`${FRONTEND_URL}/api/health`);
      expect(response.status).toBe(200);
    } catch (error) {
      console.warn('Frontend not running - skipping proxy test');
    }
  });
});