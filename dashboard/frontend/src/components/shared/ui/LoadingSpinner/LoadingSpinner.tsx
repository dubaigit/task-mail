import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const loadingSpinnerVariants = cva(
  'inline-block animate-spin',
  {
    variants: {
      size: {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
        '2xl': 'h-16 w-16',
      },
      variant: {
        default: 'text-primary',
        secondary: 'text-secondary',
        muted: 'text-muted-foreground',
        accent: 'text-accent',
        destructive: 'text-destructive',
        success: 'text-green-500',
        warning: 'text-yellow-500',
        info: 'text-blue-500',
      },
      speed: {
        slow: 'animate-spin [animation-duration:2s]',
        normal: 'animate-spin [animation-duration:1s]',
        fast: 'animate-spin [animation-duration:0.5s]',
      },
      thickness: {
        thin: '[--spinner-thickness:1px]',
        normal: '[--spinner-thickness:2px]',
        thick: '[--spinner-thickness:3px]',
        'extra-thick': '[--spinner-thickness:4px]',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
      speed: 'normal',
      thickness: 'normal',
    },
  }
);

const loadingSpinnerContainerVariants = cva(
  'flex items-center justify-center',
  {
    variants: {
      fullScreen: {
        true: 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50',
        false: '',
      },
      overlay: {
        true: 'absolute inset-0 bg-background/50 backdrop-blur-sm z-10',
        false: '',
      },
    },
    defaultVariants: {
      fullScreen: false,
      overlay: false,
    },
  }
);

// Icon variants for different spinner types
const SpinnerIcons = {
  // Classic circle spinner
  circle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="var(--spinner-thickness, 2)"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),

  // Dots spinner
  dots: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <circle cx="4" cy="12" r="3" className="animate-pulse [animation-delay:0ms]" />
      <circle cx="12" cy="12" r="3" className="animate-pulse [animation-delay:150ms]" />
      <circle cx="20" cy="12" r="3" className="animate-pulse [animation-delay:300ms]" />
    </svg>
  ),

  // Ring spinner
  ring: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="var(--spinner-thickness, 2)"
      />
      <circle
        className="opacity-75"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="var(--spinner-thickness, 2)"
        strokeDasharray="31.416"
        strokeDashoffset="31.416"
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
    </svg>
  ),

  // Pulse spinner
  pulse: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
      className={cn(props.className, 'animate-pulse')}
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),

  // Bars spinner
  bars: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <rect x="2" y="6" width="3" height="12" className="animate-pulse [animation-delay:0ms]" />
      <rect x="6" y="4" width="3" height="16" className="animate-pulse [animation-delay:150ms]" />
      <rect x="10" y="2" width="3" height="20" className="animate-pulse [animation-delay:300ms]" />
      <rect x="14" y="4" width="3" height="16" className="animate-pulse [animation-delay:450ms]" />
      <rect x="18" y="6" width="3" height="12" className="animate-pulse [animation-delay:600ms]" />
    </svg>
  ),

  // Square spinner
  square: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        stroke="currentColor"
        strokeWidth="var(--spinner-thickness, 2)"
        className="opacity-25"
      />
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        stroke="currentColor"
        strokeWidth="var(--spinner-thickness, 2)"
        strokeDasharray="80"
        strokeDashoffset="80"
        className="opacity-75"
      />
    </svg>
  ),
} as const;

// Base LoadingSpinner component
export interface LoadingSpinnerProps extends 
  React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof loadingSpinnerVariants> {
  type?: keyof typeof SpinnerIcons;
  label?: string;
  showLabel?: boolean;
}

export const LoadingSpinner = forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ 
    className,
    size,
    variant,
    speed,
    thickness,
    type = 'circle',
    label = 'Loading...',
    showLabel = false,
    ...props 
  }, ref) => {
    const IconComponent = SpinnerIcons[type];

    return (
      <div
        ref={ref}
        role="status"
        aria-label={label}
        className={cn('flex flex-col items-center gap-2', className)}
        {...props}
      >
        <IconComponent
          className={cn(loadingSpinnerVariants({ size, variant, speed, thickness }))}
          aria-hidden="true"
        />
        {showLabel && (
          <span className="text-sm text-muted-foreground">
            {label}
          </span>
        )}
        <span className="sr-only">{label}</span>
      </div>
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

// LoadingContainer - wrapper with overlay options
export interface LoadingContainerProps extends 
  React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof loadingSpinnerContainerVariants> {
  loading?: boolean;
  spinner?: Omit<LoadingSpinnerProps, 'className'>;
}

export const LoadingContainer = forwardRef<HTMLDivElement, LoadingContainerProps>(
  ({ 
    className,
    fullScreen,
    overlay,
    loading = true,
    spinner = {},
    children,
    ...props 
  }, ref) => {
    if (!loading) {
      return <>{children}</>;
    }

    return (
      <div
        ref={ref}
        className={cn(
          loadingSpinnerContainerVariants({ fullScreen, overlay }),
          className
        )}
        {...props}
      >
        <LoadingSpinner {...spinner} />
        {!fullScreen && !overlay && children}
      </div>
    );
  }
);

LoadingContainer.displayName = 'LoadingContainer';

// LoadingOverlay - positioned overlay
export interface LoadingOverlayProps extends LoadingContainerProps {
  position?: 'absolute' | 'fixed';
}

export const LoadingOverlay = forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ 
    className,
    position = 'absolute',
    loading = true,
    spinner = {},
    children,
    ...props 
  }, ref) => {
    return (
      <div className="relative">
        {children}
        {loading && (
          <div
            ref={ref}
            className={cn(
              'inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center',
              position === 'fixed' ? 'fixed' : 'absolute',
              className
            )}
            {...props}
          >
            <LoadingSpinner {...spinner} />
          </div>
        )}
      </div>
    );
  }
);

