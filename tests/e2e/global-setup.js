// Global setup for Playwright E2E tests
const { chromium } = require('@playwright/test');

async function globalSetup() {
  console.log('🚀 Starting E2E test setup...');
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for backend to be ready
    console.log('⏳ Waiting for backend to be ready...');
    let backendReady = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!backendReady && attempts < maxAttempts) {
      try {
        const response = await page.goto('http://localhost:8000/api/health', {
          waitUntil: 'networkidle',
          timeout: 5000
        });
        
        if (response && response.ok()) {
          const data = await response.json();
          if (data.status === 'healthy') {
            backendReady = true;
            console.log('✅ Backend is ready');
          }
        }
      } catch (error) {
        attempts++;
        console.log(`⏳ Backend not ready yet (attempt ${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!backendReady) {
      throw new Error('Backend failed to start within timeout period');
    }
    
    // Wait for frontend to be ready
    console.log('⏳ Waiting for frontend to be ready...');
    let frontendReady = false;
    attempts = 0;
    
    while (!frontendReady && attempts < maxAttempts) {
      try {
        const response = await page.goto('http://localhost:3000', {
          waitUntil: 'networkidle',
          timeout: 5000
        });
        
        if (response && response.ok()) {
          // Check if React app has loaded
          const title = await page.title();
          if (title.includes('Task Mail')) {
            frontendReady = true;
            console.log('✅ Frontend is ready');
          }
        }
      } catch (error) {
        attempts++;
        console.log(`⏳ Frontend not ready yet (attempt ${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!frontendReady) {
      throw new Error('Frontend failed to start within timeout period');
    }
    
    // Verify database connection
    console.log('⏳ Verifying database connection...');
    try {
      const response = await page.goto('http://localhost:8000/api/test', {
        waitUntil: 'networkidle'
      });
      
      if (response && response.ok()) {
        const data = await response.json();
        if (data.database === 'connected') {
          console.log('✅ Database connection verified');
        } else {
          console.warn('⚠️ Database connection issue detected');
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not verify database connection:', error.message);
    }
    
    // Setup test data if needed
    console.log('⏳ Setting up test data...');
    try {
      // Create test user if it doesn't exist
      await page.goto('http://localhost:8000/api/auth/setup-test-user', {
        method: 'POST',
        waitUntil: 'networkidle'
      });
      console.log('✅ Test user setup complete');
    } catch (error) {
      console.log('ℹ️ Test user already exists or setup not needed');
    }
    
    console.log('🎉 E2E test setup completed successfully!');
    
  } catch (error) {
    console.error('❌ E2E test setup failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;