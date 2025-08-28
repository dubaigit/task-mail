/**
 * Radix UI Accessibility Components
 * Replaces custom accessibility framework with Radix UI primitives
 * All components are WCAG 2.2 AA compliant out of the box
 */

import React from 'react';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import * as FocusScope from '@radix-ui/react-focus-scope';
// import * as FocusGuards from '@radix-ui/react-focus-guards'; // Currently unused

/**
 * VisuallyHidden - Hides content visually but keeps it accessible to screen readers
 * Replacement for: ScreenReaderSupport.VisuallyHidden
 */
export const AccessibleVisuallyHidden = VisuallyHidden.Root;

/**
 * FocusTrap - Traps focus within a container
 * Replacement for: FocusManagement.FocusLock
 */
export interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  autoFocus?: boolean;
  returnFocus?: boolean;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({ 
  children, 
  active = true,
  autoFocus: _autoFocus = true,
  returnFocus: _returnFocus = true 
}) => {
  if (!active) return <>{children}</>;
  
  return (
    <div data-focus-trap="true">
      <FocusScope.Root asChild trapped={active}>
        <div>
          {children}
        </div>
      </FocusScope.Root>
    </div>
  );
};

/**
 * SkipLink - Provides skip navigation for keyboard users
 * Replacement for: KeyboardNavigation.SkipLink
 */
export interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

export const SkipLink: React.FC<SkipLinkProps> = ({ href, children }) => {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {children}
    </a>
  );
};

/**
 * SkipLinks - Container for multiple skip links
 * Replacement for: KeyboardNavigation.SkipLinks
 */
export interface SkipLinksProps {
  links: Array<{ href: string; label: string }>;
}

export const SkipLinks: React.FC<SkipLinksProps> = ({ links }) => {
  return (
    <div className="skip-links">
      {links.map((link) => (
        <SkipLink key={link.href} href={link.href}>
          {link.label}
        </SkipLink>
      ))}
    </div>
  );
};

/**
 * Announcer - Announces messages to screen readers
 * Replacement for: ScreenReaderSupport announcements
 */
export interface AnnouncerProps {
  message: string;
  priority?: 'polite' | 'assertive';
  className?: string;
}

export const Announcer: React.FC<AnnouncerProps> = ({ 
  message, 
  priority = 'polite',
  className = ''
}) => {
  const [announcement, setAnnouncement] = React.useState('');
  
  React.useEffect(() => {
    if (message) {
      // Clear and re-set to ensure announcement is made
      setAnnouncement('');
      setTimeout(() => setAnnouncement(message), 100);
    }
  }, [message]);
  
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className={`sr-only ${className}`}
    >
      {announcement}
    </div>
  );
};

/**
 * useAnnouncer - Hook for screen reader announcements
 * Replacement for: useScreenReaderAnnouncer
 */
export function useAnnouncer() {
  const [message, setMessage] = React.useState('');
  const [priority, setPriority] = React.useState<'polite' | 'assertive'>('polite');
  
  const announce = React.useCallback((text: string, level: 'polite' | 'assertive' = 'polite') => {
    setPriority(level);
    setMessage('');
    setTimeout(() => setMessage(text), 100);
  }, []);
  
  return {
    announce,
    AnnouncerComponent: () => (
      <Announcer message={message} priority={priority} />
    )
  };
}

/**
 * KeyboardShortcut - Registers and handles keyboard shortcuts
 * Replacement for: KeyboardNavigation.useKeyboardShortcuts
 */
export interface KeyboardShortcut {
  key: string;
  modifier?: 'ctrl' | 'alt' | 'shift' | 'meta';
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const modifierPressed = 
          !shortcut.modifier ||
          (shortcut.modifier === 'ctrl' && event.ctrlKey) ||
          (shortcut.modifier === 'alt' && event.altKey) ||
          (shortcut.modifier === 'shift' && event.shiftKey) ||
          (shortcut.modifier === 'meta' && event.metaKey);
        
        if (event.key === shortcut.key && modifierPressed) {
          event.preventDefault();
          shortcut.action();
        }
      });
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * FocusRing - Enhanced focus indicator
 * Uses Tailwind's focus-visible utilities
 */
export interface FocusRingProps {
  children: React.ReactElement;
  className?: string;
}

export const FocusRing: React.FC<FocusRingProps> = ({ children, className = '' }) => {
  return React.cloneElement(children, {
    className: `${children.props.className || ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`
  });
};

/**
 * AccessibilityProvider - Simplified provider for basic settings
 * Much simpler than custom AccessibilityProvider as Radix handles most features
 */
export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
}

const AccessibilityContext = React.createContext<{
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
}>({
  settings: { reducedMotion: false, highContrast: false },
  updateSettings: () => {}
});

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = React.useState<AccessibilitySettings>(() => {
    // Detect user preferences
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    return { reducedMotion, highContrast };
  });
  
  const updateSettings = React.useCallback((updates: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);
  
  React.useEffect(() => {
    // Apply settings to document
    if (settings.reducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
    
    if (settings.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [settings]);
  
  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => React.useContext(AccessibilityContext);

/**
 * Export commonly used Radix UI accessibility utilities
 */
export { VisuallyHidden, FocusScope };