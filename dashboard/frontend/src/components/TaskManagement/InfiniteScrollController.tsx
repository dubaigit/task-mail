import React, { useEffect, useRef, useCallback } from 'react';

interface InfiniteScrollControllerProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
  children: React.ReactNode;
  className?: string;
}

export const InfiniteScrollController: React.FC<InfiniteScrollControllerProps> = ({
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 100,
  children,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const checkScrollPosition = useCallback(() => {
    if (!containerRef.current || loadingRef.current || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < threshold) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [hasMore, onLoadMore, threshold]);

  useEffect(() => {
    loadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkScrollPosition();
    };

    container.addEventListener('scroll', handleScroll);
    
    // Check initial position
    checkScrollPosition();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [checkScrollPosition]);

  return (
    <div
      ref={containerRef}
      className={`infinite-scroll-container ${className}`}
      style={{ height: '100%', overflowY: 'auto' }}
    >
      {children}
      
      {isLoading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600">Loading more tasks...</span>
        </div>
      )}
      
      {!hasMore && !isLoading && (
        <div className="text-center py-4 text-sm text-gray-500">
          No more tasks to load
        </div>
      )}
    </div>
  );
};

export default InfiniteScrollController;