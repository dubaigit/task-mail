import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const gridVariants = cva(
  'grid',
  {
    variants: {
      cols: {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
        6: 'grid-cols-6',
        7: 'grid-cols-7',
        8: 'grid-cols-8',
        9: 'grid-cols-9',
        10: 'grid-cols-10',
        11: 'grid-cols-11',
        12: 'grid-cols-12',
        none: 'grid-cols-none',
        subgrid: 'grid-cols-subgrid',
      },
      rows: {
        1: 'grid-rows-1',
        2: 'grid-rows-2',
        3: 'grid-rows-3',
        4: 'grid-rows-4',
        5: 'grid-rows-5',
        6: 'grid-rows-6',
        none: 'grid-rows-none',
        subgrid: 'grid-rows-subgrid',
      },
      gap: {
        0: 'gap-0',
        1: 'gap-1',
        2: 'gap-2',
        3: 'gap-3',
        4: 'gap-4',
        5: 'gap-5',
        6: 'gap-6',
        8: 'gap-8',
        10: 'gap-10',
        12: 'gap-12',
        16: 'gap-16',
      },
      gapX: {
        0: 'gap-x-0',
        1: 'gap-x-1',
        2: 'gap-x-2',
        3: 'gap-x-3',
        4: 'gap-x-4',
        5: 'gap-x-5',
        6: 'gap-x-6',
        8: 'gap-x-8',
        10: 'gap-x-10',
        12: 'gap-x-12',
        16: 'gap-x-16',
      },
      gapY: {
        0: 'gap-y-0',
        1: 'gap-y-1',
        2: 'gap-y-2',
        3: 'gap-y-3',
        4: 'gap-y-4',
        5: 'gap-y-5',
        6: 'gap-y-6',
        8: 'gap-y-8',
        10: 'gap-y-10',
        12: 'gap-y-12',
        16: 'gap-y-16',
      },
    },
    defaultVariants: {
      cols: 1,
      gap: 0,
    },
  }
);

export interface GridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {
  as?: keyof JSX.IntrinsicElements;
  templateCols?: string;
  templateRows?: string;
  autoRows?: string;
  autoCols?: string;
  autoFlow?: 'row' | 'col' | 'dense' | 'row-dense' | 'col-dense';
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ 
    className, 
    cols, 
    rows, 
    gap, 
    gapX, 
    gapY,
    as: Component = 'div',
    templateCols,
    templateRows,
    autoRows,
    autoCols,
    autoFlow,
    style,
    ...props 
  }, ref) => {
    const Comp = Component as any;
    
    const gridStyle: React.CSSProperties = {
      ...style,
      ...(templateCols && { gridTemplateColumns: templateCols }),
      ...(templateRows && { gridTemplateRows: templateRows }),
      ...(autoRows && { gridAutoRows: autoRows }),
      ...(autoCols && { gridAutoColumns: autoCols }),
    };

    const autoFlowClasses = {
      row: 'grid-flow-row',
      col: 'grid-flow-col',
      dense: 'grid-flow-dense',
      'row-dense': 'grid-flow-row-dense',
      'col-dense': 'grid-flow-col-dense',
    };
    
    return (
      <Comp
        className={cn(
          gridVariants({ cols, rows, gap, gapX, gapY }),
          autoFlow && autoFlowClasses[autoFlow],
          className
        )}
        style={gridStyle}
        ref={ref}
        {...props}
      />
    );
  }
);

Grid.displayName = 'Grid';

// Grid item component
export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: number | 'full' | 'auto';
  rowSpan?: number | 'full' | 'auto';
  colStart?: number | 'auto';
  colEnd?: number | 'auto';
  rowStart?: number | 'auto';
  rowEnd?: number | 'auto';
  area?: string;
  as?: keyof JSX.IntrinsicElements;
}

