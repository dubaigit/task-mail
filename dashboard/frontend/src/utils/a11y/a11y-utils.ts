/**
 * Accessibility utility functions for WCAG 2.2 AA compliance
 * Provides utilities for contrast checking, focus management, and screen reader support
 */

export interface ColorContrastResult {
  ratio: number;
  isAACompliant: boolean;
  isAAACompliant: boolean;
  score: 'fail' | 'aa' | 'aaa';
}

export interface FocusableElement {
  element: HTMLElement;
  tabindex: number;
  isVisible: boolean;
  hasAriaLabel: boolean;
}

export interface A11yAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  delay?: number;
}

/**
 * Calculate color contrast ratio between foreground and background colors
 */
export function calculateContrastRatio(foreground: string, background: string): ColorContrastResult {
  const getLuminance = (color: string): number => {
    // Convert hex/rgb/hsl to RGB values
    const rgb = parseColor(color);
    if (!rgb) return 0;

    // Calculate relative luminance
    const sRGB = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    isAACompliant: ratio >= 4.5,
    isAAACompliant: ratio >= 7,
    score: ratio >= 7 ? 'aaa' : ratio >= 4.5 ? 'aa' : 'fail'
  };
}

/**
 * Parse color string to RGB values
 */
function parseColor(color: string): [number, number, number] | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    } else if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }

  // Handle CSS color names (basic support)
  const colorMap: Record<string, [number, number, number]> = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    gray: [128, 128, 128],
    grey: [128, 128, 128]
  };

  return colorMap[color.toLowerCase()] || null;
}

/**
 * Get all focusable elements in a container
 */
export function getFocusableElements(container: HTMLElement = document.body): FocusableElement[] {
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  const elements = Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];

  return elements.map(element => ({
    element,
    tabindex: parseInt(element.getAttribute('tabindex') || '0'),
    isVisible: isElementVisible(element),
    hasAriaLabel: hasAriaLabel(element)
  })).filter(item => item.isVisible);
}

/**
 * Check if element is visible to users
 */
export function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  );
}

/**
 * Check if element has proper aria labeling
 */
export function hasAriaLabel(element: HTMLElement): boolean {
  return !!(
    element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') ||
    element.getAttribute('aria-describedby') ||
    element.getAttribute('title') ||
    element.textContent?.trim()
  );
}

/**
 * Create and manage focus trap for modal dialogs
 */
export class FocusTrap {
  private container: HTMLElement;
  private firstFocusableElement: HTMLElement | null = null;
  private lastFocusableElement: HTMLElement | null = null;
  private previousActiveElement: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.updateFocusableElements();
    this.previousActiveElement = document.activeElement as HTMLElement;
  }

  activate(): void {
    this.updateFocusableElements();
    if (this.firstFocusableElement) {
      this.firstFocusableElement.focus();
    }
    document.addEventListener('keydown', this.handleKeyDown);
  }

  deactivate(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.previousActiveElement) {
      this.previousActiveElement.focus();
    }
  }

  private updateFocusableElements(): void {
    const focusableElements = getFocusableElements(this.container);
    this.firstFocusableElement = focusableElements[0]?.element || null;
    this.lastFocusableElement = focusableElements[focusableElements.length - 1]?.element || null;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      if (event.shiftKey) {
        if (document.activeElement === this.firstFocusableElement) {
          event.preventDefault();
          this.lastFocusableElement?.focus();
        }
      } else {
        if (document.activeElement === this.lastFocusableElement) {
          event.preventDefault();
          this.firstFocusableElement?.focus();
        }
      }
    }

    if (event.key === 'Escape') {
      this.deactivate();
    }
  };
}

/**
 * Live region announcer for screen readers
 */
export class ScreenReaderAnnouncer {
  private politeRegion: HTMLElement;
  private assertiveRegion: HTMLElement;

  constructor() {
    this.politeRegion = this.createLiveRegion('polite');
    this.assertiveRegion = this.createLiveRegion('assertive');
  }

  private createLiveRegion(priority: 'polite' | 'assertive'): HTMLElement {
    const existing = document.getElementById(`a11y-live-${priority}`);
    if (existing) return existing;

    const region = document.createElement('div');
    region.id = `a11y-live-${priority}`;
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';

    document.body.appendChild(region);
    return region;
  }

  announce(announcement: A11yAnnouncement): void {
    const { message, priority, delay = 100 } = announcement;
    const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion;

    // Clear previous announcement
    region.textContent = '';

    // Announce new message with slight delay to ensure screen reader picks it up
    setTimeout(() => {
      region.textContent = message;
    }, delay);
  }

  cleanup(): void {
    this.politeRegion.remove();
    this.assertiveRegion.remove();
  }
}

