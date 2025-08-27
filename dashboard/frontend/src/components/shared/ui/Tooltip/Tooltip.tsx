import React, { useState, useRef, useEffect } from 'react';
import type { TooltipProps } from '../types';

const placementStyles = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  delay = 0,
  offset = 8,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    if (disabled) return;
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    } else {
      setIsVisible(true);
    }
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isVisible && content && (
        <div
          className={`
            absolute z-50 px-2 py-1 text-sm font-medium text-white
            bg-gray-900 rounded-md shadow-sm pointer-events-none
            whitespace-nowrap
            ${placementStyles[placement]}
          `}
          role="tooltip"
          style={{ marginTop: offset }}
        >
          {content}
          <div
            className={`
              absolute w-0 h-0
              ${placement === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-t-4 border-x-transparent border-x-4' : ''}
              ${placement === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-b-4 border-x-transparent border-x-4' : ''}
              ${placement === 'left' ? 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-l-4 border-y-transparent border-y-4' : ''}
              ${placement === 'right' ? 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-r-4 border-y-transparent border-y-4' : ''}
            `}
          />
        </div>
      )}
    </div>
  );
};