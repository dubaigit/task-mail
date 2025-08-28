import React, { forwardRef, useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const paginationVariants = cva(
  'mx-auto flex w-full justify-center',
  {
    variants: {
      size: {
        sm: 'gap-1',
        md: 'gap-2',
        lg: 'gap-3',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const paginationContentVariants = cva(
  'flex flex-row items-center gap-1'
);

const paginationItemVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'hover:bg-accent hover:text-accent-foreground',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-9 w-9 text-sm',
        lg: 'h-10 w-10 text-base',
      },
      state: {
        default: '',
        active: 'bg-primary text-primary-foreground hover:bg-primary/90',
        disabled: 'opacity-50 cursor-not-allowed',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      state: 'default',
    },
  }
);

const paginationLinkVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'hover:bg-accent hover:text-accent-foreground',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-8 min-w-8 px-2 text-xs',
        md: 'h-9 min-w-9 px-3 text-sm',
        lg: 'h-10 min-w-10 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const paginationEllipsisVariants = cva(
  'flex h-9 w-9 items-center justify-center',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-9 w-9 text-sm',
        lg: 'h-10 w-10 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

// Main Pagination component
export interface PaginationProps extends 
  React.HTMLAttributes<HTMLElement>,
  VariantProps<typeof paginationVariants> {}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  ({ className, size, ...props }, ref) => (
    <nav
      ref={ref}
      role="navigation"
      aria-label="pagination"
      className={cn(paginationVariants({ size }), className)}
      {...props}
    />
  )
);

Pagination.displayName = 'Pagination';

// PaginationContent component
export interface PaginationContentProps extends React.HTMLAttributes<HTMLUListElement> {}

export const PaginationContent = forwardRef<HTMLUListElement, PaginationContentProps>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn(paginationContentVariants(), className)}
      {...props}
    />
  )
);

PaginationContent.displayName = 'PaginationContent';

// PaginationItem component
export interface PaginationItemProps extends React.HTMLAttributes<HTMLLIElement> {}

export const PaginationItem = forwardRef<HTMLLIElement, PaginationItemProps>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn(className)} {...props} />
  )
);

PaginationItem.displayName = 'PaginationItem';

// PaginationLink component
export interface PaginationLinkProps extends 
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  VariantProps<typeof paginationLinkVariants> {
  isActive?: boolean;
  asChild?: boolean;
}

export const PaginationLink = forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ className, variant, size, isActive, asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'a';
    
    return (
      <Comp
        ref={ref}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          paginationLinkVariants({ variant, size }),
          isActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
          className
        )}
        {...props}
      />
    );
  }
);

PaginationLink.displayName = 'PaginationLink';

// PaginationButton component (for interactive pagination without links)
export interface PaginationButtonProps extends 
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof paginationItemVariants> {
  isActive?: boolean;
}

export const PaginationButton = forwardRef<HTMLButtonElement, PaginationButtonProps>(
  ({ className, variant, size, state, isActive, ...props }, ref) => (
    <button
      ref={ref}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        paginationItemVariants({ 
          variant, 
          size, 
          state: isActive ? 'active' : state 
        }),
        className
      )}
      {...props}
    />
  )
);

PaginationButton.displayName = 'PaginationButton';

// PaginationPrevious component
export interface PaginationPreviousProps extends 
  Omit<PaginationLinkProps, 'children'> {
  children?: React.ReactNode;
}

export const PaginationPrevious = forwardRef<HTMLAnchorElement, PaginationPreviousProps>(
  ({ className, children, ...props }, ref) => (
    <PaginationLink
      ref={ref}
      aria-label="Go to previous page"
      className={cn('gap-1 pl-2.5', className)}
      {...props}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span>{children ?? 'Previous'}</span>
    </PaginationLink>
  )
);

PaginationPrevious.displayName = 'PaginationPrevious';

// PaginationNext component
export interface PaginationNextProps extends 
  Omit<PaginationLinkProps, 'children'> {
  children?: React.ReactNode;
}

export const PaginationNext = forwardRef<HTMLAnchorElement, PaginationNextProps>(
  ({ className, children, ...props }, ref) => (
    <PaginationLink
      ref={ref}
      aria-label="Go to next page"
      className={cn('gap-1 pr-2.5', className)}
      {...props}
    >
      <span>{children ?? 'Next'}</span>
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </PaginationLink>
  )
);

PaginationNext.displayName = 'PaginationNext';

// PaginationEllipsis component
export interface PaginationEllipsisProps extends 
  React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof paginationEllipsisVariants> {}

