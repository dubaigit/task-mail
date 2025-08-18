// React testing setup
import '@testing-library/jest-dom';
import React, { createContext } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Mock window.matchMedia for responsive tests
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

// Mock IntersectionObserver for virtual scrolling tests
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver for responsive tests  
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.ResizeObserver = MockResizeObserver as any;

// Mock performance API for performance tests
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    now: jest.fn(() => Date.now()),
  },
});

// Mock localStorage for theme persistence tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Theme Context Provider for tests
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const TestThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = React.useState(false);
  
  const toggleTheme = React.useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  const value = React.useMemo(() => ({
    isDark,
    toggleTheme,
  }), [isDark, toggleTheme]);

  return React.createElement(
    ThemeContext.Provider,
    { value },
    children
  );
};

// Override the default render to include providers
const customRender = (ui: React.ReactElement, options: RenderOptions = {}) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => 
    React.createElement(TestThemeProvider, null, children);

  return render(ui, { wrapper: Wrapper, ...options });
};

// Export everything from testing-library
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Mock the useTheme hook from App.tsx
jest.mock('./App', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: jest.fn(),
  }),
}));