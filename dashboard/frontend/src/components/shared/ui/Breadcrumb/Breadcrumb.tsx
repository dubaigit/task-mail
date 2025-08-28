import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const breadcrumbVariants = cva(
  'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground',
  {
    variants: {
      size: {
        sm: 'text-xs gap-1',
        md: 'text-sm gap-1.5',
        lg: 'text-base gap-2',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const breadcrumbListVariants = cva(
  'flex flex-wrap items-center gap-1.5'
);

const breadcrumbItemVariants = cva(
  'inline-flex items-center gap-1.5'
);

const breadcrumbLinkVariants = cva(
  'transition-colors hover:text-foreground',
  {
    variants: {
      variant: {
        default: 'text-muted-foreground hover:text-foreground',
        primary: 'text-primary hover:text-primary/80',
        secondary: 'text-secondary-foreground hover:text-secondary-foreground/80',
      },
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const breadcrumbPageVariants = cva(
  'font-normal text-foreground',
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

const breadcrumbSeparatorVariants = cva(
  'text-muted-foreground',
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

const breadcrumbEllipsisVariants = cva(
  'flex h-9 w-9 items-center justify-center text-muted-foreground',
  {
    variants: {
      size: {
        sm: 'h-7 w-7 text-xs',
        md: 'h-9 w-9 text-sm',
        lg: 'h-11 w-11 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

// Main Breadcrumb component
export interface BreadcrumbProps extends 
  React.HTMLAttributes<HTMLElement>,
  VariantProps<typeof breadcrumbVariants> {
  separator?: React.ReactNode;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  ({ className, size, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="breadcrumb"
      className={cn(breadcrumbVariants({ size }), className)}
      {...props}
    />
  )
);

Breadcrumb.displayName = 'Breadcrumb';

// BreadcrumbList component
export interface BreadcrumbListProps extends React.HTMLAttributes<HTMLOListElement> {}

export const BreadcrumbList = forwardRef<HTMLOListElement, BreadcrumbListProps>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(breadcrumbListVariants(), className)}
      {...props}
    />
  )
);

BreadcrumbList.displayName = 'BreadcrumbList';

// BreadcrumbItem component
export interface BreadcrumbItemProps extends React.HTMLAttributes<HTMLLIElement> {}

export const BreadcrumbItem = forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn(breadcrumbItemVariants(), className)}
      {...props}
    />
  )
);

BreadcrumbItem.displayName = 'BreadcrumbItem';

// BreadcrumbLink component
export interface BreadcrumbLinkProps extends 
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  VariantProps<typeof breadcrumbLinkVariants> {
  asChild?: boolean;
}

export const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'a';
    
    return (
      <Comp
        ref={ref}
        className={cn(breadcrumbLinkVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

BreadcrumbLink.displayName = 'BreadcrumbLink';

// BreadcrumbPage component (current page, not clickable)
export interface BreadcrumbPageProps extends 
  React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof breadcrumbPageVariants> {}

export const BreadcrumbPage = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  ({ className, size, ...props }, ref) => (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn(breadcrumbPageVariants({ size }), className)}
      {...props}
    />
  )
);

BreadcrumbPage.displayName = 'BreadcrumbPage';

// BreadcrumbSeparator component
export interface BreadcrumbSeparatorProps extends 
  React.HTMLAttributes<HTMLLIElement>,
  VariantProps<typeof breadcrumbSeparatorVariants> {
  children?: React.ReactNode;
}

export const BreadcrumbSeparator = forwardRef<HTMLLIElement, BreadcrumbSeparatorProps>(
  ({ children, className, size, ...props }, ref) => (
    <li
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn(breadcrumbSeparatorVariants({ size }), className)}
      {...props}
    >
      {children ?? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
      )}
    </li>
  )
);

BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

// BreadcrumbEllipsis component (for collapsed items)
export interface BreadcrumbEllipsisProps extends 
  React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof breadcrumbEllipsisVariants> {}

export const BreadcrumbEllipsis = forwardRef<HTMLSpanElement, BreadcrumbEllipsisProps>(
  ({ className, size, ...props }, ref) => (
    <span
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn(breadcrumbEllipsisVariants({ size }), className)}
      {...props}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
      <span className="sr-only">More pages</span>
    </span>
  )
);

BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis';

// Utility hook for managing breadcrumbs
export interface BreadcrumbItemData {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

export interface UseBreadcrumbsOptions {
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
}

export const useBreadcrumbs = (
  items: BreadcrumbItemData[],
  options: UseBreadcrumbsOptions = {}
) => {
  const {
    maxItems = 5,
    itemsBeforeCollapse = 1,
    itemsAfterCollapse = 1,
  } = options;

  const shouldCollapse = items.length > maxItems;
  
  if (!shouldCollapse) {
    return { items, shouldCollapse: false };
  }

  const beforeItems = items.slice(0, itemsBeforeCollapse);
  const afterItems = items.slice(-itemsAfterCollapse);
  const collapsedCount = items.length - itemsBeforeCollapse - itemsAfterCollapse;

  return {
    items: [...beforeItems, ...afterItems],
    shouldCollapse: true,
    beforeItems,
    afterItems,
    collapsedCount,
    collapsedItems: items.slice(itemsBeforeCollapse, -itemsAfterCollapse),
  };
};

// Compound components

// AutoBreadcrumb - automatically generates breadcrumbs from items
export interface AutoBreadcrumbProps extends 
  Omit<BreadcrumbProps, 'children'>,
  UseBreadcrumbsOptions {
  items: BreadcrumbItemData[];
  linkComponent?: React.ComponentType<any>;
  onItemClick?: (item: BreadcrumbItemData, index: number) => void;
}

export const AutoBreadcrumb = forwardRef<HTMLElement, AutoBreadcrumbProps>(
  ({
    items,
    linkComponent: LinkComponent = 'a',
    onItemClick,
    maxItems,
    itemsBeforeCollapse,
    itemsAfterCollapse,
    size,
    className,
    ...props
  }, ref) => {
    const breadcrumbData = useBreadcrumbs(items, {
      maxItems,
      itemsBeforeCollapse,
      itemsAfterCollapse,
    });

    const handleItemClick = (item: BreadcrumbItemData, index: number) => {
      onItemClick?.(item, index);
    };

    return (
      <Breadcrumb ref={ref} size={size} className={className} {...props}>
        <BreadcrumbList>
          {breadcrumbData.shouldCollapse ? (
            <>
              {/* Items before collapse */}
              {breadcrumbData.beforeItems?.map((item, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {item.isCurrentPage ? (
                      <BreadcrumbPage size={size}>{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                       
                        href={item.href}
                        size={size}
                        onClick={() => handleItemClick(item, index)}
                      >
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < (breadcrumbData.beforeItems?.length || 0) - 1 + (breadcrumbData.afterItems?.length || 0) && (
                    <BreadcrumbSeparator size={size} />
                  )}
                </React.Fragment>
              ))}
              
              {/* Ellipsis */}
              {breadcrumbData.collapsedCount || 0 > 0 && (
                <>
                  <BreadcrumbSeparator size={size} />
                  <BreadcrumbItem>
                    <BreadcrumbEllipsis size={size} />
                  </BreadcrumbItem>
                  <BreadcrumbSeparator size={size} />
                </>
              )}
              
              {/* Items after collapse */}
              {breadcrumbData.afterItems?.map((item, index) => (
                <React.Fragment key={`after-${index}`}>
                  <BreadcrumbItem>
                    {item.isCurrentPage ? (
                      <BreadcrumbPage size={size}>{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                       
                        href={item.href}
                        size={size}
                        onClick={() => handleItemClick(item, items.length - (breadcrumbData.afterItems?.length || 0) + index)}
                      >
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < (breadcrumbData.afterItems?.length || 0) - 1 && (
                    <BreadcrumbSeparator size={size} />
                  )}
                </React.Fragment>
              ))}
            </>
          ) : (
            // No collapse needed
            items.map((item, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {item.isCurrentPage ? (
                    <BreadcrumbPage size={size}>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                     
                      href={item.href}
                      size={size}
                      onClick={() => handleItemClick(item, index)}
                    >
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < items.length - 1 && <BreadcrumbSeparator size={size} />}
              </React.Fragment>
            ))
          )}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }
);

AutoBreadcrumb.displayName = 'AutoBreadcrumb';

export default Breadcrumb;