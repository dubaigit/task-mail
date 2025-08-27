/**
 * Design System - Theme Management
 * Centralized theme configuration and management system
 */

// Import React for hook functionality
import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system' | 'high-contrast';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';
export type BorderRadiusMode = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface ThemeConfig {
  mode: ThemeMode;
  density: DensityMode;
  borderRadius: BorderRadiusMode;
  primaryColor?: string;
  accentColor?: string;
  reducedMotion?: boolean;
  highContrast?: boolean;
}

export interface ThemePreset {
  name: string;
  displayName: string;
  description: string;
  config: ThemeConfig;
}

// Default theme configuration
export const defaultThemeConfig: ThemeConfig = {
  mode: 'system',
  density: 'comfortable',
  borderRadius: 'md',
  reducedMotion: false,
  highContrast: false,
};

// Predefined theme presets
export const themePresets: ThemePreset[] = [
  {
    name: 'default',
    displayName: 'Default',
    description: 'Balanced design with comfortable spacing',
    config: {
      mode: 'system',
      density: 'comfortable',
      borderRadius: 'md',
    },
  },
  {
    name: 'compact',
    displayName: 'Compact',
    description: 'Dense layout for power users',
    config: {
      mode: 'system',
      density: 'compact',
      borderRadius: 'sm',
    },
  },
  {
    name: 'spacious',
    displayName: 'Spacious',
    description: 'Generous spacing for relaxed experience',
    config: {
      mode: 'system',
      density: 'spacious',
      borderRadius: 'lg',
    },
  },
  {
    name: 'minimal',
    displayName: 'Minimal',
    description: 'Clean design with sharp edges',
    config: {
      mode: 'light',
      density: 'comfortable',
      borderRadius: 'none',
    },
  },
  {
    name: 'dark-focus',
    displayName: 'Dark Focus',
    description: 'Dark theme optimized for focus',
    config: {
      mode: 'dark',
      density: 'compact',
      borderRadius: 'sm',
    },
  },
  {
    name: 'accessibility',
    displayName: 'High Contrast',
    description: 'Maximum contrast for accessibility',
    config: {
      mode: 'high-contrast',
      density: 'spacious',
      borderRadius: 'md',
      highContrast: true,
      reducedMotion: true,
    },
  },
];

// Theme storage key
const THEME_STORAGE_KEY = 'task-mail-theme';

// System preference detection
const getSystemThemePreference = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getSystemMotionPreference = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const getSystemContrastPreference = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
};

export class ThemeManager {
  private currentTheme: ThemeConfig;
  private listeners: Set<(theme: ThemeConfig) => void> = new Set();
  private mediaQueryListeners: (() => void)[] = [];

  constructor(initialConfig?: Partial<ThemeConfig>) {
    this.currentTheme = {
      ...defaultThemeConfig,
      ...this.loadThemeFromStorage(),
      ...initialConfig,
    };

    this.initializeMediaQueryListeners();
    this.applyTheme();
  }

  /**
   * Initialize media query listeners for system preference changes
   */
  private initializeMediaQueryListeners() {
    if (typeof window === 'undefined') return;

    // Dark mode preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = () => {
      if (this.currentTheme.mode === 'system') {
        this.applyTheme();
      }
    };
    darkModeQuery.addEventListener('change', handleDarkModeChange);
    this.mediaQueryListeners.push(() => {
      darkModeQuery.removeEventListener('change', handleDarkModeChange);
    });

    // Reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => {
      this.updateTheme({ reducedMotion: motionQuery.matches });
    };
    motionQuery.addEventListener('change', handleMotionChange);
    this.mediaQueryListeners.push(() => {
      motionQuery.removeEventListener('change', handleMotionChange);
    });

    // High contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const handleContrastChange = () => {
      this.updateTheme({ highContrast: contrastQuery.matches });
    };
    contrastQuery.addEventListener('change', handleContrastChange);
    this.mediaQueryListeners.push(() => {
      contrastQuery.removeEventListener('change', handleContrastChange);
    });
  }

  /**
   * Load theme configuration from localStorage
   */
  private loadThemeFromStorage(): Partial<ThemeConfig> {
    if (typeof window === 'undefined') return {};

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Save theme configuration to localStorage
   */
  private saveThemeToStorage() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(this.currentTheme));
    } catch (error) {
    }
  }

  /**
   * Apply the current theme to the document
   */
  private applyTheme() {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Apply theme mode
    const effectiveMode = this.getEffectiveThemeMode();
    root.setAttribute('data-theme', effectiveMode);

    // Apply density
    root.setAttribute('data-density', this.currentTheme.density);

    // Apply border radius preference
    if (this.currentTheme.borderRadius !== 'md') {
      root.setAttribute('data-border-radius', this.currentTheme.borderRadius);
    } else {
      root.removeAttribute('data-border-radius');
    }

    // Apply custom colors
    if (this.currentTheme.primaryColor) {
      root.style.setProperty('--color-primary-600', this.currentTheme.primaryColor);
      // Generate related primary colors if needed
      this.applyPrimaryColorVariants(this.currentTheme.primaryColor);
    } else {
      // Reset to default primary colors
      root.style.removeProperty('--color-primary-600');
      this.resetPrimaryColorVariants();
    }

    if (this.currentTheme.accentColor) {
      root.style.setProperty('--color-accent', this.currentTheme.accentColor);
    } else {
      root.style.removeProperty('--color-accent');
    }

    // Apply motion preferences
    if (this.currentTheme.reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }

    // Apply contrast preferences
    if (this.currentTheme.highContrast) {
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.removeAttribute('data-high-contrast');
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Get the effective theme mode (resolving 'system' to actual mode)
   */
  private getEffectiveThemeMode(): 'light' | 'dark' | 'high-contrast' {
    if (this.currentTheme.mode === 'high-contrast') {
      return 'high-contrast';
    }

    if (this.currentTheme.mode === 'system') {
      return getSystemThemePreference();
    }

    return this.currentTheme.mode;
  }

  /**
   * Apply primary color variants based on a base color
   */
  private applyPrimaryColorVariants(baseColor: string) {
    if (typeof document === 'undefined') return;

    // This is a simplified approach. In a real implementation,
    // you might want to use a color manipulation library
    // to generate proper color variants.
    const root = document.documentElement;
    root.style.setProperty('--color-primary-500', baseColor);
    
    // You could implement color manipulation here to generate
    // lighter and darker variants of the primary color
  }

  /**
   * Reset primary color variants to defaults
   */
  private resetPrimaryColorVariants() {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const primaryProperties = [
      '--color-primary-50',
      '--color-primary-100',
      '--color-primary-200',
      '--color-primary-300',
      '--color-primary-400',
      '--color-primary-500',
      '--color-primary-600',
      '--color-primary-700',
      '--color-primary-800',
      '--color-primary-900',
      '--color-primary-950',
    ];

    primaryProperties.forEach((prop) => {
      root.style.removeProperty(prop);
    });
  }

  /**
   * Notify all theme change listeners
   */
  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentTheme);
      } catch (error) {
      }
    });
  }

  /**
   * Update theme configuration
   */
  updateTheme(config: Partial<ThemeConfig>) {
    this.currentTheme = { ...this.currentTheme, ...config };
    this.saveThemeToStorage();
    this.applyTheme();
  }

  /**
   * Set a complete theme configuration
   */
  setTheme(config: ThemeConfig) {
    this.currentTheme = { ...config };
    this.saveThemeToStorage();
    this.applyTheme();
  }

  /**
   * Apply a predefined theme preset
   */
  applyPreset(presetName: string) {
    const preset = themePresets.find((p) => p.name === presetName);
    if (preset) {
      this.setTheme(preset.config);
    }
  }

  /**
   * Get current theme configuration
   */
  getTheme(): ThemeConfig {
    return { ...this.currentTheme };
  }

  /**
   * Get the effective theme mode
   */
  getEffectiveMode(): 'light' | 'dark' | 'high-contrast' {
    return this.getEffectiveThemeMode();
  }

  /**
   * Toggle between light and dark mode
   */
  toggleMode() {
    const currentMode = this.getEffectiveThemeMode();
    const newMode = currentMode === 'light' ? 'dark' : 'light';
    this.updateTheme({ mode: newMode });
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(listener: (theme: ThemeConfig) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if dark mode is currently active
   */
  isDarkMode(): boolean {
    return this.getEffectiveThemeMode() === 'dark';
  }

  /**
   * Check if high contrast mode is active
   */
  isHighContrast(): boolean {
    return this.getEffectiveThemeMode() === 'high-contrast' || this.currentTheme.highContrast === true;
  }

  /**
   * Check if reduced motion is active
   */
  isReducedMotion(): boolean {
    return this.currentTheme.reducedMotion === true || getSystemMotionPreference();
  }

  /**
   * Reset theme to defaults
   */
  reset() {
    this.setTheme(defaultThemeConfig);
  }

  /**
   * Clean up listeners when destroying the theme manager
   */
  destroy() {
    this.mediaQueryListeners.forEach((cleanup) => cleanup());
    this.mediaQueryListeners = [];
    this.listeners.clear();
  }
}

// Create a singleton instance
let themeManagerInstance: ThemeManager | null = null;

/**
 * Get the global theme manager instance
 */
export const getThemeManager = (): ThemeManager => {
  if (!themeManagerInstance) {
    themeManagerInstance = new ThemeManager();
  }
  return themeManagerInstance;
};

/**
 * Initialize theme manager with configuration
 */
export const initializeTheme = (config?: Partial<ThemeConfig>): ThemeManager => {
  if (themeManagerInstance) {
    themeManagerInstance.destroy();
  }
  themeManagerInstance = new ThemeManager(config);
  return themeManagerInstance;
};

// React hook for theme management
export const useTheme = () => {
  const [theme, setTheme] = useState(() => getThemeManager().getTheme());

  useEffect(() => {
    const themeManager = getThemeManager();
    const unsubscribe = themeManager.subscribe(setTheme);
    return unsubscribe;
  }, []);

  return {
    theme,
    updateTheme: (config: Partial<ThemeConfig>) => getThemeManager().updateTheme(config),
    applyPreset: (presetName: string) => getThemeManager().applyPreset(presetName),
    toggleMode: () => getThemeManager().toggleMode(),
    isDarkMode: () => getThemeManager().isDarkMode(),
    isHighContrast: () => getThemeManager().isHighContrast(),
    isReducedMotion: () => getThemeManager().isReducedMotion(),
    reset: () => getThemeManager().reset(),
  };
};

// Note: SCSS files cannot be directly imported in TypeScript
// The design tokens are available as CSS custom properties when the SCSS is compiled
