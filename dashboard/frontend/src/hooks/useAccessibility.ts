import { useCallback } from 'react';

export interface AccessibilityOptions {
  politeness?: 'polite' | 'assertive';
  element?: HTMLElement;
}

export const useAccessibility = () => {
  const announceToScreenReader = useCallback((message: string, options: AccessibilityOptions = {}) => {
    const { politeness = 'polite' } = options;
    
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', politeness);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
  }, []);

  const setAriaLabel = useCallback((element: HTMLElement, label: string) => {
    element.setAttribute('aria-label', label);
  }, []);

  const setAriaDescription = useCallback((element: HTMLElement, description: string) => {
    element.setAttribute('aria-describedby', description);
  }, []);

  return {
    announceToScreenReader,
    setAriaLabel,
    setAriaDescription,
  };
};