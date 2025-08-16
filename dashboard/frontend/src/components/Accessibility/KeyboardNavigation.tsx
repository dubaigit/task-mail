import React, { useEffect, useRef, ReactNode, KeyboardEvent } from 'react';
import { KeyboardNavigationManager, getFocusableElements } from '../../utils/a11y/a11y-utils';
import { useAccessibility } from './AccessibilityProvider';

export interface KeyboardNavigationProps {
  children: ReactNode;
  className?: string;
  onEscape?: () => void;
  onEnter?: (element: HTMLElement) => void;
  enableArrowNavigation?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'grid';
  wrap?: boolean;
  autoFocus?: boolean;
  gridColumns?: number;
}

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category?: string;
}

/**
 * Keyboard navigation container with arrow key support and focus management
 */
export function KeyboardNavigation({
  children,
  className = '',
  onEscape,
  onEnter,
  enableArrowNavigation = true,
  orientation = 'vertical',
  wrap = true,
  autoFocus = false,
  gridColumns = 3
}: KeyboardNavigationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigationManagerRef = useRef<KeyboardNavigationManager | null>(null);
  const { settings, announce } = useAccessibility();

  useEffect(() => {
    if (!containerRef.current || !settings.keyboardNavigationEnabled) return;

    const manager = new KeyboardNavigationManager(containerRef.current);
    navigationManagerRef.current = manager;

    // Add escape handler
    if (onEscape) {
      manager.addKeyHandler('escape', onEscape);
    }

    // Add enter handler
    if (onEnter) {
      manager.addKeyHandler('enter', (event) => {
        const target = event.target as HTMLElement;
        onEnter(target);
      });
    }

    // Auto focus first element if enabled
    if (autoFocus) {
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        focusableElements[0].element.focus();
        announce({
          message: `Navigation area focused. Use arrow keys to navigate ${focusableElements.length} items.`,
          priority: 'polite'
        });
      }
    }

    return () => {
      manager.cleanup();
    };
  }, [settings.keyboardNavigationEnabled, onEscape, onEnter, autoFocus, announce]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enableArrowNavigation || !containerRef.current) return;

    const { key, currentTarget } = event;
    const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
    
    if (!isArrowKey) return;

    event.preventDefault();

    const focusableElements = getFocusableElements(containerRef.current);
    const currentElement = document.activeElement as HTMLElement;
    const currentIndex = focusableElements.findIndex(item => item.element === currentElement);

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    if (orientation === 'grid') {
      const row = Math.floor(currentIndex / gridColumns);
      const col = currentIndex % gridColumns;
      const totalRows = Math.ceil(focusableElements.length / gridColumns);

      switch (key) {
        case 'ArrowUp':
          if (row > 0) {
            nextIndex = Math.max(0, currentIndex - gridColumns);
          } else if (wrap) {
            nextIndex = Math.min(focusableElements.length - 1, (totalRows - 1) * gridColumns + col);
          }
          break;
        case 'ArrowDown':
          if (row < totalRows - 1) {
            nextIndex = Math.min(focusableElements.length - 1, currentIndex + gridColumns);
          } else if (wrap) {
            nextIndex = col;
          }
          break;
        case 'ArrowLeft':
          if (col > 0) {
            nextIndex = currentIndex - 1;
          } else if (wrap) {
            nextIndex = Math.min(focusableElements.length - 1, row * gridColumns + gridColumns - 1);
          }
          break;
        case 'ArrowRight':
          if (col < gridColumns - 1 && currentIndex < focusableElements.length - 1) {
            nextIndex = currentIndex + 1;
          } else if (wrap) {
            nextIndex = row * gridColumns;
          }
          break;
      }
    } else {
      // Linear navigation (vertical or horizontal)
      const isForward = (orientation === 'vertical' && key === 'ArrowDown') ||
                       (orientation === 'horizontal' && key === 'ArrowRight');
      const isBackward = (orientation === 'vertical' && key === 'ArrowUp') ||
                        (orientation === 'horizontal' && key === 'ArrowLeft');

      if (isForward) {
        nextIndex = currentIndex + 1;
        if (nextIndex >= focusableElements.length) {
          nextIndex = wrap ? 0 : focusableElements.length - 1;
        }
      } else if (isBackward) {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = wrap ? focusableElements.length - 1 : 0;
        }
      }
    }

    if (nextIndex !== currentIndex && focusableElements[nextIndex]) {
      focusableElements[nextIndex].element.focus();
      
      // Announce position for screen readers
      announce({
        message: `Item ${nextIndex + 1} of ${focusableElements.length}`,
        priority: 'polite'
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`keyboard-navigation ${className}`}
      onKeyDown={handleKeyDown}
      role={orientation === 'grid' ? 'grid' : 'group'}
      aria-label="Keyboard navigable area"
      data-orientation={orientation}
      data-keyboard-navigation="true"
    >
      {children}
    </div>
  );
}