export const PaginationEllipsis = forwardRef<HTMLSpanElement, PaginationEllipsisProps>(
  ({ className, size, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden
      className={cn(paginationEllipsisVariants({ size }), className)}
      {...props}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </svg>
      <span className="sr-only">More pages</span>
    </span>
  )
);

PaginationEllipsis.displayName = 'PaginationEllipsis';

// Utility hook for pagination logic
export interface UsePaginationOptions {
  totalPages: number;
  currentPage: number;
  siblingCount?: number;
  boundaryCount?: number;
}

export const usePagination = ({
  totalPages,
  currentPage,
  siblingCount = 1,
  boundaryCount = 1,
}: UsePaginationOptions) => {
  const range = useMemo(() => {
    const totalPageNumbers = siblingCount + 5; // 1 + 4 + siblingCount

    // Case 1: If the number of pages is small
    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    // Case 2: No left dots to show, but rights dots to be shown
    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);

      return [...leftRange, 'dots', totalPages];
    }

    // Case 3: No right dots to show, but left dots to be shown
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1
      );

      return [firstPageIndex, 'dots', ...rightRange];
    }

    // Case 4: Both left and right dots to be shown
    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i
      );

      return [firstPageIndex, 'dots', ...middleRange, 'dots', lastPageIndex];
    }

    return [];
  }, [totalPages, currentPage, siblingCount, boundaryCount]);

  return {
    range,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
    previousPage: currentPage - 1,
    nextPage: currentPage + 1,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
};

// Complete Pagination component with all logic built-in
export interface CompletePaginationProps extends 
  PaginationProps,
  UsePaginationOptions {
  onPageChange: (page: number) => void;
  showPreviousNext?: boolean;
  showFirstLast?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  firstLabel?: string;
  lastLabel?: string;
  getPageUrl?: (page: number) => string;
  variant?: 'default' | 'outline' | 'ghost';
}

export const CompletePagination = forwardRef<HTMLElement, CompletePaginationProps>(
  ({
    totalPages,
    currentPage,
    onPageChange,
    siblingCount = 1,
    boundaryCount = 1,
    showPreviousNext = true,
    showFirstLast = false,
    previousLabel = 'Previous',
    nextLabel = 'Next',
    firstLabel = 'First',
    lastLabel = 'Last',
    getPageUrl,
    variant = 'default',
    size,
    className,
    ...props
  }, ref) => {
    const {
      range,
      isFirstPage,
      isLastPage,
      previousPage,
      nextPage,
      hasNextPage,
      hasPreviousPage,
    } = usePagination({
      totalPages,
      currentPage,
      siblingCount,
      boundaryCount,
    });

    if (totalPages <= 1) {
      return null;
    }

    const handlePageChange = (page: number) => {
      if (page >= 1 && page <= totalPages && page !== currentPage) {
        onPageChange(page);
      }
    };

    const createPageElement = (page: number | string, isActive = false) => {
      if (page === 'dots') {
        return (
          <PaginationItem key={`dots-${Math.random()}`}>
            <PaginationEllipsis size={size} />
          </PaginationItem>
        );
      }

      const pageNumber = page as number;
      const url = getPageUrl?.(pageNumber);

      return (
        <PaginationItem key={pageNumber}>
          <PaginationLink
            href={url}
            variant={variant}
            size={size}
            isActive={isActive}
            onClick={(e) => {
              if (!url) {
                e.preventDefault();
                handlePageChange(pageNumber);
              }
            }}
          >
            {pageNumber}
          </PaginationLink>
        </PaginationItem>
      );
    };

    return (
      <Pagination ref={ref} size={size} className={className} {...props}>
        <PaginationContent>
          {/* First page */}
          {showFirstLast && !isFirstPage && (
            <PaginationItem>
              <PaginationLink
                href={getPageUrl?.(1)}
                variant={variant}
                size={size}
                onClick={(e) => {
                  if (!getPageUrl) {
                    e.preventDefault();
                    handlePageChange(1);
                  }
                }}
              >
                {firstLabel}
              </PaginationLink>
            </PaginationItem>
          )}

          {/* Previous page */}
          {showPreviousNext && hasPreviousPage && (
            <PaginationItem>
              <PaginationPrevious
                href={getPageUrl?.(previousPage)}
                variant={variant}
                size={size}
                onClick={(e) => {
                  if (!getPageUrl) {
                    e.preventDefault();
                    handlePageChange(previousPage);
                  }
                }}
              >
                {previousLabel}
              </PaginationPrevious>
            </PaginationItem>
          )}

          {/* Page numbers */}
          {range.map((page) => createPageElement(page, page === currentPage))}

          {/* Next page */}
          {showPreviousNext && hasNextPage && (
            <PaginationItem>
              <PaginationNext
                href={getPageUrl?.(nextPage)}
                variant={variant}
                size={size}
                onClick={(e) => {
                  if (!getPageUrl) {
                    e.preventDefault();
                    handlePageChange(nextPage);
                  }
                }}
              >
                {nextLabel}
              </PaginationNext>
            </PaginationItem>
          )}

          {/* Last page */}
          {showFirstLast && !isLastPage && (
            <PaginationItem>
              <PaginationLink
                href={getPageUrl?.(totalPages)}
                variant={variant}
                size={size}
                onClick={(e) => {
                  if (!getPageUrl) {
                    e.preventDefault();
                    handlePageChange(totalPages);
                  }
                }}
              >
                {lastLabel}
              </PaginationLink>
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    );
  }
);

CompletePagination.displayName = 'CompletePagination';

export default Pagination;