import { useState, useEffect } from 'react';
import { useMediaQuery } from './useMediaQuery';

export interface Breakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

export const defaultBreakpoints: Breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export type BreakpointKey = keyof Breakpoints;
export type BreakpointValue = Breakpoints[BreakpointKey];

export interface UseBreakpointsOptions {
  breakpoints?: Partial<Breakpoints>;
  ssr?: boolean;
  fallback?: BreakpointKey;
}

export const useBreakpoints = (options: UseBreakpointsOptions = {}) => {
  const {
    breakpoints: customBreakpoints,
    ssr = true,
    fallback = 'md',
  } = options;

  const breakpoints = { ...defaultBreakpoints, ...customBreakpoints };

  // Media queries for each breakpoint
  const isXs = useMediaQuery(`(min-width: ${breakpoints.xs}px)`);
  const isSm = useMediaQuery(`(min-width: ${breakpoints.sm}px)`);
  const isMd = useMediaQuery(`(min-width: ${breakpoints.md}px)`);
  const isLg = useMediaQuery(`(min-width: ${breakpoints.lg}px)`);
  const isXl = useMediaQuery(`(min-width: ${breakpoints.xl}px)`);
  const is2Xl = useMediaQuery(`(min-width: ${breakpoints['2xl']}px)`);

  // Current breakpoint
  const current: BreakpointKey = (() => {
    if (typeof window === 'undefined' && ssr) {
      return fallback;
    }
    
    if (is2Xl) return '2xl';
    if (isXl) return 'xl';
    if (isLg) return 'lg';
    if (isMd) return 'md';
    if (isSm) return 'sm';
    return 'xs';
  })();

  // Screen width
  const [screenWidth, setScreenWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return breakpoints[fallback];
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Utility functions
  const isAbove = (breakpoint: BreakpointKey): boolean => {
    return screenWidth >= breakpoints[breakpoint];
  };

  const isBelow = (breakpoint: BreakpointKey): boolean => {
    return screenWidth < breakpoints[breakpoint];
  };

  const isBetween = (min: BreakpointKey, max: BreakpointKey): boolean => {
    return screenWidth >= breakpoints[min] && screenWidth < breakpoints[max];
  };

  const isOnly = (breakpoint: BreakpointKey): boolean => {
    const keys: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = keys.indexOf(breakpoint);
    const nextBreakpoint = keys[currentIndex + 1];
    
    if (!nextBreakpoint) {
      return screenWidth >= breakpoints[breakpoint];
    }
    
    return isBetween(breakpoint, nextBreakpoint);
  };

  return {
    // Current breakpoint info
    current,
    screenWidth,
    
    // Boolean flags for each breakpoint
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    
    // Utility functions
    isAbove,
    isBelow,
    isBetween,
    isOnly,
    
    // Breakpoint values
    breakpoints,
    
    // Convenience flags
    isMobile: isBelow('md'),
    isTablet: isBetween('md', 'lg'),
    isDesktop: isAbove('lg'),
    isSmallScreen: isBelow('lg'),
    isLargeScreen: isAbove('xl'),
  };
};

// Responsive value hook
export interface ResponsiveValue<T> {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}

export const useResponsiveValue = <T>(
  values: ResponsiveValue<T> | T,
  options?: UseBreakpointsOptions
): T => {
  const { current } = useBreakpoints(options);
  
  // If not a responsive object, return the value as-is
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return values as T;
  }
  
  const responsiveValues = values as ResponsiveValue<T>;
  const breakpointOrder: BreakpointKey[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'];
  const currentIndex = breakpointOrder.indexOf(current);
  
  // Find the appropriate value by going down the breakpoint hierarchy
  for (let i = currentIndex; i < breakpointOrder.length; i++) {
    const breakpoint = breakpointOrder[i];
    if (responsiveValues[breakpoint] !== undefined) {
      return responsiveValues[breakpoint] as T;
    }
  }
  
  // Fallback to the first available value
  for (const breakpoint of breakpointOrder) {
    if (responsiveValues[breakpoint] !== undefined) {
      return responsiveValues[breakpoint] as T;
    }
  }
  
  // This shouldn't happen if the object has at least one value
  return undefined as unknown as T;
};

export default useBreakpoints;