export const GridItem = React.forwardRef<HTMLDivElement, GridItemProps>(
  ({ 
    className, 
    colSpan, 
    rowSpan, 
    colStart, 
    colEnd, 
    rowStart, 
    rowEnd,
    area,
    as: Component = 'div',
    style,
    ...props 
  }, ref) => {
    const Comp = Component as any;
    
    const getColSpanClass = (span: number | 'full' | 'auto') => {
      if (span === 'full') return 'col-span-full';
      if (span === 'auto') return 'col-auto';
      if (typeof span === 'number' && span >= 1 && span <= 12) {
        return `col-span-${span}`;
      }
      return '';
    };

    const getRowSpanClass = (span: number | 'full' | 'auto') => {
      if (span === 'full') return 'row-span-full';
      if (span === 'auto') return 'row-auto';
      if (typeof span === 'number' && span >= 1 && span <= 6) {
        return `row-span-${span}`;
      }
      return '';
    };

    const getColStartClass = (start: number | 'auto') => {
      if (start === 'auto') return 'col-start-auto';
      if (typeof start === 'number' && start >= 1 && start <= 13) {
        return `col-start-${start}`;
      }
      return '';
    };

    const getColEndClass = (end: number | 'auto') => {
      if (end === 'auto') return 'col-end-auto';
      if (typeof end === 'number' && end >= 1 && end <= 13) {
        return `col-end-${end}`;
      }
      return '';
    };

    const getRowStartClass = (start: number | 'auto') => {
      if (start === 'auto') return 'row-start-auto';
      if (typeof start === 'number' && start >= 1 && start <= 7) {
        return `row-start-${start}`;
      }
      return '';
    };

    const getRowEndClass = (end: number | 'auto') => {
      if (end === 'auto') return 'row-end-auto';
      if (typeof end === 'number' && end >= 1 && end <= 7) {
        return `row-end-${end}`;
      }
      return '';
    };

    const gridStyle: React.CSSProperties = {
      ...style,
      ...(area && { gridArea: area }),
    };
    
    return (
      <Comp
        className={cn(
          colSpan && getColSpanClass(colSpan),
          rowSpan && getRowSpanClass(rowSpan),
          colStart && getColStartClass(colStart),
          colEnd && getColEndClass(colEnd),
          rowStart && getRowStartClass(rowStart),
          rowEnd && getRowEndClass(rowEnd),
          className
        )}
        style={gridStyle}
        ref={ref}
        {...props}
      />
    );
  }
);

GridItem.displayName = 'GridItem';

// Specialized Grid components
export const ResponsiveGrid: React.FC<GridProps & {
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  '2xl'?: number;
}> = ({ 
  children, 
  sm, 
  md, 
  lg, 
  xl, 
  '2xl': xl2,
  className,
  ...props 
}) => {
  const responsiveClasses = cn(
    sm && `sm:grid-cols-${sm}`,
    md && `md:grid-cols-${md}`,
    lg && `lg:grid-cols-${lg}`,
    xl && `xl:grid-cols-${xl}`,
    xl2 && `2xl:grid-cols-${xl2}`,
  );

  return (
    <Grid className={cn(responsiveClasses, className)} {...props}>
      {children}
    </Grid>
  );
};

export const AutoFitGrid: React.FC<GridProps & {
  minWidth?: string;
  maxWidth?: string;
}> = ({ 
  children, 
  minWidth = '250px', 
  maxWidth = '1fr',
  style,
  ...props 
}) => (
  <Grid 
    style={{
      ...style,
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, ${maxWidth}))`,
    }}
    {...props}
  >
    {children}
  </Grid>
);

export const AutoFillGrid: React.FC<GridProps & {
  minWidth?: string;
  maxWidth?: string;
}> = ({ 
  children, 
  minWidth = '250px', 
  maxWidth = '1fr',
  style,
  ...props 
}) => (
  <Grid 
    style={{
      ...style,
      gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, ${maxWidth}))`,
    }}
    {...props}
  >
    {children}
  </Grid>
);

export default Grid;