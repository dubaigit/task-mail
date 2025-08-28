/**
 * Jest Setup for React Frontend Tests
 * Enhanced configuration with performance monitoring and utilities
 */

import '@testing-library/jest-dom';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  error: jest.fn(),
  warn: jest.fn(),
  // Mock out info and log
  info: jest.fn(),
  log: jest.fn(),
  debug: jest.fn()
};

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver for virtualized lists
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver for lazy loading tests
global.IntersectionObserver = jest.fn().mockImplementation((callback, options) => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  thresholds: options?.threshold || [0],
  root: options?.root || null,
  rootMargin: options?.rootMargin || '',
}));

// Mock requestAnimationFrame for animation tests
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch for API tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
  })
);

// Mock Image for image loading tests
global.Image = class {
  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
};

// Performance monitoring setup for tests
const testStartTimes = new Map();

beforeEach(() => {
  const testName = expect.getState().currentTestName;
  if (testName) {
    testStartTimes.set(testName, performance.now());
  }
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset localStorage and sessionStorage
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
});

afterEach(() => {
  const testName = expect.getState().currentTestName;
  if (testName && testStartTimes.has(testName)) {
    const duration = performance.now() - testStartTimes.get(testName);
    
    // Log slow tests (>1 second for frontend)
    if (duration > 1000) {
      console.warn(`⚠️  Slow frontend test: ${testName} took ${Math.round(duration)}ms`);
    }
    
    testStartTimes.delete(testName);
  }
});

// Global test utilities for React components
global.testUtils = {
  // Wait for async state updates
  waitForNextUpdate: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Create mock component props
  createMockProps: (overrides = {}) => ({
    className: 'test-component',
    'data-testid': 'test-element',
    ...overrides
  }),
  
  // Mock event objects
  createMockEvent: (overrides = {}) => ({
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    target: { value: '' },
    currentTarget: { value: '' },
    ...overrides
  }),
  
  // Create test data
  createTestTask: (overrides = {}) => ({
    id: 'test-task-1',
    title: 'Test Task',
    description: 'Test Description',
    status: 'todo',
    priority: 'medium',
    dueDate: new Date().toISOString(),
    ...overrides
  }),
  
  createTestEmail: (overrides = {}) => ({
    id: 'test-email-1',
    subject: 'Test Email',
    sender: 'test@example.com',
    body: 'Test email body',
    date: new Date().toISOString(),
    ...overrides
  }),
};

// Enhanced matchers for React testing
expect.extend({
  toHaveAccessibleName(received, expected) {
    const accessibleName = received.getAttribute('aria-label') || 
                          received.getAttribute('aria-labelledby') || 
                          received.textContent;
    
    const pass = accessibleName === expected;
    
    return {
      message: () => 
        pass 
          ? `Expected element not to have accessible name "${expected}"`
          : `Expected element to have accessible name "${expected}", but got "${accessibleName}"`,
      pass,
    };
  },
  
  toBeVisuallyHidden(received) {
    const style = getComputedStyle(received);
    const isHidden = style.position === 'absolute' && 
                    style.width === '1px' && 
                    style.height === '1px' && 
                    style.overflow === 'hidden';
    
    return {
      message: () => 
        isHidden 
          ? 'Expected element not to be visually hidden'
          : 'Expected element to be visually hidden',
      pass: isHidden,
    };
  }
});

// Error boundary for catching React errors in tests
const ErrorBoundary = class extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Test Error Boundary caught an error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { 'data-testid': 'error-boundary' }, 'Something went wrong.');
    }
    
    return this.props.children;
  }
};

global.TestErrorBoundary = ErrorBoundary;