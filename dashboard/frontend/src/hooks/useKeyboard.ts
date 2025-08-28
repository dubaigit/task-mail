/**
 * Enterprise Email Management - useKeyboard Hook
 * Custom React hook for handling keyboard events with accessibility support
 * 
 * Features:
 * - Multiple key combinations
 * - Modifier key support (Ctrl, Shift, Alt, Meta)
 * - Configurable event prevention
 * - Automatic cleanup
 * - TypeScript support with key completion
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardHandlers {
  [key: string]: (event: KeyboardEvent) => void;
}

export interface KeyboardOptions {
  /**
   * Whether to prevent default behavior for handled keys
   * @default true
   */
  preventDefault?: boolean;
  
  /**
   * Whether to stop event propagation for handled keys
   * @default false
   */
  stopPropagation?: boolean;
  
  /**
   * Target element to attach listeners to
   * @default document
   */
  target?: HTMLElement | Document | null;
  
  /**
   * Whether to only handle events when target is focused
   * @default false
   */
  requireFocus?: boolean;
  
  /**
   * Whether to handle events when input elements are focused
   * @default true
   */
  allowInInputs?: boolean;
}

/**
 * Hook for handling keyboard shortcuts and navigation
 * 
 * @param handlers - Object mapping key combinations to handler functions
 * @param dependencies - Dependency array for handlers
 * @param options - Configuration options
 * 
 * @example
 * ```typescript
 * useKeyboard({
 *   'Escape': () => setShowModal(false),
 *   'Enter': () => handleSubmit(),
 *   'ArrowDown': () => selectNext(),
 *   'ArrowUp': () => selectPrevious(),
 *   'Ctrl+s': () => handleSave(),
 *   'Ctrl+z': () => handleUndo()
 * }, [handleSubmit, selectNext, selectPrevious]);
 * ```
 */
export function useKeyboard(
  handlers: KeyboardHandlers,
  dependencies: React.DependencyList = [],
  options: KeyboardOptions = {}
): void {
  const {
    preventDefault = true,
    stopPropagation = false,
    target = typeof document !== 'undefined' ? document : null,
    requireFocus = false,
    allowInInputs = true
  } = options;

  const handlersRef = useRef<KeyboardHandlers>(handlers);
  const optionsRef = useRef<KeyboardOptions>(options);

  // Update refs when handlers or options change
  useEffect(() => {
    handlersRef.current = handlers;
    optionsRef.current = options;
  });

  const keydownHandler = useCallback((event: KeyboardEvent) => {
    const currentHandlers = handlersRef.current;
    const currentOptions = optionsRef.current;

    // Check if we should ignore this event
    if (!currentOptions.allowInInputs && isInputElement(event.target as Element)) {
      return;
    }

    if (currentOptions.requireFocus && !isTargetFocused(event.target as Element, target)) {
      return;
    }

    // Build key combination string
    const keyCombo = buildKeyCombo(event);
    
    // Check for exact match first
    const handler = currentHandlers[keyCombo] || currentHandlers[event.key];
    
    if (handler) {
      if (currentOptions.preventDefault !== false) {
        event.preventDefault();
      }
      
      if (currentOptions.stopPropagation) {
        event.stopPropagation();
      }
      
      handler(event);
    }
  }, dependencies);

  useEffect(() => {
    const currentTarget = target || (typeof document !== 'undefined' ? document : null);
    
    if (!currentTarget) {
      return;
    }

    currentTarget.addEventListener('keydown', keydownHandler as EventListener);
    
    return () => {
      currentTarget.removeEventListener('keydown', keydownHandler as EventListener);
    };
  }, [keydownHandler, target]);
}

/**
 * Build a key combination string from a keyboard event
 */
function buildKeyCombo(event: KeyboardEvent): string {
  const modifiers: string[] = [];
  
  if (event.ctrlKey || event.metaKey) {
    modifiers.push('Ctrl');
  }
  if (event.altKey) {
    modifiers.push('Alt');
  }
  if (event.shiftKey) {
    modifiers.push('Shift');
  }
  
  // Don't include the modifier keys themselves in the combo
  const key = event.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return modifiers.join('+');
  }
  
  return modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
}

