import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const skeletonVariants = cva(
  'animate-pulse bg-muted rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        lighter: 'bg-muted/50',
        darker: 'bg-muted-foreground/10',
        gradient: 'bg-gradient-to-r from-muted to-muted/50 bg-[length:200%_100%] animate-[shimmer_2s_infinite]',
      },
      animation: {
        pulse: 'animate-pulse',
        wave: 'animate-[wave_2s_ease-in-out_infinite]',
        shimmer: 'animate-[shimmer_2s_infinite] bg-[length:200%_100%]',
        none: '',
      },
      speed: {
        slow: '[animation-duration:3s]',
        normal: '[animation-duration:2s]',
        fast: '[animation-duration:1s]',
      },
    },
    defaultVariants: {
      variant: 'default',
      animation: 'pulse',
      speed: 'normal',
    },
  }
);

// Base Skeleton component
export interface SkeletonProps extends 
  React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof skeletonVariants> {
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ 
    className,
    variant,
    animation,
    speed,
    width,
    height,
    rounded,
    style,
    ...props 
  }, ref) => {
    const roundedClass = rounded ? {
      none: 'rounded-none',
      sm: 'rounded-sm',
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
      '2xl': 'rounded-2xl',
      full: 'rounded-full',
    }[rounded] : '';

    return (
      <div
        ref={ref}
        className={cn(
          skeletonVariants({ variant, animation, speed }),
          roundedClass,
          className
        )}
        style={{
          width,
          height,
          ...style,
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Text skeleton variants
export interface TextSkeletonProps extends Omit<SkeletonProps, 'height'> {
  lines?: number;
  lineHeight?: 'sm' | 'md' | 'lg';
  lastLineWidth?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

export const TextSkeleton = forwardRef<HTMLDivElement, TextSkeletonProps>(
  ({ 
    className,
    lines = 3,
    lineHeight = 'md',
    lastLineWidth = '75%',
    spacing = 'md',
    ...props 
  }, ref) => {
    const lineHeights = {
      sm: 'h-3',
      md: 'h-4',
      lg: 'h-5',
    };

    const spacings = {
      sm: 'space-y-1',
      md: 'space-y-2',
      lg: 'space-y-3',
    };

    return (
      <div
        ref={ref}
        className={cn('space-y-2', spacings[spacing], className)}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className={lineHeights[lineHeight]}
            width={index === lines - 1 ? lastLineWidth : '100%'}
            {...props}
          />
        ))}
      </div>
    );
  }
);

TextSkeleton.displayName = 'TextSkeleton';

// Avatar skeleton
export interface AvatarSkeletonProps extends Omit<SkeletonProps, 'rounded'> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const AvatarSkeleton = forwardRef<HTMLDivElement, AvatarSkeletonProps>(
  ({ 
    className,
    size = 'md',
    ...props 
  }, ref) => {
    const sizes = {
      xs: 'h-6 w-6',
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16',
      '2xl': 'h-20 w-20',
    };

    return (
      <Skeleton
        ref={ref}
        className={cn(sizes[size], 'rounded-full', className)}
        {...props}
      />
    );
  }
);

AvatarSkeleton.displayName = 'AvatarSkeleton';

// Button skeleton
export interface ButtonSkeletonProps extends Omit<SkeletonProps, 'variant'> {
  size?: 'sm' | 'md' | 'lg';
  buttonVariant?: 'default' | 'outline' | 'ghost';
}

export const ButtonSkeleton = forwardRef<HTMLDivElement, ButtonSkeletonProps>(
  ({ 
    className,
    size = 'md',
    buttonVariant = 'default',
    ...props 
  }, ref) => {
    const sizes = {
      sm: 'h-8 px-3',
      md: 'h-10 px-4',
      lg: 'h-12 px-6',
    };

    const variants = {
      default: 'bg-muted',
      outline: 'border border-muted bg-background',
      ghost: 'bg-muted/50',
    };

    return (
      <Skeleton
        ref={ref}
        className={cn(
          sizes[size],
          variants[buttonVariant],
          'rounded-md inline-block',
          className
        )}
        {...props}
      />
    );
  }
);

ButtonSkeleton.displayName = 'ButtonSkeleton';

// Card skeleton
export interface CardSkeletonProps extends SkeletonProps {
  showHeader?: boolean;
  showAvatar?: boolean;
  headerLines?: number;
  bodyLines?: number;
  showFooter?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export const CardSkeleton = forwardRef<HTMLDivElement, CardSkeletonProps>(
  ({ 
    className,
    showHeader = true,
    showAvatar = false,
    headerLines = 1,
    bodyLines = 3,
    showFooter = false,
    padding = 'md',
    ...props 
  }, ref) => {
    const paddings = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'border rounded-lg bg-card',
          paddings[padding],
          className
        )}
      >
        {/* Header with optional avatar */}
        {showHeader && (
          <div className="flex items-start space-x-3 mb-4">
            {showAvatar && <AvatarSkeleton size="md" {...props} />}
            <div className="flex-1 space-y-2">
              <TextSkeleton lines={headerLines} lineHeight="md" {...props} />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="space-y-2 mb-4">
          <TextSkeleton lines={bodyLines} {...props} />
        </div>

        {/* Footer */}
        {showFooter && (
          <div className="flex items-center justify-between pt-2 border-t border-muted">
            <Skeleton className="h-8 w-20" {...props} />
            <Skeleton className="h-8 w-16" {...props} />
          </div>
        )}
      </div>
    );
  }
);

CardSkeleton.displayName = 'CardSkeleton';

// Table skeleton
export interface TableSkeletonProps extends SkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  showCheckbox?: boolean;
  showActions?: boolean;
}

export const TableSkeleton = forwardRef<HTMLDivElement, TableSkeletonProps>(
  ({ 
    className,
    rows = 5,
    columns = 4,
    showHeader = true,
    showCheckbox = false,
    showActions = false,
    ...props 
  }, ref) => {
    const totalColumns = columns + (showCheckbox ? 1 : 0) + (showActions ? 1 : 0);

    return (
      <div ref={ref} className={cn('w-full space-y-3', className)}>
        {/* Header */}
        {showHeader && (
          <div className="flex items-center space-x-4 pb-2 border-b border-muted">
            {showCheckbox && (
              <Skeleton className="h-4 w-4 rounded-sm" {...props} />
            )}
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton
                key={`header-${i}`}
                className="h-4 flex-1"
                width={i === 0 ? '120px' : undefined}
                {...props}
              />
            ))}
            {showActions && (
              <Skeleton className="h-4 w-16" {...props} />
            )}
          </div>
        )}

        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex items-center space-x-4 py-2">
            {showCheckbox && (
              <Skeleton className="h-4 w-4 rounded-sm" {...props} />
            )}
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-4 flex-1"
                width={colIndex === 0 ? '120px' : undefined}
                {...props}
              />
            ))}
            {showActions && (
              <div className="flex items-center space-x-2">
                <Skeleton className="h-8 w-8 rounded" {...props} />
                <Skeleton className="h-8 w-8 rounded" {...props} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
);

TableSkeleton.displayName = 'TableSkeleton';

// Form skeleton
export interface FormSkeletonProps extends SkeletonProps {
  fields?: number;
  showLabels?: boolean;
  showSubmit?: boolean;
  fieldSpacing?: 'sm' | 'md' | 'lg';
}

export const FormSkeleton = forwardRef<HTMLDivElement, FormSkeletonProps>(
  ({ 
    className,
    fields = 4,
    showLabels = true,
    showSubmit = true,
    fieldSpacing = 'md',
    ...props 
  }, ref) => {
    const spacings = {
      sm: 'space-y-3',
      md: 'space-y-4',
      lg: 'space-y-6',
    };

    return (
      <div ref={ref} className={cn(spacings[fieldSpacing], className)}>
        {Array.from({ length: fields }).map((_, index) => (
          <div key={`field-${index}`} className="space-y-2">
            {showLabels && (
              <Skeleton className="h-4 w-24" {...props} />
            )}
            <Skeleton className="h-10 w-full rounded-md" {...props} />
          </div>
        ))}
        
        {showSubmit && (
          <div className="pt-4">
            <ButtonSkeleton size="lg" className="w-full sm:w-auto" {...props} />
          </div>
        )}
      </div>
    );
  }
);

FormSkeleton.displayName = 'FormSkeleton';

// List skeleton
export interface ListSkeletonProps extends SkeletonProps {
  items?: number;
  showAvatar?: boolean;
  showIcon?: boolean;
  showSecondaryText?: boolean;
  itemSpacing?: 'sm' | 'md' | 'lg';
}

export const ListSkeleton = forwardRef<HTMLDivElement, ListSkeletonProps>(
  ({ 
    className,
    items = 5,
    showAvatar = false,
    showIcon = false,
    showSecondaryText = true,
    itemSpacing = 'md',
    ...props 
  }, ref) => {
    const spacings = {
      sm: 'space-y-2',
      md: 'space-y-3',
      lg: 'space-y-4',
    };

    return (
      <div ref={ref} className={cn(spacings[itemSpacing], className)}>
        {Array.from({ length: items }).map((_, index) => (
          <div key={`item-${index}`} className="flex items-center space-x-3 p-2">
            {showAvatar && (
              <AvatarSkeleton size="md" {...props} />
            )}
            {showIcon && (
              <Skeleton className="h-5 w-5 rounded" {...props} />
            )}
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" {...props} />
              {showSecondaryText && (
                <Skeleton className="h-3 w-1/2" {...props} />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
);

ListSkeleton.displayName = 'ListSkeleton';

// Chart skeleton
export interface ChartSkeletonProps extends SkeletonProps {
  type?: 'bar' | 'line' | 'pie' | 'area';
  showLegend?: boolean;
  showTitle?: boolean;
}

export const ChartSkeleton = forwardRef<HTMLDivElement, ChartSkeletonProps>(
  ({ 
    className,
    type = 'bar',
    showLegend = true,
    showTitle = true,
    height = '300px',
    ...props 
  }, ref) => {
    return (
      <div ref={ref} className={cn('w-full space-y-4', className)}>
        {showTitle && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" {...props} />
            <Skeleton className="h-4 w-32" {...props} />
          </div>
        )}
        
        <div className="relative">
          <Skeleton 
            className="w-full rounded-lg" 
            height={height}
            {...props} 
          />
          
          {/* Chart-specific overlays */}
          {type === 'bar' && (
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between space-x-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-8 bg-primary/20"
                  height={`${20 + Math.random() * 60}%`}
                  {...props}
                />
              ))}
            </div>
          )}
          
          {type === 'pie' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-32 w-32 rounded-full bg-primary/20" {...props} />
            </div>
          )}
        </div>
        
        {showLegend && (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Skeleton className="h-3 w-3 rounded-full" {...props} />
                <Skeleton className="h-4 w-16" {...props} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

ChartSkeleton.displayName = 'ChartSkeleton';

// Page skeleton - full page layout
export interface PageSkeletonProps extends SkeletonProps {
  layout?: 'default' | 'sidebar' | 'dashboard';
  showHeader?: boolean;
  showSidebar?: boolean;
  showFooter?: boolean;
}

export const PageSkeleton = forwardRef<HTMLDivElement, PageSkeletonProps>(
  ({ 
    className,
    layout = 'default',
    showHeader = true,
    showSidebar = false,
    showFooter = false,
    ...props 
  }, ref) => {
    return (
      <div ref={ref} className={cn('min-h-screen bg-background', className)}>
        {/* Header */}
        {showHeader && (
          <div className="border-b border-muted p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-8 w-32" {...props} />
                <div className="hidden md:flex space-x-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-16" {...props} />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <AvatarSkeleton size="sm" {...props} />
                <Skeleton className="h-8 w-8 rounded" {...props} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-1">
          {/* Sidebar */}
          {(showSidebar || layout === 'sidebar' || layout === 'dashboard') && (
            <div className="w-64 border-r border-muted p-4">
              <div className="space-y-4">
                <Skeleton className="h-6 w-24" {...props} />
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-4 rounded" {...props} />
                      <Skeleton className="h-4 flex-1" {...props} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 p-6">
            {layout === 'dashboard' ? (
              <div className="space-y-6">
                {/* Dashboard header */}
                <div className="space-y-2">
                  <Skeleton className="h-8 w-48" {...props} />
                  <Skeleton className="h-4 w-32" {...props} />
                </div>
                
                {/* Stats grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton 
                      key={i} 
                      showHeader={false} 
                      bodyLines={2}
                      padding="sm"
                      {...props} 
                    />
                  ))}
                </div>
                
                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartSkeleton type="bar" {...props} />
                  <ChartSkeleton type="line" {...props} />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-64" {...props} />
                  <Skeleton className="h-4 w-96" {...props} />
                </div>
                <div className="grid gap-6">
                  <CardSkeleton {...props} />
                  <CardSkeleton {...props} />
                  <CardSkeleton {...props} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {showFooter && (
          <div className="border-t border-muted p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" {...props} />
              <div className="flex space-x-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-16" {...props} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

PageSkeleton.displayName = 'PageSkeleton';

export default Skeleton;