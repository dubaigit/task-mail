import React from 'react';

/**
 * Accessibility Components for WCAG 2.2 AA Compliance
 * 
 * This module provides comprehensive accessibility features including:
 * - Global accessibility context and settings
 * - Keyboard navigation and shortcuts
 * - Screen reader support with ARIA enhancements
 * - High contrast modes and themes
 * - Focus management and trapping
 * - Simplified mode for cognitive accessibility
 * 
 * All components follow WCAG 2.2 AA guidelines and provide:
 * - Minimum 4.5:1 contrast ratios
 * - Full keyboard navigation
 * - Screen reader compatibility
 * - Mobile accessibility support
 * - Cognitive accessibility features
 */

// Core accessibility provider and context
export {
  AccessibilityProvider,
  useAccessibility,
  useScreenReaderAnnouncer,
  useSimplifiedMode,
  useReducedMotion,
  useHighContrast,
  type AccessibilitySettings,
  type AccessibilityContextValue,
  type AccessibilityProviderProps
} from './AccessibilityProvider';

// Keyboard navigation and shortcuts
export {
  KeyboardNavigation,
  GlobalKeyboardShortcuts,
  useKeyboardShortcuts,
  SkipLink,
  SkipLinks,
  type KeyboardNavigationProps,
  type KeyboardShortcut,
  type SkipLinkProps,
  type SkipLinksProps
} from './KeyboardNavigation';

// Screen reader support and ARIA enhancements
export {
  ScreenReaderRegion,
  VisuallyHidden,
  LoadingAnnouncement,
  ErrorAnnouncement,
  AccessibleProgress,
  AccessibleField,
  AccessibleTable,
  AccessibleBreadcrumbs,
  type ScreenReaderRegionProps,
  type VisuallyHiddenProps,
  type LoadingAnnouncementProps,
  type ErrorAnnouncementProps,
  type AccessibleProgressProps,
  type AccessibleFieldProps,
  type AccessibleTableProps,
  type AccessibleBreadcrumbsProps,
  type BreadcrumbItem
} from './ScreenReaderSupport';

// High contrast mode and theming
export {
  HighContrastMode,
  type HighContrastModeProps,
  type HighContrastTheme
} from './HighContrastMode';

// Focus management and trapping
export {
  FocusManager,
  FocusIndicator,
  useFocusRestore,
  FocusableList,
  SkipToMain,
  useRovingTabindex,
  FocusLock,
  type FocusManagerProps,
  type FocusIndicatorProps,
  type FocusableListProps,
  type SkipToMainProps,
  type FocusLockProps
} from './FocusManagement';

// Simplified mode for cognitive accessibility
export {
  SimplifiedMode,
  SimplifiedLayout,
  ContextualHelp,
  ErrorFriendlyMessage,
  InformationHierarchy,
  type SimplifiedModeProps,
  type SimplifiedLayoutProps,
  type ContextualHelpProps,
  type ErrorFriendlyMessageProps,
  type InformationHierarchyProps
} from './SimplifiedMode';

// Import components for local use
import { KeyboardNavigation, SkipLink, GlobalKeyboardShortcuts } from './KeyboardNavigation';
import { FocusManager } from './FocusManagement';
import { useAccessibility } from './AccessibilityProvider';

// Import utility functions for local use
import {
  createSkipLinks,
  detectA11yPreferences,
  screenReaderAnnouncer,
  validateWCAGCompliance,
  getFocusableElements
} from '../../utils/a11y/a11y-utils';

// Utility functions and helpers
export {
  calculateContrastRatio,
  getFocusableElements,
  isElementVisible,
  hasAriaLabel,
  FocusTrap,
  ScreenReaderAnnouncer,
  KeyboardNavigationManager,
  createSkipLinks,
  validateWCAGCompliance,
  detectA11yPreferences,
  screenReaderAnnouncer,
  type ColorContrastResult,
  type FocusableElement,
  type A11yAnnouncement
} from '../../utils/a11y/a11y-utils';

/**
 * Helper function to setup accessibility features for an application
 * 
 * @param options Configuration options for accessibility setup
 * @returns Cleanup function to remove accessibility features
 */
