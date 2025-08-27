/**
 * Design System Setup
 * Initialization and integration script for the unified design system
 */

import { initializeTheme, ThemeConfig } from './theme';

// Import the main design system styles
import './index.scss';

/**
 * Initialize the design system with default or custom configuration
 */
export const setupDesignSystem = (config?: Partial<ThemeConfig>) => {
  // Initialize theme manager
  const themeManager = initializeTheme(config);
  
  // Add skip-to-content link for accessibility
  addSkipToContentLink();
  
  // Add design system classes to body for easier targeting
  document.body.classList.add('design-system-initialized');
  
  // Log successful initialization
  console.log('✅ Design System initialized successfully');
  console.log('Current theme:', themeManager.getTheme());
  
  return themeManager;
};

/**
 * Add skip-to-content link for keyboard navigation
 */
const addSkipToContentLink = () => {
  if (document.querySelector('.skip-to-content')) return; // Already exists
  
  const skipLink = document.createElement('a');
  skipLink.className = 'skip-to-content';
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  
  document.body.insertBefore(skipLink, document.body.firstChild);
};

/**
 * Migration utility: Replace old class names with design system utilities
 */
export const migrationMap: Record<string, string> = {
  // Color classes
  'text-gray-900': 'u-text-primary',
  'text-gray-600': 'u-text-secondary',
  'text-gray-500': 'u-text-tertiary',
  'text-slate-900': 'u-text-primary',
  'text-slate-300': 'u-text-secondary',
  'bg-gray-50': 'u-bg-surface',
  'bg-gray-100': 'u-bg-surface-secondary',
  'bg-white': 'u-bg-surface',
  'bg-slate-900': 'u-bg-surface',
  'bg-slate-800': 'u-bg-surface-secondary',
  'border-gray-200': 'u-border-primary',
  'border-gray-300': 'u-border-secondary',
  'border-slate-700': 'u-border-primary',
  
  // Spacing classes
  'p-4': 'u-p-4',
  'p-6': 'u-p-6',
  'px-4': 'u-px-4',
  'py-2': 'u-py-2',
  'm-4': 'u-m-4',
  'mb-2': 'u-mb-2',
  'mt-3': 'u-mt-3',
  
  // Typography classes
  'text-lg': 'u-text-lg',
  'text-sm': 'u-text-sm',
  'text-xs': 'u-text-xs',
  'font-medium': 'u-font-medium',
  'font-semibold': 'u-font-semibold',
  'font-bold': 'u-font-bold',
  
  // Layout classes
  'rounded-lg': 'u-rounded-lg',
  'rounded-md': 'u-rounded-md',
  'rounded': 'u-rounded-md',
  'shadow-sm': 'u-shadow-sm',
  'shadow-md': 'u-shadow-md',
  'border': 'u-border u-border-primary',
  
  // Flex utilities
  'flex': 'u-flex',
  'items-center': 'u-items-center',
  'justify-between': 'u-justify-between',
  'gap-2': 'u-gap-2',
  'gap-4': 'u-gap-4',
  
  // Common status colors (hardcoded to semantic)
  'bg-blue-100': 'u-bg-status-in-progress',
  'text-blue-800': 'u-text-status-in-progress',
  'bg-orange-100': 'u-bg-priority-high',
  'text-orange-800': 'u-text-priority-high',
  'bg-green-100': 'u-bg-status-completed',
  'text-green-800': 'u-text-status-completed',
  'bg-red-100': 'u-bg-error',
  'text-red-800': 'u-text-error',
};

/**
 * Utility to help migrate existing components
 */
export const migrateClassNames = (classNames: string): string => {
  return classNames
    .split(' ')
    .map(className => migrationMap[className as keyof typeof migrationMap] || className)
    .join(' ');
};

/**
 * Development helper: Log all CSS custom properties available
 */