/**
 * Keyboard navigation helper
 */
export class KeyboardNavigationManager {
  private keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map();

  constructor(private container: HTMLElement) {
    this.container.addEventListener('keydown', this.handleKeyDown);
  }

  addKeyHandler(key: string, handler: (event: KeyboardEvent) => void): void {
    this.keyHandlers.set(key.toLowerCase(), handler);
  }

  removeKeyHandler(key: string): void {
    this.keyHandlers.delete(key.toLowerCase());
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const handler = this.keyHandlers.get(key);
    
    if (handler) {
      handler(event);
    }

    // Handle arrow key navigation for lists
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.handleArrowNavigation(event);
    }
  };

  private handleArrowNavigation(event: KeyboardEvent): void {
    const currentElement = document.activeElement as HTMLElement;
    if (!currentElement || !this.container.contains(currentElement)) return;

    const focusableElements = getFocusableElements(this.container);
    const currentIndex = focusableElements.findIndex(item => item.element === currentElement);
    
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowUp':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowDown':
        nextIndex = Math.min(focusableElements.length - 1, currentIndex + 1);
        break;
      case 'ArrowLeft':
        // Horizontal navigation for certain layouts
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        // Horizontal navigation for certain layouts
        nextIndex = Math.min(focusableElements.length - 1, currentIndex + 1);
        break;
    }

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      focusableElements[nextIndex].element.focus();
    }
  }

  cleanup(): void {
    this.container.removeEventListener('keydown', this.handleKeyDown);
    this.keyHandlers.clear();
  }
}

/**
 * Skip link manager for navigation
 */
export function createSkipLinks(targets: Array<{ id: string; label: string }>): HTMLElement {
  const skipLinksContainer = document.createElement('div');
  skipLinksContainer.className = 'skip-links';
  skipLinksContainer.style.position = 'absolute';
  skipLinksContainer.style.top = '-40px';
  skipLinksContainer.style.left = '6px';
  skipLinksContainer.style.zIndex = '9999';

  targets.forEach(target => {
    const link = document.createElement('a');
    link.href = `#${target.id}`;
    link.textContent = target.label;
    link.className = 'skip-link';
    link.style.background = '#000';
    link.style.color = '#fff';
    link.style.padding = '8px';
    link.style.textDecoration = 'none';
    link.style.display = 'block';
    link.style.transform = 'translateY(-100%)';
    link.style.transition = 'transform 0.3s';

    link.addEventListener('focus', () => {
      link.style.transform = 'translateY(0)';
    });

    link.addEventListener('blur', () => {
      link.style.transform = 'translateY(-100%)';
    });

    skipLinksContainer.appendChild(link);
  });

  return skipLinksContainer;
}

/**
 * Validate WCAG 2.2 compliance for an element
 */
export function validateWCAGCompliance(element: HTMLElement): {
  issues: string[];
  score: number;
  isCompliant: boolean;
} {
  const issues: string[] = [];

  // Check for proper semantic markup
  if (!element.tagName.match(/^(BUTTON|A|INPUT|TEXTAREA|SELECT|H[1-6]|MAIN|NAV|SECTION|ARTICLE|ASIDE|HEADER|FOOTER)$/)) {
    if (!element.getAttribute('role')) {
      issues.push('Element lacks semantic meaning and ARIA role');
    }
  }

  // Check for accessibility labels
  if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
    if (!hasAriaLabel(element)) {
      issues.push('Interactive element lacks accessible label');
    }
  }

  // Check for focus indicators
  const style = window.getComputedStyle(element);
  if (element.matches(':focus-visible')) {
    if (style.outline === 'none' && style.boxShadow === 'none') {
      issues.push('Element lacks visible focus indicator');
    }
  }

  // Check for minimum touch target size on mobile
  const rect = element.getBoundingClientRect();
  if (rect.width < 44 || rect.height < 44) {
    if (element.matches('button, a, input, select, textarea')) {
      issues.push('Touch target smaller than 44px minimum');
    }
  }

  const score = Math.max(0, 100 - (issues.length * 20));
  return {
    issues,
    score,
    isCompliant: issues.length === 0
  };
}

/**
 * Detect user preferences for accessibility
 */
export function detectA11yPreferences(): {
  reducedMotion: boolean;
  highContrast: boolean;
  invertedColors: boolean;
  forcedColors: boolean;
} {
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    invertedColors: window.matchMedia('(inverted-colors: inverted)').matches,
    forcedColors: window.matchMedia('(forced-colors: active)').matches
  };
}

/**
 * Global instance of screen reader announcer
 */
export const screenReaderAnnouncer = new ScreenReaderAnnouncer();