export function setupAccessibility(options: {
  enableHighContrast?: boolean;
  enableSimplifiedMode?: boolean;
  enableKeyboardShortcuts?: boolean;
  skipLinks?: Array<{ id: string; label: string }>;
} = {}) {
  const {
    enableHighContrast = true,
    enableSimplifiedMode = true,
    enableKeyboardShortcuts = true,
    skipLinks = [
      { id: 'main-content', label: 'Skip to main content' },
      { id: 'main-navigation', label: 'Skip to navigation' }
    ]
  } = options;

  // Add skip links to the page
  if (skipLinks.length > 0) {
    const skipLinksContainer = createSkipLinks(skipLinks);
    document.body.insertBefore(skipLinksContainer, document.body.firstChild);
  }

  // Add global keyboard shortcuts
  let shortcutsManager: GlobalKeyboardShortcuts | null = null;
  if (enableKeyboardShortcuts) {
    shortcutsManager = new GlobalKeyboardShortcuts();
    
    // Add common accessibility shortcuts
    shortcutsManager.addShortcut({
      key: 'h',
      altKey: true,
      action: () => {
        const helpEvent = new CustomEvent('show-accessibility-help');
        document.dispatchEvent(helpEvent);
      },
      description: 'Show accessibility help',
      category: 'accessibility'
    });

    shortcutsManager.addShortcut({
      key: 'c',
      altKey: true,
      action: () => {
        const contrastEvent = new CustomEvent('toggle-high-contrast');
        document.dispatchEvent(contrastEvent);
      },
      description: 'Toggle high contrast mode',
      category: 'accessibility'
    });

    shortcutsManager.addShortcut({
      key: 's',
      altKey: true,
      action: () => {
        const simplifiedEvent = new CustomEvent('toggle-simplified-mode');
        document.dispatchEvent(simplifiedEvent);
      },
      description: 'Toggle simplified mode',
      category: 'accessibility'
    });
  }

  // Return cleanup function
  return () => {
    if (shortcutsManager) {
      shortcutsManager.cleanup();
    }
    
    // Remove skip links
    const skipLinksContainer = document.querySelector('.skip-links');
    if (skipLinksContainer) {
      skipLinksContainer.remove();
    }
  };
}

/**
 * Higher-order component to add accessibility features to any component
 */
export function withAccessibility<P extends object>(
  Component: React.ComponentType<P>,
  accessibilityOptions: {
    enableFocusManagement?: boolean;
    enableKeyboardNavigation?: boolean;
    announceOnMount?: string;
    skipLink?: { id: string; label: string };
  } = {}
) {
  const {
    enableFocusManagement = false,
    enableKeyboardNavigation = false,
    announceOnMount,
    skipLink
  } = accessibilityOptions;

  return function AccessibleComponent(props: P) {
    const { announce } = useAccessibility();

    React.useEffect(() => {
      if (announceOnMount) {
        announce({
          message: announceOnMount,
          priority: 'polite'
        });
      }
    }, [announce]);

    let WrappedComponent = <Component {...props} />;

    if (enableKeyboardNavigation) {
      WrappedComponent = (
        <KeyboardNavigation>
          {WrappedComponent}
        </KeyboardNavigation>
      );
    }

    if (enableFocusManagement) {
      WrappedComponent = (
        <FocusManager>
          {WrappedComponent}
        </FocusManager>
      );
    }

    if (skipLink) {
      WrappedComponent = (
        <>
          <SkipLink targetId={skipLink.id}>
            {skipLink.label}
          </SkipLink>
          {WrappedComponent}
        </>
      );
    }

    return WrappedComponent;
  };
}

/**
 * Custom hook for accessibility testing and validation
 */
export function useAccessibilityValidation() {
  const [validationResults, setValidationResults] = React.useState<Array<{
    element: HTMLElement;
    issues: string[];
    score: number;
    isCompliant: boolean;
  }>>([]);

  const validatePage = React.useCallback(() => {
    const results: typeof validationResults = [];
    const interactiveElements = document.querySelectorAll(
      'button, a, input, textarea, select, [role="button"], [role="link"], [tabindex]'
    );

    interactiveElements.forEach(element => {
      const validation = validateWCAGCompliance(element as HTMLElement);
      results.push({
        element: element as HTMLElement,
        ...validation
      });
    });

    setValidationResults(results);
    return results;
  }, []);

  const getValidationSummary = React.useCallback(() => {
    const totalElements = validationResults.length;
    const compliantElements = validationResults.filter(r => r.isCompliant).length;
    const averageScore = totalElements > 0 
      ? validationResults.reduce((sum, r) => sum + r.score, 0) / totalElements 
      : 0;

    return {
      totalElements,
      compliantElements,
      complianceRate: totalElements > 0 ? (compliantElements / totalElements) * 100 : 0,
      averageScore,
      issues: validationResults.flatMap(r => r.issues)
    };
  }, [validationResults]);

  return {
    validationResults,
    validatePage,
    getValidationSummary
  };
}