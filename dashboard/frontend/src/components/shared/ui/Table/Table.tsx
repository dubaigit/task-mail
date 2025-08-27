import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const tableVariants = cva(
  'w-full caption-bottom text-sm',
  {
    variants: {
      variant: {
        default: '',
        striped: '[&_tbody_tr:nth-child(odd)]:bg-muted/50',
        bordered: 'border border-border',
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

const tableHeaderVariants = cva(
  '[&_tr]:border-b',
  {
    variants: {
      variant: {
        default: '',
        sticky: 'sticky top-0 z-10 bg-background',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const tableBodyVariants = cva(
  '[&_tr:last-child]:border-0'
);

const tableFooterVariants = cva(
  'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0'
);

const tableRowVariants = cva(
  'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
  {
    variants: {
      variant: {
        default: '',
        clickable: 'cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const tableHeadVariants = cva(
  'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
  {
    variants: {
      size: {
        sm: 'h-10 px-2 text-xs',
        md: 'h-12 px-4 text-sm',
        lg: 'h-14 px-6 text-base',
      },
      align: {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
      },
      sortable: {
        true: 'cursor-pointer select-none hover:bg-muted/50',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      align: 'left',
      sortable: false,
    },
  }
);

const tableCellVariants = cva(
  'p-4 align-middle [&:has([role=checkbox])]:pr-0',
  {
    variants: {
      size: {
        sm: 'p-2 text-xs',
        md: 'p-4 text-sm',
        lg: 'p-6 text-base',
      },
      align: {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
      },
    },
    defaultVariants: {
      size: 'md',
      align: 'left',
    },
  }
);

const tableCaptionVariants = cva(
  'mt-4 text-sm text-muted-foreground'
);

// Table component
export interface TableProps extends 
  React.TableHTMLAttributes<HTMLTableElement>,
  VariantProps<typeof tableVariants> {}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn(tableVariants({ variant, size }), className)}
        {...props}
      />
    </div>
  )
);

Table.displayName = 'Table';

// TableHeader component
export interface TableHeaderProps extends 
  React.HTMLAttributes<HTMLTableSectionElement>,
  VariantProps<typeof tableHeaderVariants> {}

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, variant, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(tableHeaderVariants({ variant }), className)}
      {...props}
    />
  )
);

TableHeader.displayName = 'TableHeader';

// TableBody component
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn(tableBodyVariants(), className)}
      {...props}
    />
  )
);

TableBody.displayName = 'TableBody';

// TableFooter component
export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(tableFooterVariants(), className)}
      {...props}
    />
  )
);

TableFooter.displayName = 'TableFooter';

// TableRow component
export interface TableRowProps extends 
  React.HTMLAttributes<HTMLTableRowElement>,
  VariantProps<typeof tableRowVariants> {
  selected?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, variant, selected, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(tableRowVariants({ variant }), className)}
      data-state={selected ? 'selected' : undefined}
      {...props}
    />
  )
);

TableRow.displayName = 'TableRow';

// TableHead component
export interface TableHeadProps extends 
  Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'align'>,
  VariantProps<typeof tableHeadVariants> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ 
    className, 
    size, 
    align, 
    sortable = false, 
    sortDirection, 
    onSort, 
    children,
    onClick,
    ...props 
  }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (sortable && onSort) {
        onSort();
      }
      onClick?.(event);
    };

    return (
      <th
        ref={ref}
        className={cn(
          tableHeadVariants({ size, align, sortable }),
          className
        )}
        onClick={sortable ? handleClick : onClick}
        {...props}
      >
        <div className={cn(
          'flex items-center gap-2',
          align === 'center' && 'justify-center',
          align === 'right' && 'justify-end'
        )}>
          {children}
          {sortable && (
            <div className="flex flex-col">
              <svg
                className={cn(
                  'h-3 w-3 transition-colors',
                  sortDirection === 'asc' 
                    ? 'text-foreground' 
                    : 'text-muted-foreground/50'
                )}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7 14l5-5 5 5z" />
              </svg>
              <svg
                className={cn(
                  'h-3 w-3 -mt-1 transition-colors',
                  sortDirection === 'desc' 
                    ? 'text-foreground' 
                    : 'text-muted-foreground/50'
                )}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </div>
          )}
        </div>
      </th>
    );
  }
);

TableHead.displayName = 'TableHead';