LoadingOverlay.displayName = 'LoadingOverlay';

// Specialized loading components

// ButtonSpinner - for loading buttons
export interface ButtonSpinnerProps extends Omit<LoadingSpinnerProps, 'size'> {
  size?: 'sm' | 'md' | 'lg';
}

export const ButtonSpinner = forwardRef<HTMLDivElement, ButtonSpinnerProps>(
  ({ size = 'sm', type = 'circle', ...props }, ref) => (
    <LoadingSpinner
      ref={ref}
      size={size}
      type={type}
      {...props}
    />
  )
);

ButtonSpinner.displayName = 'ButtonSpinner';

// PageLoader - full page loading
export interface PageLoaderProps extends Omit<LoadingSpinnerProps, 'size'> {
  size?: 'lg' | 'xl' | '2xl';
  message?: string;
}

export const PageLoader = forwardRef<HTMLDivElement, PageLoaderProps>(
  ({ 
    size = 'xl',
    message = 'Loading page...',
    showLabel = true,
    ...props 
  }, ref) => (
    <LoadingContainer fullScreen>
      <LoadingSpinner
        ref={ref}
        size={size}
        label={message}
        showLabel={showLabel}
        {...props}
      />
    </LoadingContainer>
  )
);

PageLoader.displayName = 'PageLoader';

// SectionLoader - section loading
export interface SectionLoaderProps extends LoadingSpinnerProps {
  height?: string;
  minHeight?: string;
}

export const SectionLoader = forwardRef<HTMLDivElement, SectionLoaderProps>(
  ({ 
    className,
    height,
    minHeight = '200px',
    style,
    ...props 
  }, ref) => (
    <div
      className={cn(
        'flex items-center justify-center w-full border rounded-lg bg-muted/10',
        className
      )}
      style={{
        height,
        minHeight,
        ...style,
      }}
    >
      <LoadingSpinner ref={ref} {...props} />
    </div>
  )
);

SectionLoader.displayName = 'SectionLoader';

// InlineLoader - inline loading
export interface InlineLoaderProps extends Omit<LoadingSpinnerProps, 'size'> {
  size?: 'xs' | 'sm' | 'md';
  text?: string;
}

export const InlineLoader = forwardRef<HTMLDivElement, InlineLoaderProps>(
  ({ 
    className,
    size = 'sm',
    text,
    ...props 
  }, ref) => (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <LoadingSpinner
        ref={ref}
        size={size}
        {...props}
      />
      {text && (
        <span className="text-sm text-muted-foreground">{text}</span>
      )}
    </div>
  )
);

InlineLoader.displayName = 'InlineLoader';

// TableLoader - for loading table data
export interface TableLoaderProps extends LoadingSpinnerProps {
  rows?: number;
  columns?: number;
}

export const TableLoader = forwardRef<HTMLDivElement, TableLoaderProps>(
  ({ 
    className,
    rows = 5,
    columns = 4,
    ...props 
  }, ref) => (
    <div className={cn('space-y-3', className)}>
      {/* Header skeleton */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-muted rounded flex-1 animate-pulse" />
        ))}
      </div>
      
      {/* Rows with loading spinner */}
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner ref={ref} {...props} />
      </div>
      
      {/* Footer skeleton */}
      {Array.from({ length: Math.max(rows - 1, 0) }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-muted/50 rounded flex-1 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
);

TableLoader.displayName = 'TableLoader';

// Hook for loading states
export interface UseLoadingSpinnerOptions {
  delay?: number;
  timeout?: number;
  onTimeout?: () => void;
}

export function useLoadingSpinner(
  isLoading: boolean,
  options: UseLoadingSpinnerOptions = {}
) {
  const { delay = 0, timeout, onTimeout } = options;
  const [showSpinner, setShowSpinner] = React.useState(false);
  const [isTimedOut, setIsTimedOut] = React.useState(false);

  React.useEffect(() => {
    let delayTimer: NodeJS.Timeout;
    let timeoutTimer: NodeJS.Timeout;

    if (isLoading) {
      // Reset timeout state
      setIsTimedOut(false);
      
      // Show spinner after delay
      if (delay > 0) {
        delayTimer = setTimeout(() => setShowSpinner(true), delay);
      } else {
        setShowSpinner(true);
      }

      // Set timeout if specified
      if (timeout) {
        timeoutTimer = setTimeout(() => {
          setIsTimedOut(true);
          onTimeout?.();
        }, timeout);
      }
    } else {
      setShowSpinner(false);
      setIsTimedOut(false);
    }

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(timeoutTimer);
    };
  }, [isLoading, delay, timeout, onTimeout]);

  return {
    showSpinner: isLoading && showSpinner,
    isTimedOut,
  };
}

// Compound export
export default LoadingSpinner;