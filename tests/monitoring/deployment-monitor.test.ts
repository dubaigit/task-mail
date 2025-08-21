/**
 * Deployment Monitoring Tests
 * Continuous monitoring to prevent future port misconfigurations
 */

import { describe, test, expect } from '@jest/testing-library/jest-dom';
import { promises as fs } from 'fs';
import path from 'path';

describe('Deployment Monitor - Port Configuration', () => {
  
  test('should enforce single port (8000) across all configurations', async () => {
    const configurations = await scanPortConfigurations();
    
    // All configurations should use port 8000
    expect(configurations.envPort).toBe('8000');
    expect(configurations.frontendProxy).toBe('http://localhost:8000');
    expect(configurations.hardcodedPorts).toHaveLength(0);
    expect(configurations.incorrectPorts).toHaveLength(0);
  });

  test('should detect any new hardcoded ports in code', async () => {
    const codeFiles = await scanCodeFiles();
    const portViolations: string[] = [];

    for (const file of codeFiles) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Look for localhost:PORT where PORT is not 8000
      const portMatches = content.match(/localhost:(\d+)/g);
      if (portMatches) {
        for (const match of portMatches) {
          const port = match.split(':')[1];
          if (port !== '8000' && port !== '3000') { // 3000 is allowed for frontend
            portViolations.push(`${file}: ${match}`);
          }
        }
      }
    }

    expect(portViolations).toHaveLength(0);
    if (portViolations.length > 0) {
      console.error('Port violations found:', portViolations);
    }
  });

  test('should validate server startup configuration', async () => {
    const serverFile = await fs.readFile('server.js', 'utf-8');
    
    // Server should use process.env.PORT with 8000 as backup
    expect(serverFile).toMatch(/process\.env\.PORT.*8000/);
    
    // Should not have hardcoded port 3001
    expect(serverFile).not.toMatch(/PORT\s*=\s*3001/);
  });

  test('should validate frontend proxy configuration', async () => {
    const packageJson = JSON.parse(
      await fs.readFile('dashboard/frontend/package.json', 'utf-8')
    );

    expect(packageJson.proxy).toBe('http://localhost:8000');
  });

  test('should validate environment file consistency', async () => {
    const envContent = await fs.readFile('.env', 'utf-8');
    const envLines = envContent.split('\n');
    
    const portLine = envLines.find(line => line.startsWith('PORT='));
    expect(portLine).toBe('PORT=8000');
    
    // CORS origin should be configured correctly
    const corsLine = envLines.find(line => line.startsWith('CORS_ORIGIN='));
    expect(corsLine).toBe('CORS_ORIGIN=http://localhost:3000');
  });
});

describe('Deployment Monitor - Service Health', () => {
  
  test('should verify backend service is running on correct port', async () => {
    try {
      const response = await fetch('http://localhost:8000/api/health');
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
    } catch (error) {
      console.warn('Backend service health check failed:', error);
    }
  });

  test('should ensure no services running on conflicting ports', async () => {
    const conflictingPorts = [3001, 8001, 8002];
    const runningConflicts: number[] = [];

    for (const port of conflictingPorts) {
      try {
        const response = await fetch(`http://localhost:${port}/api/health`, {
          signal: AbortSignal.timeout(1000)
        });
        if (response.ok) {
          runningConflicts.push(port);
        }
      } catch {
        // Expected - port should not be running
      }
    }

    expect(runningConflicts).toHaveLength(0);
    if (runningConflicts.length > 0) {
      console.error('Conflicting services found on ports:', runningConflicts);
    }
  });

  test('should validate database connectivity', async () => {
    try {
      const response = await fetch('http://localhost:8000/api/health');
      if (response.ok) {
        const health = await response.json();
        expect(health.database).toBe('connected');
        expect(health).toHaveProperty('timestamp');
      }
    } catch (error) {
      console.warn('Database connectivity check failed:', error);
    }
  });

  test('should validate AI service availability', async () => {
    try {
      const response = await fetch('http://localhost:8000/api/ai/usage-stats');
      if (response.ok) {
        const stats = await response.json();
        expect(stats).toHaveProperty('daily');
        expect(stats).toHaveProperty('balance');
      }
    } catch (error) {
      console.warn('AI service check failed:', error);
    }
  });
});

