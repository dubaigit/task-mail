// Jest setup file for backend tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'test-supabase-key';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers
jest.useFakeTimers();

// Global test utilities
global.testUtils = {
  // Helper to create mock request objects
  createMockReq: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 1, email: 'test@example.com' },
    ...overrides
  }),
  
  // Helper to create mock response objects
  createMockRes: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },
  
  // Helper to create mock next function
  createMockNext: () => jest.fn(),
  
  // Helper to wait for promises
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create mock database responses
  createMockDbResponse: (data = null, error = null) => ({
    data,
    error,
    status: error ? 500 : 200,
    statusText: error ? 'Internal Server Error' : 'OK'
  })
};

// Global beforeEach for all tests
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset modules
  jest.resetModules();
  
  // Clear timers
  jest.clearAllTimers();
});

// Global afterEach for all tests
afterEach(() => {
  // Run pending timers
  jest.runOnlyPendingTimers();
});

// Global afterAll for cleanup
afterAll(() => {
  // Use real timers
  jest.useRealTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
});