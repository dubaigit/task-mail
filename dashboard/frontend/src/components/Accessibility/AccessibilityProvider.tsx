import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { detectA11yPreferences, screenReaderAnnouncer, type A11yAnnouncement } from '../../utils/a11y/a11y-utils';

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  simplifiedMode: boolean;
  keyboardNavigationEnabled: boolean;
  screenReaderOptimized: boolean;
  fontScale: number;
  focusIndicatorsEnhanced: boolean;
}

export interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
  announce: (announcement: A11yAnnouncement) => void;
  isKeyboardUser: boolean;
  userPreferences: {
    reducedMotion: boolean;
    highContrast: boolean;
    invertedColors: boolean;
    forcedColors: boolean;
  };
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export interface AccessibilityProviderProps {
  children: ReactNode;
  initialSettings?: Partial<AccessibilitySettings>;
}

const defaultSettings: AccessibilitySettings = {
  reducedMotion: false,
  highContrast: false,
  simplifiedMode: false,
  keyboardNavigationEnabled: true,
  screenReaderOptimized: false,
  fontScale: 1,
  focusIndicatorsEnhanced: false
};

export function AccessibilityProvider({ children, initialSettings = {} }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load settings from localStorage if available
    const saved = localStorage.getItem('accessibility-settings');
    const savedSettings = saved ? JSON.parse(saved) : {};
    
    // Detect user preferences
    const userPrefs = detectA11yPreferences();
    
    return {
      ...defaultSettings,
      reducedMotion: userPrefs.reducedMotion,
      highContrast: userPrefs.highContrast,
      ...savedSettings,
      ...initialSettings
    };
  });

  const [isKeyboardUser, setIsKeyboardUser] = useState(false);
  const [userPreferences, setUserPreferences] = useState(() => detectA11yPreferences());

  // Detect keyboard usage
  useEffect(() => {
    let keyboardUsed = false;
    let mouseUsed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        keyboardUsed = true;
        if (!mouseUsed) {
          setIsKeyboardUser(true);
        }
      }
    };

    const handleMouseDown = () => {
      mouseUsed = true;
      if (keyboardUsed) {
        setIsKeyboardUser(false);
      }
    };

    const handleFocusVisible = () => {
      setIsKeyboardUser(true);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('focusin', handleFocusVisible);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('focusin', handleFocusVisible);
    };
  }, []);

  // Listen for preference changes
  useEffect(() => {
    const mediaQueries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(inverted-colors: inverted)'),
      window.matchMedia('(forced-colors: active)')
    ];

    const updatePreferences = () => {
      const newPrefs = detectA11yPreferences();
      setUserPreferences(newPrefs);
      
      // Auto-update settings based on system preferences
      setSettings(current => ({
        ...current,
        reducedMotion: newPrefs.reducedMotion,
        highContrast: newPrefs.highContrast
      }));
    };

    mediaQueries.forEach(mq => mq.addEventListener('change', updatePreferences));

    return () => {
      mediaQueries.forEach(mq => mq.removeEventListener('change', updatePreferences));
    };
  }, []);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply CSS custom properties for accessibility settings
    root.style.setProperty('--a11y-reduced-motion', settings.reducedMotion ? '1' : '0');
    root.style.setProperty('--a11y-high-contrast', settings.highContrast ? '1' : '0');
    root.style.setProperty('--a11y-font-scale', settings.fontScale.toString());

    // Apply classes for different modes
    root.classList.toggle('a11y-reduced-motion', settings.reducedMotion);
    root.classList.toggle('a11y-high-contrast', settings.highContrast);
    root.classList.toggle('a11y-simplified-mode', settings.simplifiedMode);
    root.classList.toggle('a11y-enhanced-focus', settings.focusIndicatorsEnhanced);
    root.classList.toggle('a11y-keyboard-user', isKeyboardUser);

    // Save settings to localStorage
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings, isKeyboardUser]);

  // Add global CSS for accessibility features
  useEffect(() => {
    const styleId = 'accessibility-global-styles';
    let existingStyles = document.getElementById(styleId);
    
    if (!existingStyles) {
      existingStyles = document.createElement('style');
      existingStyles.id = styleId;
      document.head.appendChild(existingStyles);
    }

    existingStyles.textContent = `
      /* Reduced motion preferences */
      .a11y-reduced-motion *,
      .a11y-reduced-motion *::before,
      .a11y-reduced-motion *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }

      /* High contrast mode */
      .a11y-high-contrast {
        --primary: #000000;
        --primary-foreground: #ffffff;
        --secondary: #ffffff;
        --secondary-foreground: #000000;
        --border: #000000;
        --background: #ffffff;
        --foreground: #000000;
      }

      .a11y-high-contrast .dark {
        --primary: #ffffff;
        --primary-foreground: #000000;
        --secondary: #000000;
        --secondary-foreground: #ffffff;
        --border: #ffffff;
        --background: #000000;
        --foreground: #ffffff;
      }

      /* Enhanced focus indicators */
      .a11y-enhanced-focus *:focus-visible {
        outline: 3px solid var(--focus-color, #0066cc) !important;
        outline-offset: 2px !important;
      }

      /* Keyboard navigation indicators */
      .a11y-keyboard-user *:focus {
        outline: 2px solid var(--focus-color, #0066cc);
        outline-offset: 1px;
      }

      /* Font scaling */
      html {
        font-size: calc(1rem * var(--a11y-font-scale, 1));
      }

      /* Simplified mode */
      .a11y-simplified-mode {
        --border-radius: 0;
        --shadow: none;
      }

      .a11y-simplified-mode * {
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      .a11y-simplified-mode .complex-animation,
      .a11y-simplified-mode .decorative-element {
        display: none !important;
      }

      /* Screen reader only content */
      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      /* Touch target minimum sizes */
      @media (pointer: coarse) {
        button, a, input, select, textarea, [role="button"], [role="link"] {
          min-height: 44px;
          min-width: 44px;
        }
      }

      /* High contrast support for forced colors */
      @media (forced-colors: active) {
        .custom-focus-indicator {
          forced-color-adjust: none;
          outline: 2px solid ButtonText;
        }
      }

      /* Dark mode accessibility improvements */
      @media (prefers-color-scheme: dark) {
        :root {
          color-scheme: dark;
        }
      }
    `;

    return () => {
      if (existingStyles && existingStyles.parentNode) {
        existingStyles.parentNode.removeChild(existingStyles);
      }
    };
  }, []);

  const updateSettings = (updates: Partial<AccessibilitySettings>) => {
    setSettings(current => ({ ...current, ...updates }));
  };

  const announce = (announcement: A11yAnnouncement) => {
    screenReaderAnnouncer.announce(announcement);
  };

  const contextValue: AccessibilityContextValue = {
    settings,
    updateSettings,
    announce,
    isKeyboardUser,
    userPreferences
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

// Hook for announcing to screen readers
export function useScreenReaderAnnouncer() {
  const { announce } = useAccessibility();
  return announce;
}

// Hook for simplified conditional rendering
export function useSimplifiedMode() {
  const { settings } = useAccessibility();
  return settings.simplifiedMode;
}

// Hook for motion preferences
export function useReducedMotion() {
  const { settings, userPreferences } = useAccessibility();
  return settings.reducedMotion || userPreferences.reducedMotion;
}

// Hook for high contrast mode
export function useHighContrast() {
  const { settings, userPreferences } = useAccessibility();
  return settings.highContrast || userPreferences.highContrast;
}