/**
 * Check if the event target is an input element
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  const inputTypes = ['input', 'textarea', 'select'];
  
  if (inputTypes.includes(tagName)) {
    return true;
  }
  
  // Check for contenteditable
  if (element.getAttribute('contenteditable') === 'true') {
    return true;
  }
  
  // Check if element has role="textbox"
  if (element.getAttribute('role') === 'textbox') {
    return true;
  }
  
  return false;
}

/**
 * Check if the target element is focused or contains the focused element
 */
function isTargetFocused(eventTarget: Element | null, target: HTMLElement | Document | null): boolean {
  if (!eventTarget || !target) return false;
  
  if (target === document) {
    return true;
  }
  
  const targetElement = target as HTMLElement;
  
  // Check if the event target is the target element or a descendant
  return targetElement === eventTarget || targetElement.contains(eventTarget);
}

/**
 * Hook for handling single key presses with simpler API
 * 
 * @example
 * ```typescript
 * useKeyPress('Escape', () => setShowModal(false));
 * useKeyPress('Enter', handleSubmit, [handleSubmit]);
 * ```
 */
export function useKeyPress(
  key: string,
  handler: (event: KeyboardEvent) => void,
  dependencies: React.DependencyList = [],
  options: KeyboardOptions = {}
): void {
  useKeyboard({ [key]: handler }, dependencies, options);
}

/**
 * Hook for handling arrow key navigation
 * 
 * @example
 * ```typescript
 * useArrowNavigation({
 *   onUp: () => selectPrevious(),
 *   onDown: () => selectNext(),
 *   onLeft: () => moveToPrevious(),
 *   onRight: () => moveToNext()
 * });
 * ```
 */
export function useArrowNavigation(
  handlers: {
    onUp?: (event: KeyboardEvent) => void;
    onDown?: (event: KeyboardEvent) => void;
    onLeft?: (event: KeyboardEvent) => void;
    onRight?: (event: KeyboardEvent) => void;
  },
  dependencies: React.DependencyList = [],
  options: KeyboardOptions = {}
): void {
  const keyHandlers: KeyboardHandlers = {};
  
  if (handlers.onUp) keyHandlers['ArrowUp'] = handlers.onUp;
  if (handlers.onDown) keyHandlers['ArrowDown'] = handlers.onDown;
  if (handlers.onLeft) keyHandlers['ArrowLeft'] = handlers.onLeft;
  if (handlers.onRight) keyHandlers['ArrowRight'] = handlers.onRight;
  
  useKeyboard(keyHandlers, dependencies, options);
}

/**
 * Common keyboard shortcuts for form handling
 * 
 * @example
 * ```typescript
 * useFormKeyboard({
 *   onSubmit: handleSubmit,
 *   onCancel: handleCancel,
 *   onSave: handleSave
 * });
 * ```
 */
export function useFormKeyboard(
  handlers: {
    onSubmit?: (event: KeyboardEvent) => void;
    onCancel?: (event: KeyboardEvent) => void;
    onSave?: (event: KeyboardEvent) => void;
    onUndo?: (event: KeyboardEvent) => void;
    onRedo?: (event: KeyboardEvent) => void;
  },
  dependencies: React.DependencyList = [],
  options: KeyboardOptions = {}
): void {
  const keyHandlers: KeyboardHandlers = {};
  
  if (handlers.onSubmit) keyHandlers['Enter'] = handlers.onSubmit;
  if (handlers.onCancel) keyHandlers['Escape'] = handlers.onCancel;
  if (handlers.onSave) keyHandlers['Ctrl+s'] = handlers.onSave;
  if (handlers.onUndo) keyHandlers['Ctrl+z'] = handlers.onUndo;
  if (handlers.onRedo) {
    keyHandlers['Ctrl+y'] = handlers.onRedo;
    keyHandlers['Ctrl+Shift+z'] = handlers.onRedo;
  }
  
  useKeyboard(keyHandlers, dependencies, { allowInInputs: false, ...options });
}

export default useKeyboard;