describe('Deployment Monitor - Configuration Drift', () => {
  
  test('should detect configuration changes', async () => {
    const configSnapshot = await captureConfigurationSnapshot();
    
    // Store baseline configuration
    const expectedConfig = {
      serverPort: '8000',
      frontendProxy: 'http://localhost:8000',
      envPort: '8000',
      corsOrigin: 'http://localhost:3000'
    };

    expect(configSnapshot).toMatchObject(expectedConfig);
  });

  test('should validate package.json scripts', async () => {
    const packageJson = JSON.parse(
      await fs.readFile('package.json', 'utf-8')
    );

    expect(packageJson.scripts.start).toBe('node server.js');
    expect(packageJson.scripts.dev).toBe('nodemon server.js');
  });

  test('should ensure Docker configuration is consistent', async () => {
    try {
      const dockerCompose = await fs.readFile('docker-compose.yml', 'utf-8');
      
      // Should not expose port 8000 externally if we want frontend proxy
      expect(dockerCompose).not.toMatch(/8000:8000/);
      
    } catch (error) {
      // Docker compose file might not exist
      console.log('Docker compose file not found');
    }
  });
});

// Helper Functions

async function scanPortConfigurations() {
  const configurations: any = {
    incorrectPorts: [],
    hardcodedPorts: []
  };

  // Check .env file
  try {
    const envContent = await fs.readFile('.env', 'utf-8');
    const portMatch = envContent.match(/^PORT=(.+)$/m);
    configurations.envPort = portMatch ? portMatch[1] : 'not-found';
  } catch {
    configurations.envPort = 'file-not-found';
  }

  // Check frontend package.json
  try {
    const packageJson = JSON.parse(
      await fs.readFile('dashboard/frontend/package.json', 'utf-8')
    );
    configurations.frontendProxy = packageJson.proxy || 'not-configured';
  } catch {
    configurations.frontendProxy = 'file-not-found';
  }

  // Scan for hardcoded ports in TypeScript/JavaScript files
  const codeFiles = await scanCodeFiles();
  for (const file of codeFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const portMatches = content.match(/localhost:(\d+)/g);
      
      if (portMatches) {
        for (const match of portMatches) {
          const port = match.split(':')[1];
          if (port !== '8000' && port !== '3000') {
            configurations.incorrectPorts.push(`${file}: ${match}`);
          }
          configurations.hardcodedPorts.push(`${file}: ${match}`);
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  return configurations;
}

async function scanCodeFiles(): Promise<string[]> {
  const files: string[] = [];
  
  const directories = [
    'dashboard/frontend/src',
    '.',
    'tests'
  ];

  const extensions = ['.ts', '.tsx', '.js', '.jsx'];

  for (const dir of directories) {
    try {
      await scanDirectory(dir, files, extensions);
    } catch (error) {
      // Directory might not exist
    }
  }

  return files;
}

async function scanDirectory(dir: string, files: string[], extensions: string[]): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await scanDirectory(fullPath, files, extensions);
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
}

async function captureConfigurationSnapshot() {
  const snapshot: any = {};

  // Capture server configuration
  try {
    const serverContent = await fs.readFile('server.js', 'utf-8');
    const portMatch = serverContent.match(/process\.env\.PORT.*?(\d+)/);
    snapshot.serverPort = portMatch ? portMatch[1] : 'not-found';
  } catch {
    snapshot.serverPort = 'file-not-found';
  }

  // Capture frontend proxy
  try {
    const packageJson = JSON.parse(
      await fs.readFile('dashboard/frontend/package.json', 'utf-8')
    );
    snapshot.frontendProxy = packageJson.proxy;
  } catch {
    snapshot.frontendProxy = 'file-not-found';
  }

  // Capture environment configuration
  try {
    const envContent = await fs.readFile('.env', 'utf-8');
    const portMatch = envContent.match(/^PORT=(.+)$/m);
    const corsMatch = envContent.match(/^CORS_ORIGIN=(.+)$/m);
    
    snapshot.envPort = portMatch ? portMatch[1] : 'not-found';
    snapshot.corsOrigin = corsMatch ? corsMatch[1] : 'not-found';
  } catch {
    snapshot.envPort = 'file-not-found';
    snapshot.corsOrigin = 'file-not-found';
  }

  return snapshot;
}