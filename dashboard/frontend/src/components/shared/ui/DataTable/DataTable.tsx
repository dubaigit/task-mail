import React, { forwardRef, useMemo, useCallback, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableContainer,
  TableEmpty,
  TableSkeleton,
  TableSelectAll,
  TableSelectRow,
  useTableSorting,
  useRowSelection,
  type TableProps,
} from '../Table/Table';

const dataTableVariants = cva(
  'relative w-full',
  {
    variants: {
      variant: {
        default: '',
        bordered: 'border border-border rounded-md',
        striped: '',
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

const dataTableHeaderVariants = cva(
  'flex items-center justify-between p-4 border-b',
  {
    variants: {
      size: {
        sm: 'p-2',
        md: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const dataTableToolbarVariants = cva(
  'flex items-center gap-2',
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

const dataTableSearchVariants = cva(
  'flex items-center gap-2 px-3 py-2 border border-input rounded-md bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2',
  {
    variants: {
      size: {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const dataTablePaginationVariants = cva(
  'flex items-center justify-between p-4 border-t',
  {
    variants: {
      size: {
        sm: 'p-2 text-xs',
        md: 'p-4 text-sm',
        lg: 'p-6 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

// Column definition types
export interface ColumnDef<T = any> {
  id?: string;
  accessorKey?: keyof T | string;
  header?: string | ((props: { column: ColumnDef<T> }) => React.ReactNode);
  cell?: (props: { row: T; value: any }) => React.ReactNode;
  footer?: string | ((props: { column: ColumnDef<T> }) => React.ReactNode);
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  align?: 'left' | 'center' | 'right';
  meta?: Record<string, any>;
}

// Filter types
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface ColumnFilter {
  id: string;
  value: any;
}

export interface GlobalFilter {
  value: string;
}

export interface SortingState {
  id: string;
  desc: boolean;
}

// Pagination
export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

// Row selection
export interface RowSelectionState {
  [key: string]: boolean;
}

// DataTable Props
export interface DataTableProps<T = any> 
  extends Omit<TableProps, 'children'>,
    VariantProps<typeof dataTableVariants> {
  data: T[];
  columns: ColumnDef<T>[];
  
  // Features
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGlobalFilter?: boolean;
  enableRowSelection?: boolean;
  enablePagination?: boolean;
  
  // State
  sorting?: SortingState[];
  onSortingChange?: (sorting: SortingState[]) => void;
  columnFilters?: ColumnFilter[];
  onColumnFiltersChange?: (filters: ColumnFilter[]) => void;
  globalFilter?: string;
  onGlobalFilterChange?: (filter: string) => void;
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  
  // Custom components
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  
  // Loading & Error states
  loading?: boolean;
  error?: string | null;
  
  // Row props
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
  
  // Styling
  containerHeight?: string;
  stickyHeader?: boolean;
  
  // Toolbar
  toolbar?: React.ReactNode;
  
  // Footer
  showFooter?: boolean;
  footerContent?: React.ReactNode;
}

// DataTable component
export const DataTable = forwardRef<HTMLDivElement, DataTableProps>(
  ({
    data,
    columns,
    enableSorting = true,
    enableFiltering = false,
    enableGlobalFilter = true,
    enableRowSelection = false,
    enablePagination = true,
    sorting = [],
    onSortingChange,
    columnFilters = [],
    onColumnFiltersChange,
    globalFilter = '',
    onGlobalFilterChange,
    pagination = { pageIndex: 0, pageSize: 10 },
    onPaginationChange,
    rowSelection = {},
    onRowSelectionChange,
    searchPlaceholder = 'Search...',
    emptyMessage = 'No data available',
    loadingMessage = 'Loading...',
    loading = false,
    error = null,
    getRowId = (_, index) => index.toString(),
    onRowClick,
    containerHeight,
    stickyHeader = false,
    toolbar,
    showFooter = false,
    footerContent,
    variant,
    size,
    className,
    ...props
  }, ref) => {
    const [internalSorting, setInternalSorting] = useState<SortingState[]>(sorting);
    const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFilter[]>(columnFilters);
    const [internalGlobalFilter, setInternalGlobalFilter] = useState(globalFilter);
    const [internalPagination, setInternalPagination] = useState(pagination);
    const [internalRowSelection, setInternalRowSelection] = useState(rowSelection);

    // Use external state if provided, otherwise use internal state
    const currentSorting = onSortingChange ? sorting : internalSorting;
    const currentColumnFilters = onColumnFiltersChange ? columnFilters : internalColumnFilters;
    const currentGlobalFilter = onGlobalFilterChange ? globalFilter : internalGlobalFilter;
    const currentPagination = onPaginationChange ? pagination : internalPagination;
    const currentRowSelection = onRowSelectionChange ? rowSelection : internalRowSelection;

    // State setters
    const setSorting = useCallback((sorting: SortingState[]) => {
      if (onSortingChange) {
        onSortingChange(sorting);
      } else {
        setInternalSorting(sorting);
      }
    }, [onSortingChange]);

    const setColumnFilters = useCallback((filters: ColumnFilter[]) => {
      if (onColumnFiltersChange) {
        onColumnFiltersChange(filters);
      } else {
        setInternalColumnFilters(filters);
      }
    }, [onColumnFiltersChange]);

    const setGlobalFilter = useCallback((filter: string) => {
      if (onGlobalFilterChange) {
        onGlobalFilterChange(filter);
      } else {
        setInternalGlobalFilter(filter);
      }
    }, [onGlobalFilterChange]);

    const setPagination = useCallback((pagination: PaginationState) => {
      if (onPaginationChange) {
        onPaginationChange(pagination);
      } else {
        setInternalPagination(pagination);
      }
    }, [onPaginationChange]);

    const setRowSelection = useCallback((selection: RowSelectionState) => {
      if (onRowSelectionChange) {
        onRowSelectionChange(selection);
      } else {
        setInternalRowSelection(selection);
      }
    }, [onRowSelectionChange]);

    // Data processing
    const processedData = useMemo(() => {
      let result = [...data];

      // Global filter
      if (enableGlobalFilter && currentGlobalFilter) {
        result = result.filter((row) => {
          return columns.some((column) => {
            if (!column.searchable && column.searchable !== undefined) return false;
            
            const value = column.accessorKey 
              ? (row as any)[column.accessorKey]
              : row;
            
            return String(value)
              .toLowerCase()
              .includes(currentGlobalFilter.toLowerCase());
          });
        });
      }

      // Column filters
      if (enableFiltering && currentColumnFilters.length > 0) {
        currentColumnFilters.forEach((filter) => {
          const column = columns.find((col) => col.id === filter.id || col.accessorKey === filter.id);
          if (column && column.filterable !== false) {
            result = result.filter((row) => {
              const value = column.accessorKey 
                ? (row as any)[column.accessorKey]
                : row;
              
              if (Array.isArray(filter.value)) {
                return filter.value.includes(value);
              }
              
              return String(value)
                .toLowerCase()
                .includes(String(filter.value).toLowerCase());
            });
          }
        });
      }

      // Sorting
      if (enableSorting && currentSorting.length > 0) {
        result.sort((a, b) => {
          for (const sort of currentSorting) {
            const column = columns.find((col) => col.id === sort.id || col.accessorKey === sort.id);
            if (column) {
              const aValue = column.accessorKey ? (a as any)[column.accessorKey] : a;
              const bValue = column.accessorKey ? (b as any)[column.accessorKey] : b;
              
              let comparison = 0;
              if (aValue < bValue) comparison = -1;
              if (aValue > bValue) comparison = 1;
              
              if (comparison !== 0) {
                return sort.desc ? -comparison : comparison;
              }
            }
          }
          return 0;
        });
      }

      return result;
    }, [data, columns, currentGlobalFilter, currentColumnFilters, currentSorting, enableGlobalFilter, enableFiltering, enableSorting]);

    // Pagination
    const paginatedData = useMemo(() => {
      if (!enablePagination) return processedData;
      
      const start = currentPagination.pageIndex * currentPagination.pageSize;
      const end = start + currentPagination.pageSize;
      
      return processedData.slice(start, end);
    }, [processedData, currentPagination, enablePagination]);

    // Row IDs for selection
    const rowIds = useMemo(() => {
      return paginatedData.map((row, index) => getRowId(row, index));
    }, [paginatedData, getRowId]);

    // Selection helpers
    const selectedRowIds = Object.keys(currentRowSelection).filter(
      (id) => currentRowSelection[id]
    );
    
    const isAllRowsSelected = enableRowSelection && rowIds.length > 0 && 
      rowIds.every((id) => currentRowSelection[id]);
    
    const isIndeterminate = enableRowSelection && selectedRowIds.length > 0 && 
      !isAllRowsSelected;

    // Handlers
    const handleSort = useCallback((columnId: string) => {
      if (!enableSorting) return;
      
      const existing = currentSorting.find((s) => s.id === columnId);
      let newSorting: SortingState[];
      
      if (existing) {
        if (existing.desc) {
          // Remove sort
          newSorting = currentSorting.filter((s) => s.id !== columnId);
        } else {
          // Toggle to desc
          newSorting = currentSorting.map((s) => 
            s.id === columnId ? { ...s, desc: true } : s
          );
        }
      } else {
        // Add asc sort
        newSorting = [...currentSorting, { id: columnId, desc: false }];
      }
      
      setSorting(newSorting);
    }, [currentSorting, setSorting, enableSorting]);

    const handleSelectAll = useCallback(() => {
      if (!enableRowSelection) return;
      
      if (isAllRowsSelected) {
        // Deselect all
        const newSelection = { ...currentRowSelection };
        rowIds.forEach((id) => {
          delete newSelection[id];
        });
        setRowSelection(newSelection);
      } else {
        // Select all
        const newSelection = { ...currentRowSelection };
        rowIds.forEach((id) => {
          newSelection[id] = true;
        });
        setRowSelection(newSelection);
      }
    }, [enableRowSelection, isAllRowsSelected, currentRowSelection, rowIds, setRowSelection]);

    const handleRowSelect = useCallback((rowId: string) => {
      if (!enableRowSelection) return;
      
      const newSelection = { ...currentRowSelection };
      if (newSelection[rowId]) {
        delete newSelection[rowId];
      } else {
        newSelection[rowId] = true;
      }
      setRowSelection(newSelection);
    }, [enableRowSelection, currentRowSelection, setRowSelection]);

    // Page count
    const pageCount = enablePagination 
      ? Math.ceil(processedData.length / currentPagination.pageSize)
      : 1;

    if (error) {
      return (
        <div className={cn(dataTableVariants({ variant, size }), className)} ref={ref}>
          <div className="flex items-center justify-center p-8 text-destructive">
            <div className="text-center">
              <svg className="h-8 w-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm font-medium">Error</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn(dataTableVariants({ variant, size }), className)} ref={ref} {...props}>
        {/* Header */}
        {(enableGlobalFilter || toolbar) && (
          <div className={cn(dataTableHeaderVariants({ size }))}>
            <div className="flex items-center gap-4 flex-1">
              {enableGlobalFilter && (
                <div className={cn(dataTableSearchVariants({ size }))}>
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={currentGlobalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                  />
                  {currentGlobalFilter && (
                    <button
                      onClick={() => setGlobalFilter('')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {toolbar && (
              <div className={cn(dataTableToolbarVariants({ size }))}>
                {toolbar}
              </div>
            )}
          </div>
        )}

        {/* Table Container */}
        <TableContainer maxHeight={containerHeight} className="flex-1">
          <Table variant={variant === 'striped' ? 'striped' : variant === 'bordered' ? 'bordered' : 'default'} size={size}>
            <TableHeader variant={stickyHeader ? 'sticky' : 'default'}>
              <TableRow>
                {enableRowSelection && (
                  <TableHead size={size}>
                    <TableSelectAll
                      checked={isAllRowsSelected}
                      indeterminate={isIndeterminate}
                      onChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                {columns.map((column, index) => {
                  const columnId = column.id || String(column.accessorKey) || String(index);
                  const sortState = currentSorting.find((s) => s.id === columnId);
                  const sortDirection = sortState ? (sortState.desc ? 'desc' : 'asc') : null;
                  
                  return (
                    <TableHead
                      key={columnId}
                      size={size}
                      align={column.align}
                      sortable={enableSorting && column.sortable !== false}
                      sortDirection={sortDirection}
                      onSort={() => handleSort(columnId)}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth,
                        maxWidth: column.maxWidth,
                      }}
                    >
                      {typeof column.header === 'function' 
                        ? column.header({ column })
                        : column.header || columnId
                      }
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {loading ? (
                <TableSkeleton 
                  rows={currentPagination.pageSize} 
                  columns={columns.length + (enableRowSelection ? 1 : 0)} 
                />
              ) : paginatedData.length === 0 ? (
                <TableEmpty
                  colSpan={columns.length + (enableRowSelection ? 1 : 0)}
                  message={emptyMessage}
                />
              ) : (
                paginatedData.map((row, index) => {
                  const rowId = getRowId(row, index);
                  const isSelected = enableRowSelection && currentRowSelection[rowId];
                  
                  return (
                    <TableRow
                      key={rowId}
                      variant={onRowClick ? 'clickable' : 'default'}
                      selected={isSelected}
                      onClick={() => onRowClick?.(row, index)}
                    >
                      {enableRowSelection && (
                        <TableCell size={size}>
                          <TableSelectRow
                            checked={!!isSelected}
                            onChange={() => handleRowSelect(rowId)}
                          />
                        </TableCell>
                      )}
                      {columns.map((column, colIndex) => {
                        const columnId = column.id || String(column.accessorKey) || String(colIndex);
                        const value = column.accessorKey ? (row as any)[column.accessorKey] : row;
                        
                        return (
                          <TableCell 
                            key={columnId} 
                            size={size} 
                            align={column.align}
                            style={{
                              width: column.width,
                              minWidth: column.minWidth,
                              maxWidth: column.maxWidth,
                            }}
                          >
                            {column.cell ? column.cell({ row, value }) : String(value || '')}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            
            {showFooter && (
              <TableFooter>
                <TableRow>
                  {enableRowSelection && <TableCell size={size} />}
                  {columns.map((column, index) => {
                    const columnId = column.id || String(column.accessorKey) || String(index);
                    
                    return (
                      <TableCell 
                        key={columnId} 
                        size={size} 
                        align={column.align}
                      >
                        {typeof column.footer === 'function'
                          ? column.footer({ column })
                          : column.footer || ''
                        }
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>

        {/* Pagination */}
        {enablePagination && (
          <div className={cn(dataTablePaginationVariants({ size }))}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                {enableRowSelection && selectedRowIds.length > 0 && (
                  <span className="mr-2">
                    {selectedRowIds.length} of {processedData.length} row(s) selected
                  </span>
                )}
                Showing {Math.min((currentPagination.pageIndex * currentPagination.pageSize) + 1, processedData.length)} to {Math.min((currentPagination.pageIndex + 1) * currentPagination.pageSize, processedData.length)} of {processedData.length} entries
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Rows per page</span>
                <select
                  value={currentPagination.pageSize}
                  onChange={(e) => setPagination({
                    pageIndex: 0,
                    pageSize: parseInt(e.target.value),
                  })}
                  className="border border-input rounded px-2 py-1 text-sm bg-background"
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPagination({ ...currentPagination, pageIndex: 0 })}
                  disabled={currentPagination.pageIndex === 0}
                  className="p-1 rounded border border-input hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setPagination({ ...currentPagination, pageIndex: currentPagination.pageIndex - 1 })}
                  disabled={currentPagination.pageIndex === 0}
                  className="p-1 rounded border border-input hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <span className="px-2 text-sm">
                  Page {currentPagination.pageIndex + 1} of {pageCount}
                </span>
                
                <button
                  onClick={() => setPagination({ ...currentPagination, pageIndex: currentPagination.pageIndex + 1 })}
                  disabled={currentPagination.pageIndex >= pageCount - 1}
                  className="p-1 rounded border border-input hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setPagination({ ...currentPagination, pageIndex: pageCount - 1 })}
                  disabled={currentPagination.pageIndex >= pageCount - 1}
                  className="p-1 rounded border border-input hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {footerContent && (
          <div className="border-t p-4">
            {footerContent}
          </div>
        )}
      </div>
    );
  }
);

DataTable.displayName = 'DataTable';

// Hook for managing DataTable state
export interface UseDataTableOptions<T = any> {
  data: T[];
  columns: ColumnDef<T>[];
  initialSorting?: SortingState[];
  initialColumnFilters?: ColumnFilter[];
  initialGlobalFilter?: string;
  initialPagination?: PaginationState;
  initialRowSelection?: RowSelectionState;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGlobalFilter?: boolean;
  enableRowSelection?: boolean;
  enablePagination?: boolean;
}

export function useDataTable<T = any>({
  data,
  columns,
  initialSorting = [],
  initialColumnFilters = [],
  initialGlobalFilter = '',
  initialPagination = { pageIndex: 0, pageSize: 10 },
  initialRowSelection = {},
  enableSorting = true,
  enableFiltering = false,
  enableGlobalFilter = true,
  enableRowSelection = false,
  enablePagination = true,
}: UseDataTableOptions<T>) {
  const [sorting, setSorting] = useState<SortingState[]>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>(initialColumnFilters);
  const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter);
  const [pagination, setPagination] = useState(initialPagination);
  const [rowSelection, setRowSelection] = useState(initialRowSelection);

  // Reset pagination when filters change
  React.useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter, columnFilters]);

  return {
    // State
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    rowSelection,
    setRowSelection,
    
    // Props for DataTable
    tableProps: {
      data,
      columns,
      sorting,
      onSortingChange: setSorting,
      columnFilters,
      onColumnFiltersChange: setColumnFilters,
      globalFilter,
      onGlobalFilterChange: setGlobalFilter,
      pagination,
      onPaginationChange: setPagination,
      rowSelection,
      onRowSelectionChange: setRowSelection,
      enableSorting,
      enableFiltering,
      enableGlobalFilter,
      enableRowSelection,
      enablePagination,
    } as DataTableProps<T>,
  };
}

export default DataTable;