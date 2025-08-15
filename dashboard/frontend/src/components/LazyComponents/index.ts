/**
 * Lazy Component Exports
 * 
 * Centralized exports for all lazy-loaded components with optimized
 * loading strategies for different component types.
 */

import { createLazyComponent, LoadingSkeletons } from './LazyComponentLoader';

// Lazy load Analytics component (heavy charts and calculations)
export const LazyAnalytics = createLazyComponent(
  () => import('../Analytics/Analytics'),
  {
    fallback: LoadingSkeletons.Dashboard,
    threshold: 0.2,
    rootMargin: '100px',
    minDelay: 150,
    trackingName: 'Analytics'
  }
);

// Lazy load Email View component (rich content rendering)
export const LazyEmailView = createLazyComponent(
  () => import('../Email/EmailView'),
  {
    fallback: LoadingSkeletons.EmailCard,
    threshold: 0.1,
    rootMargin: '50px',
    minDelay: 100,
    trackingName: 'EmailView'
  }
);

// Lazy load Email List component (data heavy)
export const LazyEmailList = createLazyComponent(
  () => import('../Email/EmailList'),
  {
    fallback: LoadingSkeletons.Dashboard,
    threshold: 0.3,
    rootMargin: '200px',
    minDelay: 200,
    trackingName: 'EmailList'
  }
);

// Lazy load Modern Email Interface (main component)
export const LazyModernEmailInterface = createLazyComponent(
  () => import('../Email/ModernEmailInterface'),
  {
    fallback: LoadingSkeletons.EmailCard,
    loadOnMount: true, // Load immediately when needed
    minDelay: 50,
    trackingName: 'ModernEmailInterface'
  }
);

// Lazy load Performance Analytics component (data heavy)
export const LazyPerformanceAnalytics = createLazyComponent(
  () => import('../Performance/PerformanceAnalytics'),
  {
    fallback: LoadingSkeletons.Dashboard,
    threshold: 0.2,
    rootMargin: '150px',
    minDelay: 200,
    trackingName: 'PerformanceAnalytics'
  }
);

// Lazy load Analytics View component (data-heavy)
export const LazyAnalyticsView = createLazyComponent(
  () => import('../Analytics/AnalyticsView'),
  {
    fallback: LoadingSkeletons.Table,
    threshold: 0.3,
    rootMargin: '200px',
    minDelay: 300,
    trackingName: 'AnalyticsView'
  }
);

// Note: SearchResults component not yet implemented
// export const LazySearchResults = createLazyComponent(
//   () => import('../Search/SearchResults'),
//   {
//     fallback: LoadingSkeletons.Table,
//     threshold: 0.1,
//     rootMargin: '50px',
//     minDelay: 100,
//     trackingName: 'SearchResults'
//   }
// );

// Note: Help component not yet implemented
// export const LazyHelp = createLazyComponent(
//   () => import('../Help/Help'),
//   {
//     fallback: LoadingSkeletons.Dashboard,
//     threshold: 0.5,
//     rootMargin: '300px',
//     minDelay: 250,
//     trackingName: 'Help'
//   }
// );

// Export loading skeletons for direct use
export { LoadingSkeletons } from './LazyComponentLoader';

// Export utility functions
export {
  withLazyLoading,
  createLazyComponent,
  useLazyLoading
} from './LazyComponentLoader';