// TableCell component
export interface TableCellProps extends 
  Omit<React.TdHTMLAttributes<HTMLTableCellElement>, 'align'>,
  VariantProps<typeof tableCellVariants> {}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, size, align, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(tableCellVariants({ size, align }), className)}
      {...props}
    />
  )
);

TableCell.displayName = 'TableCell';

// TableCaption component
export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn(tableCaptionVariants(), className)}
      {...props}
    />
  )
);

TableCaption.displayName = 'TableCaption';

// Utility Components

// TableContainer - responsive wrapper
export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxHeight?: string;
}

export const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(
  ({ className, maxHeight, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative w-full overflow-auto border rounded-md',
        className
      )}
      style={{
        maxHeight,
        ...style,
      }}
      {...props}
    />
  )
);

TableContainer.displayName = 'TableContainer';

// TableEmpty - empty state for tables
export interface TableEmptyProps extends React.HTMLAttributes<HTMLTableRowElement> {
  colSpan?: number;
  message?: string;
}

export const TableEmpty = forwardRef<HTMLTableRowElement, TableEmptyProps>(
  ({ className, colSpan, message = 'No data available', ...props }, ref) => (
    <TableRow ref={ref} className={className} {...props}>
      <TableCell colSpan={colSpan} className="h-24 text-center">
        <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <span className="text-sm">{message}</span>
        </div>
      </TableCell>
    </TableRow>
  )
);

TableEmpty.displayName = 'TableEmpty';

// TableSkeleton - loading skeleton for tables
export interface TableSkeletonProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  rows?: number;
  columns?: number;
}

export const TableSkeleton = forwardRef<HTMLTableSectionElement, TableSkeletonProps>(
  ({ className, rows = 5, columns = 4, ...props }, ref) => (
    <TableBody ref={ref} className={className} {...props}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <div className="h-4 bg-muted rounded animate-pulse" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
);

TableSkeleton.displayName = 'TableSkeleton';

// TableSelectAll - checkbox for selecting all rows
export interface TableSelectAllProps extends React.InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

export const TableSelectAll = forwardRef<HTMLInputElement, TableSelectAllProps>(
  ({ className, indeterminate, ...props }, ref) => {
    const checkboxRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      if (checkboxRef.current) {
        checkboxRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    const setRefs = React.useCallback((node: HTMLInputElement | null) => {
      checkboxRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref]);

    return (
      <input
        type="checkbox"
        ref={setRefs}
        className={cn(
          'h-4 w-4 rounded border border-primary text-primary focus:ring-primary focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);

TableSelectAll.displayName = 'TableSelectAll';

// TableSelectRow - checkbox for selecting individual rows
export interface TableSelectRowProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const TableSelectRow = forwardRef<HTMLInputElement, TableSelectRowProps>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        'h-4 w-4 rounded border border-primary text-primary focus:ring-primary focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);

TableSelectRow.displayName = 'TableSelectRow';

// Hook for table sorting
export interface UseSortingOptions<T> {
  data: T[];
  initialSortKey?: keyof T;
  initialSortDirection?: 'asc' | 'desc';
}

export function useTableSorting<T extends Record<string, any>>({
  data,
  initialSortKey,
  initialSortDirection = 'asc',
}: UseSortingOptions<T>) {
  const [sortKey, setSortKey] = React.useState<keyof T | null>(
    initialSortKey || null
  );
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>(
    initialSortDirection
  );

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [data, sortKey, sortDirection]);

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
  };
}

// Hook for row selection
export interface UseRowSelectionOptions {
  rowIds: (string | number)[];
  initialSelected?: (string | number)[];
}

export function useRowSelection({
  rowIds,
  initialSelected = [],
}: UseRowSelectionOptions) {
  const [selectedRows, setSelectedRows] = React.useState<Set<string | number>>(
    new Set(initialSelected)
  );

  const isSelected = (rowId: string | number) => selectedRows.has(rowId);
  
  const isAllSelected = rowIds.length > 0 && rowIds.every(id => selectedRows.has(id));
  
  const isIndeterminate = selectedRows.size > 0 && !isAllSelected;

  const toggleRow = (rowId: string | number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rowIds));
    }
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
  };

  return {
    selectedRows: Array.from(selectedRows),
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggleRow,
    toggleAll,
    clearSelection,
  };
}

export default Table;