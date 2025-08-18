import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

export const useInfiniteScroll = ({
  loading,
  hasMore,
  onLoadMore,
  threshold = 100
}: UseInfiniteScrollOptions) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  const lastElementRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    if (!hasMore) return;
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    }, {
      rootMargin: `${threshold}px`
    });
    
    if (node) {
      observerRef.current.observe(node);
    }
  }, [loading, hasMore, onLoadMore, threshold]);
  
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);
  
  return lastElementRef;
};

