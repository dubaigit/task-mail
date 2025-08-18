import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  UserIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface TouchGesturesProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPullRefresh?: () => Promise<void>;
  swipeThreshold?: number;
  pullThreshold?: number;
  isRefreshing?: boolean;
  disabled?: boolean;
  leftAction?: {
    label: string;
    color: 'success' | 'danger' | 'warning' | 'info';
    icon?: React.ComponentType<{ className?: string }>;
  };
  rightAction?: {
    label: string;
    color: 'success' | 'danger' | 'warning' | 'info';
    icon?: React.ComponentType<{ className?: string }>;
  };
  className?: string;
}

interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  isSwiping: boolean;
  isPulling: boolean;
  startTime: number;
}

const TouchGestures: React.FC<TouchGesturesProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onPullRefresh,
  swipeThreshold = 100,
  pullThreshold = 80,
  isRefreshing = false,
  disabled = false,
  leftAction,
  rightAction,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchState, setTouchState] = useState<TouchState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    isSwiping: false,
    isPulling: false,
    startTime: 0
  });
  const [transform, setTransform] = useState({ x: 0, y: 0 });
  const [actionVisible, setActionVisible] = useState<'left' | 'right' | null>(null);
  const [pullProgress, setPullProgress] = useState(0);

  // Action color mapping
  const getActionColor = (color: string): string => {
    const colors = {
      success: 'bg-green-500 text-white',
      danger: 'bg-red-500 text-white',
      warning: 'bg-orange-500 text-white',
      info: 'bg-blue-500 text-white'
    };
    return colors[color as keyof typeof colors] || colors.info;
  };

  // Default action icons
  const getDefaultIcon = (action: 'left' | 'right') => {
    if (action === 'left') return CheckCircleIcon;
    return UserIcon;
  };

  // Reset transform and state
  const resetTransform = useCallback(() => {
    setTransform({ x: 0, y: 0 });
    setActionVisible(null);
    setPullProgress(0);
    setTouchState(prev => ({
      ...prev,
      isSwiping: false,
      isPulling: false,
      deltaX: 0,
      deltaY: 0
    }));
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    setTouchState({
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      isSwiping: false,
      isPulling: false,
      startTime: Date.now()
    });
  }, [disabled]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    setTouchState(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX,
      deltaY
    }));

    // Determine gesture type
    const isHorizontalSwipe = absDeltaX > absDeltaY && absDeltaX > 20;
    const isVerticalPull = absDeltaY > absDeltaX && deltaY > 0 && touchState.startY < 100;

    if (isHorizontalSwipe) {
      // Horizontal swipe
      e.preventDefault();
      setTouchState(prev => ({ ...prev, isSwiping: true }));
      
      const maxSwipe = swipeThreshold * 1.2;
      const clampedDelta = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
      setTransform({ x: clampedDelta, y: 0 });

      // Show action indicators
      if (deltaX > 30 && onSwipeRight && rightAction) {
        setActionVisible('right');
      } else if (deltaX < -30 && onSwipeLeft && leftAction) {
        setActionVisible('left');
      } else {
        setActionVisible(null);
      }
    } else if (isVerticalPull && onPullRefresh && !isRefreshing) {
      // Pull to refresh
      e.preventDefault();
      setTouchState(prev => ({ ...prev, isPulling: true }));
      
      const maxPull = pullThreshold * 1.5;
      const clampedDelta = Math.min(maxPull, deltaY);
      const progress = Math.min(1, clampedDelta / pullThreshold);
      
      setTransform({ x: 0, y: clampedDelta });
      setPullProgress(progress);
    }
  }, [
    disabled,
    touchState.startX,
    touchState.startY,
    swipeThreshold,
    pullThreshold,
    onSwipeLeft,
    onSwipeRight,
    onPullRefresh,
    isRefreshing,
    leftAction,
    rightAction
  ]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (disabled) return;

    const { deltaX, deltaY, isSwiping, isPulling, startTime } = touchState;
    const duration = Date.now() - startTime;
    const velocity = Math.abs(deltaX) / duration;

    if (isSwiping) {
      // Handle swipe gestures
      const shouldTriggerSwipe = Math.abs(deltaX) > swipeThreshold || velocity > 0.5;
      
      if (shouldTriggerSwipe) {
        if (deltaX > 0 && onSwipeRight) {
          // Trigger haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(20);
          }
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          // Trigger haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(20);
          }
          onSwipeLeft();
        }
      }
    } else if (isPulling && onPullRefresh) {
      // Handle pull to refresh
      if (deltaY > pullThreshold && !isRefreshing) {
        // Trigger haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([10, 50, 10]);
        }
        onPullRefresh();
      }
    }

    // Reset with animation
    setTimeout(resetTransform, 100);
  }, [
    disabled,
    touchState,
    swipeThreshold,
    pullThreshold,
    onSwipeLeft,
    onSwipeRight,
    onPullRefresh,
    isRefreshing,
    resetTransform
  ]);

  // Prevent default touch behaviors that might interfere
  const handleTouchCancel = useCallback(() => {
    resetTransform();
  }, [resetTransform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetTransform();
    };
  }, [resetTransform]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left Action Indicator */}
      {leftAction && actionVisible === 'left' && (
        <div className={`absolute left-0 top-0 bottom-0 w-20 flex items-center justify-center ${getActionColor(leftAction.color)} swipe-action-reveal visible`}>
          {leftAction.icon ? (
            <leftAction.icon className="w-6 h-6" />
          ) : (
            (() => {
              const IconComponent = getDefaultIcon('left');
              return <IconComponent className="w-6 h-6" />;
            })()
          )}
          <span className="sr-only">{leftAction.label}</span>
        </div>
      )}

      {/* Right Action Indicator */}
      {rightAction && actionVisible === 'right' && (
        <div className={`absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center ${getActionColor(rightAction.color)} swipe-action-reveal visible`}>
          {rightAction.icon ? (
            <rightAction.icon className="w-6 h-6" />
          ) : (
            (() => {
              const IconComponent = getDefaultIcon('right');
              return <IconComponent className="w-6 h-6" />;
            })()
          )}
          <span className="sr-only">{rightAction.label}</span>
        </div>
      )}

      {/* Pull to Refresh Indicator */}
      {onPullRefresh && (touchState.isPulling || isRefreshing) && (
        <div className={`pull-indicator ${touchState.isPulling || isRefreshing ? 'visible' : ''} ${isRefreshing ? 'loading' : ''}`}>
          <ArrowPathIcon className="w-5 h-5" />
          {pullProgress > 0 && !isRefreshing && (
            <div className="absolute inset-0 border-2 border-transparent border-t-current rounded-full"
                 style={{ 
                   transform: `rotate(${pullProgress * 360}deg)`,
                   transition: 'transform 0.1s ease'
                 }} />
          )}
        </div>
      )}

      {/* Main Content Container */}
      <div
        ref={containerRef}
        className={`swipe-container transition-transform duration-200 ease-out ${
          touchState.isSwiping || touchState.isPulling ? 'transition-none' : ''
        }`}
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          willChange: touchState.isSwiping || touchState.isPulling ? 'transform' : 'auto'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {children}
      </div>

      {/* Gesture Hints (for first-time users) */}
      {!disabled && (leftAction || rightAction || onPullRefresh) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none">
          <div className="flex gap-1">
            {leftAction && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
            {rightAction && (
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            )}
            {onPullRefresh && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TouchGestures;