/**
 * Global keyboard shortcuts manager
 */
export class GlobalKeyboardShortcuts {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isActive = true;

  constructor() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  addShortcut(shortcut: KeyboardShortcut): void {
    const key = this.generateShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  removeShortcut(shortcut: Partial<KeyboardShortcut>): void {
    const key = this.generateShortcutKey(shortcut as KeyboardShortcut);
    this.shortcuts.delete(key);
  }

  setActive(active: boolean): void {
    this.isActive = active;
  }

  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  private generateShortcutKey(shortcut: KeyboardShortcut): string {
    const modifiers = [];
    if (shortcut.ctrlKey) modifiers.push('ctrl');
    if (shortcut.altKey) modifiers.push('alt');
    if (shortcut.shiftKey) modifiers.push('shift');
    if (shortcut.metaKey) modifiers.push('meta');
    
    return [...modifiers, shortcut.key.toLowerCase()].join('+');
  }

  private handleKeyDown = (event: Event): void => {
    if (!this.isActive) return;

    // Don't trigger shortcuts when user is typing in input fields
    if ((event.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) {
      return;
    }

    const keyboardEvent = event as globalThis.KeyboardEvent;
    const key = this.generateShortcutKey({
      key: keyboardEvent.key,
      ctrlKey: keyboardEvent.ctrlKey,
      altKey: keyboardEvent.altKey,
      shiftKey: keyboardEvent.shiftKey,
      metaKey: keyboardEvent.metaKey
    } as KeyboardShortcut);

    const shortcut = this.shortcuts.get(key);
    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  };

  cleanup(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.shortcuts.clear();
  }
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const shortcutsRef = useRef<GlobalKeyboardShortcuts>(new GlobalKeyboardShortcuts());
  const { announce } = useAccessibility();

  useEffect(() => {
    return () => {
      shortcutsRef.current.cleanup();
    };
  }, []);

  const addShortcut = (shortcut: KeyboardShortcut) => {
    shortcutsRef.current.addShortcut(shortcut);
  };

  const removeShortcut = (shortcut: Partial<KeyboardShortcut>) => {
    shortcutsRef.current.removeShortcut(shortcut);
  };

  const announceShortcuts = (category?: string) => {
    const shortcuts = shortcutsRef.current.getShortcuts()
      .filter(s => !category || s.category === category)
      .map(s => `${s.key}: ${s.description}`)
      .join(', ');
    
    announce({
      message: `Available shortcuts: ${shortcuts}`,
      priority: 'polite'
    });
  };

  return {
    addShortcut,
    removeShortcut,
    announceShortcuts,
    setActive: (active: boolean) => shortcutsRef.current.setActive(active)
  };
}

/**
 * Component for creating skip links
 */
export interface SkipLinkProps {
  targetId: string;
  children: ReactNode;
  className?: string;
}

export function SkipLink({ targetId, children, className = '' }: SkipLinkProps) {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      className={`skip-link ${className}`}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: '-40px',
        left: '6px',
        zIndex: 9999,
        background: '#000',
        color: '#fff',
        padding: '8px',
        textDecoration: 'none',
        transform: 'translateY(-100%)',
        transition: 'transform 0.3s'
      }}
      onFocus={(e) => {
        e.target.style.transform = 'translateY(0)';
      }}
      onBlur={(e) => {
        e.target.style.transform = 'translateY(-100%)';
      }}
    >
      {children}
    </a>
  );
}

/**
 * Container for skip links
 */
export interface SkipLinksProps {
  links: Array<{ targetId: string; label: string }>;
}

export function SkipLinks({ links }: SkipLinksProps) {
  return (
    <div className="skip-links-container" style={{ position: 'relative' }}>
      {links.map(link => (
        <SkipLink key={link.targetId} targetId={link.targetId}>
          {link.label}
        </SkipLink>
      ))}
    </div>
  );
}