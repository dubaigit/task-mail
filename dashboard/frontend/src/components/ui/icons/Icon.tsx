import { TaskStatus, TaskPriority, TaskCategory } from '../../../types/core';
/**
 * Icon Component - Standardized Icon Wrapper
 * 
 * A universal icon component that provides consistent sizing, coloring,
 * and accessibility features for all icons across the application.
 */

import React from 'react';
import { Icons, IconSizes, IconColors, getIcon } from './index';
import { IconProps } from './types';
import { cn } from '../../../utils/cn';

/**
 * Universal Icon component with size and color variants
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = 'current',
  className,
  ...props
}) => {
  if (!name) return null;

  const IconComponent = getIcon(name);
  if (!IconComponent) return null;

  // Handle both string size variants and numeric sizes
  const sizeClass = typeof size === 'string' && size in IconSizes 
    ? IconSizes[size as keyof typeof IconSizes]
    : typeof size === 'number' 
    ? `w-${size} h-${size}`
    : IconSizes.md;

  const colorClass = color in IconColors 
    ? IconColors[color as keyof typeof IconColors]
    : 'text-current';

  return (
    <IconComponent
      className={cn(sizeClass, colorClass, className)}
      {...props}
    />
  );
};

/**
 * Icon Button component for clickable icons
 */
export const IconButton: React.FC<{
  icon: keyof typeof Icons;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'ghost' | 'solid' | 'outline';
  size?: keyof typeof IconSizes;
  className?: string;
  'aria-label': string;
  children?: React.ReactNode;
}> = ({
  icon,
  onClick,
  disabled = false,
  loading = false,
  variant = 'ghost',
  size = 'md',
  className,
  'aria-label': ariaLabel,
  children
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variantClasses = {
    ghost: "hover:bg-gray-100 focus:ring-gray-500",
    solid: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    outline: "border border-gray-300 hover:bg-gray-50 focus:ring-gray-500"
  };

  const sizeClasses = {
    xs: "p-1",
    sm: "p-1.5",
    md: "p-2",
    lg: "p-2.5",
    xl: "p-3",
    '2xl': "p-4"
  };

  const IconComponent = Icons[icon];
  const iconSizeClass = IconSizes[size];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {loading ? (
        <Icons.refresh className={cn(iconSizeClass, "animate-spin")} />
      ) : (
        <IconComponent className={iconSizeClass} />
      )}
      {children}
    </button>
  );
};

/**
 * Status Icon component with predefined styling for different states
 */
export const StatusIcon: React.FC<{
  status: 'success' | 'error' | 'warning' | 'info' | 'pending';
  size?: keyof typeof IconSizes;
  withBackground?: boolean;
  className?: string;
}> = ({
  status,
  size = 'md',
  withBackground = false,
  className
}) => {
  const statusConfig = {
    success: { icon: 'checkCircle', color: 'text-green-600', bgColor: 'bg-green-100' },
    error: { icon: 'xCircle', color: 'text-red-600', bgColor: 'bg-red-100' },
    warning: { icon: 'alertTriangle', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    info: { icon: 'info', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    pending: { icon: 'clock', color: 'text-gray-600', bgColor: 'bg-gray-100' }
  };

  const config = statusConfig[status];
  const IconComponent = Icons[config.icon as keyof typeof Icons];
  const sizeClass = IconSizes[size];

  if (withBackground) {
    return (
      <div className={cn(
        "rounded-full p-1",
        config.bgColor,
        className
      )}>
        <IconComponent className={cn(sizeClass, config.color)} />
      </div>
    );
  }

  return (
    <IconComponent className={cn(sizeClass, config.color, className)} />
  );
};

/**
 * Icon with Label component for icon + text combinations
 */
export const IconWithLabel: React.FC<{
  icon: keyof typeof Icons;
  label: string;
  iconPosition?: 'left' | 'right' | 'top' | 'bottom';
  iconSize?: keyof typeof IconSizes;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({
  icon,
  label,
  iconPosition = 'left',
  iconSize = 'md',
  gap = 'md',
  className
}) => {
  const IconComponent = Icons[icon];
  const iconSizeClass = IconSizes[iconSize];
  
  const gapClasses = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3'
  };

  const flexClasses = {
    left: 'flex-row',
    right: 'flex-row-reverse',
    top: 'flex-col',
    bottom: 'flex-col-reverse'
  };

  return (
    <div className={cn(
      'flex items-center',
      flexClasses[iconPosition],
      gapClasses[gap],
      className
    )}>
      <IconComponent className={iconSizeClass} />
      <span>{label}</span>
    </div>
  );
};

/**
 * Urgency Indicator component for tasks and emails
 */
export const UrgencyIndicator: React.FC<{
  urgency: TaskPriority.CRITICAL | 'HIGH' | 'MEDIUM' | 'LOW';
  size?: keyof typeof IconSizes;
  showLabel?: boolean;
  className?: string;
}> = ({
  urgency,
  size = 'sm',
  showLabel = false,
  className
}) => {
  const urgencyConfig = {
    CRITICAL: { icon: 'fire', color: 'text-red-600', label: 'Critical', pulse: true },
    HIGH: { icon: 'warning', color: 'text-orange-600', label: 'High', pulse: false },
    MEDIUM: { icon: 'bolt', color: 'text-blue-600', label: 'Medium', pulse: false },
    LOW: { icon: 'clock', color: 'text-gray-500', label: 'Low', pulse: false }
  };

  const config = urgencyConfig[urgency];
  const IconComponent = Icons[config.icon as keyof typeof Icons];
  const sizeClass = IconSizes[size];

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <IconComponent 
        className={cn(
          sizeClass, 
          config.color,
          config.pulse && 'animate-pulse'
        )} 
      />
      {showLabel && (
        <span className={cn('text-xs font-medium', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export default Icon;