import { useEffect, useCallback, useState } from 'react';
import { KEYBOARD_SHORTCUTS } from '../../../utils/constants';

interface KeyboardNavigationOptions {
  onDelete?: () => void;
  onArchive?: () => void;
  onMarkRead?: () => void;
  onNavigate?: (direction: 'up' | 'down') => void;
  onSelect?: () => void;
  onGenerateTask?: () => void;
  onGenerateDraft?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
  maxIndex?: number;
}

interface UseKeyboardNavigationReturn {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  resetFocus: () => void;
}

/**
 * Custom hook for managing keyboard navigation and shortcuts
 */
export const useKeyboardNavigation = (
  options: KeyboardNavigationOptions
): UseKeyboardNavigationReturn => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const {
    onDelete,
    onArchive,
    onMarkRead,
    onNavigate,
    onSelect,
    onGenerateTask,
    onGenerateDraft,
    onSearch,
    onEscape,
    enabled = true,
    maxIndex = 0,
  } = options;

  const resetFocus = useCallback(() => {
    setFocusedIndex(0);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle keyboard events when disabled or typing in inputs
    if (!enabled || event.target && (event.target as HTMLElement).tagName === 'INPUT') {
      return;
    }

    const key = event.key;
    const isModifierPressed = event.ctrlKey || event.metaKey;
    
    switch (key) {
      case KEYBOARD_SHORTCUTS.ARROW_DOWN:
        event.preventDefault();
        setFocusedIndex(prev => {
          const newIndex = Math.min(prev + 1, maxIndex);
          onNavigate?.('down');
          return newIndex;
        });
        break;
        
      case KEYBOARD_SHORTCUTS.ARROW_UP:
        event.preventDefault();
        setFocusedIndex(prev => {
          const newIndex = Math.max(prev - 1, 0);
          onNavigate?.('up');
          return newIndex;
        });
        break;
        
      case KEYBOARD_SHORTCUTS.ENTER:
      case KEYBOARD_SHORTCUTS.SPACE:
        event.preventDefault();
        onSelect?.();
        break;
        
      case KEYBOARD_SHORTCUTS.DELETE:
      case KEYBOARD_SHORTCUTS.BACKSPACE:
        if (!isModifierPressed) {
          event.preventDefault();
          onDelete?.();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.A:
        if (!isModifierPressed) {
          event.preventDefault();
          onArchive?.();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.R:
        if (!isModifierPressed) {
          event.preventDefault();
          onMarkRead?.();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.T:
        if (!isModifierPressed) {
          event.preventDefault();
          onGenerateTask?.();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.G:
        if (!isModifierPressed) {
          event.preventDefault();
          onGenerateDraft?.();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.SLASH:
        if (!isModifierPressed) {
          event.preventDefault();
          onSearch?.();
        }
        break;
        
      case KEYBOARD_SHORTCUTS.ESCAPE:
        event.preventDefault();
        onEscape?.();
        break;
        
      default:
        // Handle number keys for quick navigation (1-9)
        if (!isModifierPressed && /^[1-9]$/.test(key)) {
          const index = parseInt(key) - 1;
          if (index <= maxIndex) {
            event.preventDefault();
            setFocusedIndex(index);
            onSelect?.();
          }
        }
        break;
    }
  }, [
    enabled,
    maxIndex,
    onNavigate,
    onSelect,
    onDelete,
    onArchive,
    onMarkRead,
    onGenerateTask,
    onGenerateDraft,
    onSearch,
    onEscape,
  ]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  return {
    focusedIndex,
    setFocusedIndex,
    resetFocus,
  };
};