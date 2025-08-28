import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string | number;
  maxWidth?: string | number;
  scrollbarThumb?: string;
  scrollbarTrack?: string;
  hideScrollbars?: boolean;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className = '',
  maxHeight,
  maxWidth,
  scrollbarThumb = 'bg-gray-400 hover:bg-gray-500',
  scrollbarTrack = 'bg-gray-100',
  hideScrollbars = false,
  onScroll,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollPercentY, setScrollPercentY] = useState(0);
  const [scrollPercentX, setScrollPercentX] = useState(0);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = target;
    
    setScrollPercentY((scrollTop / (scrollHeight - clientHeight)) * 100 || 0);
    setScrollPercentX((scrollLeft / (scrollWidth - clientWidth)) * 100 || 0);
    
    setIsScrolling(true);
    
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    onScroll?.(e);
  }, [onScroll]);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ 
        top: scrollRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  }, []);

  const style: React.CSSProperties = {
    maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className={`
          overflow-auto
          ${hideScrollbars ? 'scrollbar-hide' : 'scrollbar-thin'}
          ${hideScrollbars ? '' : `scrollbar-thumb-rounded scrollbar-track-rounded`}
          ${className}
        `}
        style={style}
        onScroll={handleScroll}
      >
        {children}
      </div>
      
      {!hideScrollbars && (
        <>
          {/* Custom Vertical Scrollbar */}
          <div 
            className={`
              absolute right-0 top-0 bottom-0 w-3 rounded-r-md transition-opacity duration-150
              ${isScrolling ? 'opacity-100' : 'opacity-0 hover:opacity-100'}
              ${scrollbarTrack}
            `}
          >
            <div 
              className={`
                w-full rounded-md transition-all duration-150
                ${scrollbarThumb}
              `}
              style={{
                height: '20%',
                transform: `translateY(${scrollPercentY * 4}%)`,
              }}
            />
          </div>
          
          {/* Custom Horizontal Scrollbar */}
          <div 
            className={`
              absolute bottom-0 left-0 right-3 h-3 rounded-b-md transition-opacity duration-150
              ${isScrolling ? 'opacity-100' : 'opacity-0 hover:opacity-100'}
              ${scrollbarTrack}
            `}
          >
            <div 
              className={`
                h-full rounded-md transition-all duration-150
                ${scrollbarThumb}
              `}
              style={{
                width: '20%',
                transform: `translateX(${scrollPercentX * 4}%)`,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

// Utility component for auto-sizing scroll area
export const AutoScrollArea: React.FC<Omit<ScrollAreaProps, 'maxHeight'> & {
  autoHeight?: boolean;
  minHeight?: string | number;
}> = ({ 
  children, 
  autoHeight = true, 
  minHeight = '100px',
  ...props 
}) => {
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoHeight && contentRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContentHeight(entry.contentRect.height);
        }
      });
      
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
  }, [autoHeight]);

  const calculatedMaxHeight = autoHeight 
    ? Math.max(contentHeight, typeof minHeight === 'number' ? minHeight : parseInt(minHeight))
    : undefined;

  return (
    <ScrollArea {...props} maxHeight={calculatedMaxHeight}>
      <div ref={contentRef}>
        {children}
      </div>
    </ScrollArea>
  );
};

export default ScrollArea;