import React from 'react';
import type { BadgeProps } from '../types';

const variantClasses = {
  solid: {
    default: 'bg-gray-500 text-white',
    primary: 'bg-blue-500 text-white',
    secondary: 'bg-gray-500 text-white',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    danger: 'bg-red-500 text-white',
  },
  outline: {
    default: 'border border-gray-500 text-gray-500',
    primary: 'border border-blue-500 text-blue-500',
    secondary: 'border border-gray-500 text-gray-500',
    success: 'border border-green-500 text-green-500',
    warning: 'border border-yellow-500 text-yellow-500',
    danger: 'border border-red-500 text-red-500',
  },
  ghost: {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-blue-100 text-blue-700',
    secondary: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
  },
};

const sizeClasses = {
  xs: 'px-2 py-0.5 text-xs',
  sm: 'px-2.5 py-0.5 text-sm',
  md: 'px-3 py-1 text-sm',
  lg: 'px-3.5 py-1.5 text-base',
  xl: 'px-4 py-2 text-base',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'solid',
  size = 'md',
  color = 'default',
  className = '',
  children,
}) => {
  const variantClass = (variantClasses as any)[variant]?.[color] || variantClasses.solid.default;
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantClass}
        ${sizeClass}
        ${className}
      `}
    >
      {children}
    </span>
  );
};