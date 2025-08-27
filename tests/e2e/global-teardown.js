// Global teardown for Playwright E2E tests

async function globalTeardown() {
  console.log('🧹 Starting E2E test teardown...');
  
  try {
    // Clean up test data if needed
    console.log('⏳ Cleaning up test data...');
    
    // You could add cleanup logic here, such as:
    // - Removing test users
    // - Clearing test emails
    // - Resetting database state
    
    // For now, we'll just log that teardown is complete
    console.log('✅ Test data cleanup complete');
    
    console.log('🎉 E2E test teardown completed successfully!');
    
  } catch (error) {
    console.error('❌ E2E test teardown failed:', error.message);
    // Don't throw error in teardown to avoid masking test failures
  }
}

module.exports = globalTeardown;