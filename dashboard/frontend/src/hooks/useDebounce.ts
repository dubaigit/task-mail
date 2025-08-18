/**
 * Enterprise Email Management - useDebounce Hook
 * Custom React hook for debouncing values to optimize performance
 * 
 * Features:
 * - Configurable delay
 * - Automatic cleanup
 * - TypeScript support
 * - Memory efficient
 */

import { useState, useEffect } from 'react';

/**
 * Hook that debounces a value, delaying updates until after a specified delay
 * 
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 * 
 * @example
 * ```typescript
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * 
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     // Perform search with debounced query
 *     performSearch(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set a timeout to update the debounced value after the specified delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clear the timeout if value changes before delay completes
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;