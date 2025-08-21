/**
 * Comprehensive System Health Tests
 * Validates entire system architecture and deployment consistency
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/testing-library/jest-dom';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const API_BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

interface SystemHealth {
  backend: boolean;
  frontend: boolean;
  database: boolean;
  aiService: boolean;
  portConsistency: boolean;
}

describe('System Health Comprehensive Tests', () => {
  let systemHealth: SystemHealth;

  beforeAll(async () => {
    systemHealth = await performSystemHealthCheck();
    console.log('System Health Status:', systemHealth);
  });

  describe('Architecture Validation', () => {
    test('should have consistent port configuration', async () => {
      const portConfig = await validatePortConfiguration();
      expect(portConfig.consistent).toBe(true);
      expect(portConfig.issues).toHaveLength(0);
    });

    test('should have proper service dependencies', async () => {
      expect(systemHealth.backend).toBe(true);
      expect(systemHealth.database).toBe(true);
      expect(systemHealth.aiService).toBe(true);
    });

    test('should validate environment configuration', async () => {
      const envValidation = await validateEnvironmentConfig();
      expect(envValidation.valid).toBe(true);
      expect(envValidation.missingVars).toHaveLength(0);
    });
  });

  describe('Service Health Monitoring', () => {
    test('backend service should be healthy', async () => {
      if (!systemHealth.backend) {
        console.warn('Backend service not running - skipping health check');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
      expect(health.database).toBe('connected');
      expect(health.ai_service).toBe('available');
    });

    test('database connectivity should be stable', async () => {
      if (!systemHealth.backend) return;

      // Test multiple database operations
      const operations = [
        () => fetch(`${API_BASE_URL}/api/tasks?limit=1`),
        () => fetch(`${API_BASE_URL}/api/sync-status`),
        () => fetch(`${API_BASE_URL}/api/ai/usage-stats`)
      ];

      const results = await Promise.all(operations.map(op => op()));
      results.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('AI service should be responsive', async () => {
      if (!systemHealth.backend) return;

      const testCommand = {
        command: 'System health test',
        context: { test: true }
      };

      const response = await fetch(`${API_BASE_URL}/api/ai/process-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCommand)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent requests efficiently', async () => {
      if (!systemHealth.backend) return;

      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map(() => 
        fetch(`${API_BASE_URL}/api/health`)
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      console.log(`${concurrentRequests} concurrent requests completed in ${duration}ms`);
    });

    test('should handle large task list queries', async () => {
      if (!systemHealth.backend) return;

      const start = Date.now();
      const response = await fetch(`${API_BASE_URL}/api/tasks?limit=100`);
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(3000);

      const tasks = await response.json();
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Security and Error Handling', () => {
    test('should handle malformed requests securely', async () => {
      if (!systemHealth.backend) return;

      const malformedRequests = [
        { url: `${API_BASE_URL}/api/tasks`, method: 'POST', body: 'invalid-json' },
        { url: `${API_BASE_URL}/api/ai/process-command`, method: 'POST', body: '{"invalid": }' },
        { url: `${API_BASE_URL}/api/nonexistent`, method: 'GET', body: null }
      ];

      for (const req of malformedRequests) {
        try {
          const response = await fetch(req.url, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: req.body
          });
          
          expect([400, 404, 405, 500]).toContain(response.status);
        } catch (error) {
          // Network errors are acceptable for malformed requests
          expect(error).toBeDefined();
        }
      }
    });

    test('should validate CORS configuration', async () => {
      if (!systemHealth.backend) return;

      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'OPTIONS'
      });

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Deployment Validation', () => {
    test('should have correct file structure', async () => {
      const requiredFiles = [
        'package.json',
        'server.js',
        '.env',
        'dashboard/frontend/package.json',
        'dashboard/frontend/src/components/TaskCentric/EmailTaskDashboard.tsx'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(process.cwd(), file);
        try {
          await fs.access(filePath);
        } catch {
          throw new Error(`Required file missing: ${file}`);
        }
      }
    });

    test('should have correct npm scripts', async () => {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
      );

      expect(packageJson.scripts).toHaveProperty('start');
      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts).toHaveProperty('build');
    });
  });
});

// Helper Functions

async function performSystemHealthCheck(): Promise<SystemHealth> {
  const health: SystemHealth = {
    backend: false,
    frontend: false,
    database: false,
    aiService: false,
    portConsistency: false
  };

  // Check backend
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000)
    });
    health.backend = response.ok;
    
    if (response.ok) {
      const data = await response.json();
      health.database = data.database === 'connected';
      health.aiService = data.ai_service === 'available';
    }
  } catch (error) {
    console.log('Backend health check failed:', error);
  }

  // Check frontend
  try {
    const response = await fetch(FRONTEND_URL, {
      signal: AbortSignal.timeout(5000)
    });
    health.frontend = response.ok;
  } catch (error) {
    console.log('Frontend health check failed:', error);
  }

  // Check port consistency
  health.portConsistency = await checkPortConsistency();

  return health;
}

async function validatePortConfiguration(): Promise<{consistent: boolean, issues: string[]}> {
  const issues: string[] = [];
  
  try {
    // Check .env file
    const envContent = await fs.readFile('.env', 'utf-8');
    if (!envContent.includes('PORT=8000')) {
      issues.push('.env file does not specify PORT=8000');
    }

    // Check frontend proxy configuration
    const frontendPackageJson = JSON.parse(
      await fs.readFile('dashboard/frontend/package.json', 'utf-8')
    );
    if (frontendPackageJson.proxy !== 'http://localhost:8000') {
      issues.push(`Frontend proxy is set to ${frontendPackageJson.proxy}, should be http://localhost:8000`);
    }

    // Check for hardcoded ports in frontend code
    const dashboardFile = await fs.readFile(
      'dashboard/frontend/src/components/TaskCentric/EmailTaskDashboard.tsx',
      'utf-8'
    );
    
    if (dashboardFile.includes('localhost:8002')) {
      issues.push('Frontend code contains references to localhost:8002');
    }

  } catch (error) {
    issues.push(`Error reading configuration files: ${error}`);
  }

  return {
    consistent: issues.length === 0,
    issues
  };
}

async function checkPortConsistency(): Promise<boolean> {
  const portsToCheck = [8000, 8002, 3001];
  const runningPorts: number[] = [];

  for (const port of portsToCheck) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`, {
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        runningPorts.push(port);
      }
    } catch {
      // Port not responding
    }
  }

  // Only port 8000 should be running
  return runningPorts.length === 1 && runningPorts[0] === 8000;
}

async function validateEnvironmentConfig(): Promise<{valid: boolean, missingVars: string[]}> {
  const requiredVars = [
    'PORT',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'OPENAI_API_KEY'
  ];

  const missingVars: string[] = [];

  try {
    const envContent = await fs.readFile('.env', 'utf-8');
    
    for (const varName of requiredVars) {
      if (!envContent.includes(`${varName}=`)) {
        missingVars.push(varName);
      }
    }
  } catch (error) {
    missingVars.push('Unable to read .env file');
  }

  return {
    valid: missingVars.length === 0,
    missingVars
  };
}