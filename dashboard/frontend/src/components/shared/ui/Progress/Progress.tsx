import React from 'react';
import type { ProgressProps } from '../types';

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
  xl: 'h-5',
};

const colorClasses: Record<string, string> = {
  default: 'bg-gray-500',
  primary: 'bg-blue-500',
  secondary: 'bg-gray-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  error: 'bg-red-500',
};

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showLabel = false,
  label,
  animated = false,
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const sizeClass = sizeClasses[size];
  const colorClass = colorClasses[color];

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">
            {label || `${Math.round(percentage)}%`}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClass}`}>
        <div
          className={`
            ${sizeClass} ${colorClass} rounded-full
            ${animated ? 'transition-all duration-300 ease-in-out' : ''}
          `}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};