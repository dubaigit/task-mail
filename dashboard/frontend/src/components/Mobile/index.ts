// Mobile Components for Touch-Optimized Task-Centric Interface
// Export all mobile-specific components and utilities

export { default as MobileTaskInterface } from './MobileTaskInterface';
export { default as BottomNavigation } from './BottomNavigation';
export { default as TouchGestures } from './TouchGestures';
export { default as OfflineManager, useOffline, OfflineSettings } from './OfflineManager';
export { default as ResponsiveLayout } from './ResponsiveLayout';

// Type exports for component props
export type {
  // You can add type exports here if needed
} from './MobileTaskInterface';

// Mobile-specific constants
export const MOBILE_BREAKPOINTS = {
  mobile: { min: 0, max: 767 },
  tablet: { min: 768, max: 1023 },
  desktop: { min: 1024, max: Infinity }
} as const;

export const TOUCH_TARGETS = {
  minimum: 44, // WCAG minimum
  recommended: 48, // Recommended size
  comfortable: 56 // Large touch target
} as const;

export const SWIPE_THRESHOLDS = {
  minimal: 50,
  default: 100,
  aggressive: 150
} as const;

export const ANIMATION_DURATIONS = {
  fast: 150,
  medium: 250,
  slow: 350
} as const;