import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// Optimized state hook that reduces re-renders
export function useOptimizedState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const stateRef = useRef<T>(state);
  
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  
  const updateState = useCallback((newState: T | ((prevState: T) => T)) => {
    setState(prev => {
      const next = typeof newState === 'function' ? (newState as (prevState: T) => T)(prev) : newState;
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        return next;
      }
      return prev;
    });
  }, []);
  
  return [state, updateState, stateRef] as const;
}

// Memoized callback hook with dependency optimization
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T, 
  deps: any[]
): T {
  const memoizedCallback = useCallback(callback, deps);
  return memoizedCallback;
}

// Debounced state hook
export function useDebouncedState<T>(
  initialValue: T, 
  delay: number = 300
): [T, T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return [value, debouncedValue, setValue];
}

// Memoized computation hook
export function useMemoizedComputation<T>(
  computation: () => T,
  dependencies: any[]
): T {
  return useMemo(computation, dependencies);
}