export const logDesignTokens = () => {
  if (process.env.NODE_ENV !== 'development') return;
  
  const styles = getComputedStyle(document.documentElement);
  const tokens: Record<string, string> = {};
  
  // Extract all custom properties (CSS variables)
  for (let i = 0; i < styles.length; i++) {
    const name = styles[i];
    if (name.startsWith('--')) {
      tokens[name] = styles.getPropertyValue(name).trim();
    }
  }
  
  console.group('🎨 Design System Tokens');
  
  // Group tokens by category
  const categories = {
    colors: Object.keys(tokens).filter(key => key.includes('color')),
    spacing: Object.keys(tokens).filter(key => key.includes('space')),
    typography: Object.keys(tokens).filter(key => key.includes('font') || key.includes('text') || key.includes('line')),
    layout: Object.keys(tokens).filter(key => key.includes('radius') || key.includes('shadow') || key.includes('z-index')),
    components: Object.keys(tokens).filter(key => key.includes('task-card') || key.includes('button') || key.includes('input')),
  };
  
  Object.entries(categories).forEach(([category, keys]) => {
    if (keys.length > 0) {
      console.group(`📝 ${category.charAt(0).toUpperCase() + category.slice(1)} Tokens`);
      keys.forEach(key => {
        console.log(`${key}: ${tokens[key]}`);
      });
      console.groupEnd();
    }
  });
  
  console.groupEnd();
};

/**
 * Performance monitoring for design system
 */
export const monitorDesignSystemPerformance = () => {
  if (process.env.NODE_ENV !== 'development') return;
  
  // Monitor CSS custom property usage
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const cssEntries = entries.filter(entry => 
      entry.name.includes('.css') || (entry as PerformanceResourceTiming).initiatorType === 'css'
    );
    
    if (cssEntries.length > 0) {
      console.group('⚡ Design System Performance');
      cssEntries.forEach(entry => {
        const duration = (entry as PerformanceResourceTiming).duration || 0;
        console.log(`${entry.name}: ${duration.toFixed(2)}ms`);
      });
      console.groupEnd();
    }
  });
  
  observer.observe({ entryTypes: ['resource', 'navigation'] });
};

/**
 * Validate theme configuration
 */
export const validateThemeConfig = (config: Partial<ThemeConfig>): boolean => {
  const validModes = ['light', 'dark', 'system', 'high-contrast'];
  const validDensities = ['compact', 'comfortable', 'spacious'];
  const validBorderRadius = ['none', 'sm', 'md', 'lg', 'xl'];
  
  if (config.mode && !validModes.includes(config.mode)) {
    console.warn(`Invalid theme mode: ${config.mode}. Valid options: ${validModes.join(', ')}`);
    return false;
  }
  
  if (config.density && !validDensities.includes(config.density)) {
    console.warn(`Invalid density: ${config.density}. Valid options: ${validDensities.join(', ')}`);
    return false;
  }
  
  if (config.borderRadius && !validBorderRadius.includes(config.borderRadius)) {
    console.warn(`Invalid border radius: ${config.borderRadius}. Valid options: ${validBorderRadius.join(', ')}`);
    return false;
  }
  
  if (config.primaryColor && !isValidColor(config.primaryColor)) {
    console.warn(`Invalid primary color: ${config.primaryColor}`);
    return false;
  }
  
  return true;
};

/**
 * Utility to check if a color is valid
 */
const isValidColor = (color: string): boolean => {
  // Create a temporary element to test color validity
  const temp = document.createElement('div');
  temp.style.color = color;
  return temp.style.color !== '';
};

/**
 * Export design system status for debugging
 */
export const getDesignSystemStatus = () => {
  const themeManager = window.__THEME_MANAGER__;
  
  return {
    initialized: !!themeManager,
    theme: themeManager?.getTheme(),
    effectiveMode: themeManager?.getEffectiveMode(),
    isDarkMode: themeManager?.isDarkMode(),
    isHighContrast: themeManager?.isHighContrast(),
    isReducedMotion: themeManager?.isReducedMotion(),
    tokensLoaded: !!getComputedStyle(document.documentElement).getPropertyValue('--color-primary-600'),
    bodyClasses: Array.from(document.body.classList),
    htmlAttributes: Array.from(document.documentElement.attributes).map(attr => ({
      name: attr.name,
      value: attr.value
    }))
  };
};

// Make theme manager globally available for debugging
declare global {
  interface Window {
    __THEME_MANAGER__: any;
    __DESIGN_SYSTEM_STATUS__: () => any;
  }
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.__DESIGN_SYSTEM_STATUS__ = getDesignSystemStatus;
}