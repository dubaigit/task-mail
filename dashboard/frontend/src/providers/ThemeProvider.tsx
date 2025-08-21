/**
 * Enterprise Email Management - Theme Provider
 * Adaptive dark mode with system preference detection and user override
 * 
 * Features:
 * - Automatic system preference detection
 * - Manual theme switching with persistence
 * - Smooth transitions between themes
 * - High contrast mode support
 * - Reduced motion support
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeProviderContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  systemTheme: ResolvedTheme;
  isSystemPreference: boolean;
}

const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

/**
 * Detects the current system theme preference
 */
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Gets the stored theme preference from localStorage
 */
const getStoredTheme = (storageKey: string): Theme | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      return stored as Theme;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }
  
  return null;
};

/**
 * Stores the theme preference in localStorage
 */
const setStoredTheme = (storageKey: string, theme: Theme): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(storageKey, theme);
  } catch (error) {
    console.warn('Failed to store theme in localStorage:', error);
  }
};

/**
 * Updates the document attributes and classes for theme switching
 */
const updateThemeAttributes = (
  resolvedTheme: ResolvedTheme, 
  attribute: string,
  disableTransitionOnChange: boolean
): void => {
  const root = document.documentElement;
  
  // Temporarily disable transitions to prevent flash
  if (disableTransitionOnChange) {
    const css = document.createElement('style');
    css.appendChild(
      document.createTextNode(
        '*, *::before, *::after { transition: none !important; animation-duration: 0.01ms !important; }'
      )
    );
    document.head.appendChild(css);
    
    // Force a reflow
    root.offsetHeight;
    
    // Re-enable transitions after a short delay
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  }
  
  // Update the data attribute for CSS variable switching
  root.setAttribute(attribute, resolvedTheme);
  
  // Add class for additional styling if needed
  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
  
  // Update meta theme-color for mobile browsers
  updateMetaThemeColor(resolvedTheme);
};

/**
 * Updates the meta theme-color tag for mobile browser chrome
 */
const updateMetaThemeColor = (resolvedTheme: ResolvedTheme): void => {
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  const color = resolvedTheme === 'dark' ? '#1a1a1a' : '#ffffff';
  
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', color);
  } else {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', color);
    document.head.appendChild(meta);
  }
};

/**
 * Theme Provider Component
 * Manages theme state, system preference detection, and theme switching
 */
export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'email-app-theme',
  attribute = 'data-theme',
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps): JSX.Element {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme(storageKey);
    return stored || defaultTheme;
  });

  // Calculate the resolved theme (what actually gets applied)
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;
  const isSystemPreference = theme === 'system';

  /**
   * Updates theme with storage persistence and DOM updates
   */
  const setTheme = (newTheme: Theme): void => {
    setThemeState(newTheme);
    setStoredTheme(storageKey, newTheme);
  };

  /**
   * Toggles between light and dark themes
   * If currently using system preference, switches to the opposite of system theme
   */
  const toggleTheme = (): void => {
    if (theme === 'system') {
      // If using system, toggle to opposite of current system theme
      setTheme(systemTheme === 'dark' ? 'light' : 'dark');
    } else {
      // If using explicit theme, toggle to opposite
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent): void => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [enableSystem]);

  // Update DOM when resolved theme changes
  useEffect(() => {
    updateThemeAttributes(resolvedTheme, attribute, disableTransitionOnChange);
  }, [resolvedTheme, attribute, disableTransitionOnChange]);

  // Initialize theme on mount
  useEffect(() => {
    updateThemeAttributes(resolvedTheme, attribute, disableTransitionOnChange);
  }, []);

  const contextValue: ThemeProviderContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    systemTheme,
    isSystemPreference,
  };

  return (
    <ThemeProviderContext.Provider value={contextValue}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * Hook to access the theme context
 * Throws an error if used outside of ThemeProvider
 */
export function useTheme(): ThemeProviderContextType {
  const context = useContext(ThemeProviderContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

/**
 * Theme Toggle Button Component
 * Provides accessible theme switching with proper ARIA labels
 */
interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: 'button' | 'icon';
}

export function ThemeToggle({ 
  className = '', 
  size = 'md', 
  showLabel = false,
  variant = 'button'
}: ThemeToggleProps): JSX.Element {
  const { theme, resolvedTheme, toggleTheme, isSystemPreference } = useTheme();
  
  const getAriaLabel = (): string => {
    if (isSystemPreference) {
      return `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme (currently using system: ${resolvedTheme})`;
    }
    return `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`;
  };

  const getIcon = (): string => {
    if (resolvedTheme === 'dark') {
      return '☀️'; // Sun icon for switching to light
    }
    return '🌙'; // Moon icon for switching to dark
  };

  const getLabel = (): string => {
    if (isSystemPreference) {
      return `System (${resolvedTheme})`;
    }
    return resolvedTheme === 'dark' ? 'Dark' : 'Light';
  };

  const sizeClasses = {
    sm: 'text-sm p-1',
    md: 'text-base p-2',
    lg: 'text-lg p-3'
  };

  const baseClasses = `
    inline-flex items-center justify-center gap-2 
    rounded-md border border-input bg-transparent 
    hover:bg-accent hover:text-accent-foreground
    transition-colors focus:outline-none focus:ring-2 
    focus:ring-accent focus:ring-offset-2
    ${sizeClasses[size]} ${className}
  `;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
      className={baseClasses}
    >
      <span role="img" aria-hidden="true">
        {getIcon()}
      </span>
      {showLabel && (
        <span className="font-medium">
          {getLabel()}
        </span>
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}

/**
 * Theme Selector Component
 * Provides a dropdown to select between light, dark, and system themes
 */
interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className = '' }: ThemeSelectorProps): JSX.Element {
  const { theme, setTheme, systemTheme } = useTheme();

  const options = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: `System (${systemTheme})`, icon: '⚙️' },
  ] as const;

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      className={`
        bg-background border border-input rounded-md px-3 py-2
        text-sm focus:outline-none focus:ring-2 focus:ring-accent
        focus:ring-offset-2 cursor-pointer ${className}
      `}
      aria-label="Select theme"
    >
      {options.map(({ value, label, icon }) => (
        <option key={value} value={value}>
          {icon} {label}
        </option>
      ))}
    </select>
  );
}

/**
 * Hook to detect if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to detect if user prefers high contrast
 */
export function useHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersHighContrast;
}

export default ThemeProvider;