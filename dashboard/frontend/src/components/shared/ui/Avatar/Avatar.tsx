import React from 'react';
import type { AvatarProps } from '../types';

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-14 w-14 text-xl',
};

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  name,
  size = 'md',
  fallback,
  showBorder = false,
  status,
  className = '',
}) => {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <div className="relative inline-block">
      <div
        className={`
          ${sizeClasses[size]}
          relative inline-flex items-center justify-center
          rounded-full bg-gray-200 overflow-hidden
          ${showBorder ? 'ring-2 ring-white' : ''}
          ${className}
        `}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : fallback ? (
          <span>{fallback}</span>
        ) : initials ? (
          <span className="font-medium text-gray-700">{initials}</span>
        ) : (
          <svg
            className="h-full w-full text-gray-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </div>
      {status && (
        <span
          className={`
            absolute bottom-0 right-0
            block h-2.5 w-2.5 rounded-full
            ring-2 ring-white
            ${statusColors[status]}
          `}
        />
      )}
    </div>
  );
};