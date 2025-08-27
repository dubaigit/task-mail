import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center p-8 text-center',
  {
    variants: {
      variant: {
        default: '',
        bordered: 'border border-border rounded-lg',
        card: 'bg-card border border-border rounded-lg shadow-sm',
        subtle: 'bg-muted/50 rounded-lg',
      },
      size: {
        sm: 'p-4 gap-2',
        md: 'p-8 gap-4',
        lg: 'p-12 gap-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const emptyStateIconVariants = cva(
  'text-muted-foreground/50',
  {
    variants: {
      size: {
        sm: 'h-8 w-8',
        md: 'h-12 w-12',
        lg: 'h-16 w-16',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const emptyStateTitleVariants = cva(
  'font-semibold text-foreground',
  {
    variants: {
      size: {
        sm: 'text-sm',
        md: 'text-lg',
        lg: 'text-xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const emptyStateDescriptionVariants = cva(
  'text-muted-foreground max-w-sm mx-auto',
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const emptyStateActionVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 py-2',
        lg: 'h-10 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

// Built-in icons
const EmptyStateIcons: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  
  search: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  
  document: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  
  folder: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  
  users: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  
  mail: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  
  chart: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  
  shopping: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  
  heart: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  
  star: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  
  clock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  
  shield: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  
  warning: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  
  error: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  
  info: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export type EmptyStateIconName = keyof typeof EmptyStateIcons;

// Main EmptyState component
export interface EmptyStateProps extends 
  React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof emptyStateVariants> {
  icon?: EmptyStateIconName | React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ 
    className, 
    variant, 
    size, 
    icon = 'default',
    title = 'No data found',
    description = 'There is no data to display at the moment.',
    action,
    children,
    ...props 
  }, ref) => {
    const IconComponent = typeof icon === 'string' ? EmptyStateIcons[icon] : null;

    return (
      <div
        ref={ref}
        className={cn(emptyStateVariants({ variant, size }), className)}
        {...props}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {IconComponent ? (
            <IconComponent className={cn(emptyStateIconVariants({ size }))} />
          ) : typeof icon === 'string' ? (
            <EmptyStateIcons.default className={cn(emptyStateIconVariants({ size }))} />
          ) : (
            icon
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center space-y-2">
          {title && (
            <h3 className={cn(emptyStateTitleVariants({ size }))}>
              {title}
            </h3>
          )}
          
          {description && (
            <p className={cn(emptyStateDescriptionVariants({ size }))}>
              {description}
            </p>
          )}
        </div>

        {/* Action or Children */}
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
        
        {children && (
          <div className="flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

// EmptyStateIcon - for custom icon wrapper
export interface EmptyStateIconProps extends 
  React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof emptyStateIconVariants> {
  children: React.ReactNode;
}

export const EmptyStateIcon = forwardRef<HTMLDivElement, EmptyStateIconProps>(
  ({ className, size, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(emptyStateIconVariants({ size }), className)}
      {...props}
    >
      {children}
    </div>
  )
);

EmptyStateIcon.displayName = 'EmptyStateIcon';

// EmptyStateTitle component
export interface EmptyStateTitleProps extends 
  React.HTMLAttributes<HTMLHeadingElement>,
  VariantProps<typeof emptyStateTitleVariants> {}

export const EmptyStateTitle = forwardRef<HTMLHeadingElement, EmptyStateTitleProps>(
  ({ className, size, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(emptyStateTitleVariants({ size }), className)}
      {...props}
    />
  )
);

EmptyStateTitle.displayName = 'EmptyStateTitle';

// EmptyStateDescription component
export interface EmptyStateDescriptionProps extends 
  React.HTMLAttributes<HTMLParagraphElement>,
  VariantProps<typeof emptyStateDescriptionVariants> {}

export const EmptyStateDescription = forwardRef<HTMLParagraphElement, EmptyStateDescriptionProps>(
  ({ className, size, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(emptyStateDescriptionVariants({ size }), className)}
      {...props}
    />
  )
);

EmptyStateDescription.displayName = 'EmptyStateDescription';

// EmptyStateAction component
export interface EmptyStateActionProps extends 
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof emptyStateActionVariants> {
  asChild?: boolean;
}

export const EmptyStateAction = forwardRef<HTMLButtonElement, EmptyStateActionProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'button';
    
    return (
      <Comp
        ref={ref}
        className={cn(emptyStateActionVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

EmptyStateAction.displayName = 'EmptyStateAction';

// Predefined EmptyState variants for common use cases
export interface SearchEmptyStateProps extends Omit<EmptyStateProps, 'icon' | 'title' | 'description'> {
  query?: string;
  onClear?: () => void;
  title?: string;
  description?: string;
}

export const SearchEmptyState = forwardRef<HTMLDivElement, SearchEmptyStateProps>(
  ({ query, onClear, title, description, ...props }, ref) => (
    <EmptyState
      ref={ref}
      icon="search"
      title={title || `No results for "${query}"`}
      description={description || 'Try adjusting your search terms or filters.'}
      action={onClear && (
        <EmptyStateAction onClick={onClear} variant="outline">
          Clear search
        </EmptyStateAction>
      )}
      {...props}
    />
  )
);

SearchEmptyState.displayName = 'SearchEmptyState';

export interface NoDataEmptyStateProps extends Omit<EmptyStateProps, 'icon' | 'title' | 'description'> {
  resource?: string;
  onCreate?: () => void;
  title?: string;
  description?: string;
}

export const NoDataEmptyState = forwardRef<HTMLDivElement, NoDataEmptyStateProps>(
  ({ resource = 'items', onCreate, title, description, ...props }, ref) => (
    <EmptyState
      ref={ref}
      icon="document"
      title={title || `No ${resource} yet`}
      description={description || `You haven't created any ${resource} yet. Get started by creating your first one.`}
      action={onCreate && (
        <EmptyStateAction onClick={onCreate}>
          Create {resource}
        </EmptyStateAction>
      )}
      {...props}
    />
  )
);

NoDataEmptyState.displayName = 'NoDataEmptyState';

export interface ErrorEmptyStateProps extends Omit<EmptyStateProps, 'icon' | 'title' | 'description'> {
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export const ErrorEmptyState = forwardRef<HTMLDivElement, ErrorEmptyStateProps>(
  ({ onRetry, title, description, ...props }, ref) => (
    <EmptyState
      ref={ref}
      icon="error"
      title={title || 'Something went wrong'}
      description={description || 'We encountered an error while loading the data. Please try again.'}
      action={onRetry && (
        <EmptyStateAction onClick={onRetry} variant="outline">
          Try again
        </EmptyStateAction>
      )}
      {...props}
    />
  )
);

ErrorEmptyState.displayName = 'ErrorEmptyState';

export interface LoadingEmptyStateProps extends Omit<EmptyStateProps, 'icon' | 'title' | 'description'> {
  title?: string;
  description?: string;
}

export const LoadingEmptyState = forwardRef<HTMLDivElement, LoadingEmptyStateProps>(
  ({ title, description, ...props }, ref) => (
    <EmptyState
      ref={ref}
      icon={
        <div className="animate-spin">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      }
      title={title || 'Loading...'}
      description={description || 'Please wait while we load your data.'}
      {...props}
    />
  )
);

LoadingEmptyState.displayName = 'LoadingEmptyState';

export default EmptyState;