import React, { useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { FocusTrap, getFocusableElements } from '../../utils/a11y/a11y-utils';
import { useAccessibility } from './AccessibilityProvider';

export interface FocusManagerProps {
  children: ReactNode;
  enabled?: boolean;
  restoreOnUnmount?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Focus management container with focus trapping capabilities
 */
export function FocusManager({
  children,
  enabled = true,
  restoreOnUnmount = true,
  autoFocus = false,
  className = ''
}: FocusManagerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useRef<FocusTrap | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { settings, announce } = useAccessibility();

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Create focus trap
    focusTrapRef.current = new FocusTrap(containerRef.current);
    focusTrapRef.current.activate();

    if (autoFocus) {
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        focusableElements[0].element.focus();
        announce({
          message: `Focus trapped. ${focusableElements.length} focusable elements available. Use Tab to navigate, Escape to exit.`,
          priority: 'polite'
        });
      }
    }

    return () => {
      if (focusTrapRef.current) {
        focusTrapRef.current.deactivate();
      }
      
      if (restoreOnUnmount && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [enabled, autoFocus, restoreOnUnmount, announce]);

  return (
    <div
      ref={containerRef}
      className={`focus-manager ${className}`}
      data-focus-trap={enabled}
    >
      {children}
    </div>
  );
}

/**
 * Enhanced focus indicators with customizable styles
 */
export interface FocusIndicatorProps {
  children: ReactNode;
  variant?: 'default' | 'enhanced' | 'custom';
  color?: string;
  width?: number;
  offset?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  className?: string;
}

interface FocusStyle {
  outline: string;
  outlineOffset: string;
  boxShadow?: string;
  position?: 'relative';
}

export function FocusIndicator({
  children,
  variant = 'default',
  color = '#0066cc',
  width = 2,
  offset = 2,
  style = 'solid',
  className = ''
}: FocusIndicatorProps) {
  const { settings, isKeyboardUser } = useAccessibility();
  
  const focusStyles: Record<string, FocusStyle> = {
    default: {
      outline: `${width}px ${style} ${color}`,
      outlineOffset: `${offset}px`
    },
    enhanced: {
      outline: `${width + 1}px ${style} ${color}`,
      outlineOffset: `${offset + 1}px`,
      boxShadow: `0 0 0 ${width + 3}px rgba(0, 102, 204, 0.2)`
    },
    custom: {
      outline: `${width}px ${style} ${color}`,
      outlineOffset: `${offset}px`,
      position: 'relative'
    }
  };

  useEffect(() => {
    const styleId = 'focus-indicator-styles';
    let existingStyles = document.getElementById(styleId);
    
    if (!existingStyles) {
      existingStyles = document.createElement('style');
      existingStyles.id = styleId;
      document.head.appendChild(existingStyles);
    }

    const enhancedFocusClass = settings.focusIndicatorsEnhanced ? 'enhanced' : variant;
    
    existingStyles.textContent = `
      .focus-indicator:focus-visible,
      .focus-indicator *:focus-visible {
        outline: ${focusStyles[enhancedFocusClass].outline} !important;
        outline-offset: ${focusStyles[enhancedFocusClass].outlineOffset} !important;
        ${focusStyles[enhancedFocusClass].boxShadow ? `box-shadow: ${focusStyles[enhancedFocusClass].boxShadow} !important;` : ''}
      }

      .focus-indicator.keyboard-user:focus,
      .focus-indicator.keyboard-user *:focus {
        outline: ${focusStyles[enhancedFocusClass].outline} !important;
        outline-offset: ${focusStyles[enhancedFocusClass].outlineOffset} !important;
      }

      /* High contrast mode focus */
      @media (forced-colors: active) {
        .focus-indicator:focus-visible,
        .focus-indicator *:focus-visible {
          outline: 2px solid ButtonText !important;
          outline-offset: 2px !important;
        }
      }

      /* Reduced motion preferences */
      @media (prefers-reduced-motion: reduce) {
        .focus-indicator:focus-visible,
        .focus-indicator *:focus-visible {
          transition: none !important;
        }
      }
    `;

    return () => {
      if (existingStyles && existingStyles.parentNode) {
        existingStyles.parentNode.removeChild(existingStyles);
      }
    };
  }, [variant, color, width, offset, style, settings.focusIndicatorsEnhanced]);

  return (
    <div 
      className={`focus-indicator ${isKeyboardUser ? 'keyboard-user' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Focus restoration hook for managing focus after modal/dialog closes
 */
export function useFocusRestore() {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const captureFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
      // Add a small delay to ensure DOM is ready
      setTimeout(() => {
        previousFocusRef.current?.focus();
      }, 0);
    }
  }, []);

  return { captureFocus, restoreFocus };
}

/**
 * Focus management for lists with arrow key navigation
 */
export interface FocusableListProps {
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  loop?: boolean;
  onFocusChange?: (index: number, element: HTMLElement) => void;
  className?: string;
}

export function FocusableList({
  children,
  orientation = 'vertical',
  loop = true,
  onFocusChange,
  className = ''
}: FocusableListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const { announce } = useAccessibility();

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!listRef.current) return;

    const focusableElements = getFocusableElements(listRef.current);
    if (focusableElements.length === 0) return;

    const { key } = event;
    const isVertical = orientation === 'vertical';
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

    if (key === nextKey || key === prevKey) {
      event.preventDefault();
      
      let newIndex = currentIndex;
      
      if (key === nextKey) {
        newIndex = currentIndex + 1;
        if (newIndex >= focusableElements.length) {
          newIndex = loop ? 0 : focusableElements.length - 1;
        }
      } else if (key === prevKey) {
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
          newIndex = loop ? focusableElements.length - 1 : 0;
        }
      }

      if (newIndex !== currentIndex && focusableElements[newIndex]) {
        setCurrentIndex(newIndex);
        focusableElements[newIndex].element.focus();
        onFocusChange?.(newIndex, focusableElements[newIndex].element);
        
        announce({
          message: `Item ${newIndex + 1} of ${focusableElements.length}`,
          priority: 'polite'
        });
      }
    } else if (key === 'Home') {
      event.preventDefault();
      if (focusableElements[0]) {
        setCurrentIndex(0);
        focusableElements[0].element.focus();
        onFocusChange?.(0, focusableElements[0].element);
      }
    } else if (key === 'End') {
      event.preventDefault();
      const lastIndex = focusableElements.length - 1;
      if (focusableElements[lastIndex]) {
        setCurrentIndex(lastIndex);
        focusableElements[lastIndex].element.focus();
        onFocusChange?.(lastIndex, focusableElements[lastIndex].element);
      }
    }
  }, [currentIndex, orientation, loop, onFocusChange, announce]);

  const handleFocus = useCallback((event: React.FocusEvent) => {
    if (!listRef.current) return;
    
    const focusableElements = getFocusableElements(listRef.current);
    const focusedElement = event.target as HTMLElement;
    const newIndex = focusableElements.findIndex(item => item.element === focusedElement);
    
    if (newIndex !== -1) {
      setCurrentIndex(newIndex);
    }
  }, []);

  return (
    <div
      ref={listRef}
      className={`focusable-list ${className}`}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      role="group"
      aria-label={`${orientation} list`}
    >
      {children}
    </div>
  );
}

/**
 * Skip to main content link
 */
export interface SkipToMainProps {
  targetId: string;
  label?: string;
  className?: string;
}

export function SkipToMain({ 
  targetId, 
  label = 'Skip to main content',
  className = ''
}: SkipToMainProps) {
  const { announce } = useAccessibility();

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    
    if (target) {
      // Make target focusable if it isn't already
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      announce({
        message: 'Skipped to main content',
        priority: 'polite'
      });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      className={`skip-to-main ${className}`}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: '-40px',
        left: '6px',
        zIndex: 9999,
        background: '#000',
        color: '#fff',
        padding: '8px 12px',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: '600',
        borderRadius: '4px',
        transform: 'translateY(-100%)',
        transition: 'transform 0.3s ease'
      }}
      onFocus={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.transform = 'translateY(-100%)';
      }}
    >
      {label}
    </a>
  );
}

/**
 * Roving tabindex manager for complex widgets
 */
export function useRovingTabindex(containerRef: React.RefObject<HTMLElement>) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const focusableElements = getFocusableElements(containerRef.current);
    
    focusableElements.forEach((item, index) => {
      if (index === activeIndex) {
        item.element.setAttribute('tabindex', '0');
      } else {
        item.element.setAttribute('tabindex', '-1');
      }
    });
  }, [activeIndex, containerRef]);

  const setActiveItem = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const focusItem = useCallback((index: number) => {
    if (!containerRef.current) return;
    
    const focusableElements = getFocusableElements(containerRef.current);
    if (focusableElements[index]) {
      setActiveIndex(index);
      focusableElements[index].element.focus();
    }
  }, [containerRef]);

  return { activeIndex, setActiveItem, focusItem };
}

/**
 * Focus lock component for modals and overlays
 */
export interface FocusLockProps {
  children: ReactNode;
  disabled?: boolean;
  returnFocus?: boolean;
  autoFocus?: boolean;
}

export function FocusLock({
  children,
  disabled = false,
  returnFocus = true,
  autoFocus = true
}: FocusLockProps) {
  const { captureFocus, restoreFocus } = useFocusRestore();

  useEffect(() => {
    if (!disabled) {
      captureFocus();
    }

    return () => {
      if (!disabled && returnFocus) {
        restoreFocus();
      }
    };
  }, [disabled, returnFocus, captureFocus, restoreFocus]);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <FocusManager
      enabled={!disabled}
      restoreOnUnmount={returnFocus}
      autoFocus={autoFocus}
    >
      {children}
    </FocusManager>
  );
}