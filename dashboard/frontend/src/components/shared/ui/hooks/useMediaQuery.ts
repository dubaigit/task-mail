import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Add listener
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    } else {
      mediaQuery.addEventListener('change', handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      } else {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, [query]);

  return matches;
};

// Common media query hooks
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');
export const useIsLargeScreen = () => useMediaQuery('(min-width: 1440px)');

// Orientation hooks
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');
export const useIsLandscape = () => useMediaQuery('(orientation: landscape)');

// Accessibility hooks
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const usePrefersColorScheme = () => {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  return prefersDark ? 'dark' : 'light';
};

// High contrast and other accessibility preferences
export const usePrefersHighContrast = () => useMediaQuery('(prefers-contrast: high)');
export const usePrefersTransparency = () => useMediaQuery('(prefers-transparency: reduce)');

// Device-specific queries
export const useIsTouch = () => useMediaQuery('(pointer: coarse)');
export const useCanHover = () => useMediaQuery('(hover: hover)');
export const useIsFinePointer = () => useMediaQuery('(pointer: fine)');

// Print media
export const useIsPrint = () => useMediaQuery('print');

export default useMediaQuery;