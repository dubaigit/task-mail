import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');
  
  // Wait for services to be ready
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Health check for backend API
    console.log('⚡ Checking backend API health...');
    await page.goto('http://localhost:8001/health', { timeout: 30000 });
    
    // Health check for frontend
    console.log('🎨 Checking frontend health...');
    await page.goto('http://localhost:3000', { timeout: 30000 });
    
    // Wait for the app to be fully loaded
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
    
    console.log('✅ All services are ready for testing');
  } catch (error) {
    console.error('❌ Service health check failed:', error);
    throw new Error('Services not ready for testing');
  } finally {
    await browser.close();
  }
}

export default globalSetup;