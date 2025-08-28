import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const flexVariants = cva(
  'flex',
  {
    variants: {
      direction: {
        row: 'flex-row',
        'row-reverse': 'flex-row-reverse',
        col: 'flex-col',
        'col-reverse': 'flex-col-reverse',
      },
      align: {
        start: 'items-start',
        center: 'items-center',
        end: 'items-end',
        baseline: 'items-baseline',
        stretch: 'items-stretch',
      },
      justify: {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end',
        between: 'justify-between',
        around: 'justify-around',
        evenly: 'justify-evenly',
      },
      wrap: {
        nowrap: 'flex-nowrap',
        wrap: 'flex-wrap',
        'wrap-reverse': 'flex-wrap-reverse',
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
    },
    defaultVariants: {
      direction: 'row',
      align: 'start',
      justify: 'start',
      wrap: 'nowrap',
      gap: 0,
    },
  }
);

export interface FlexProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof flexVariants> {
  as?: keyof JSX.IntrinsicElements;
  inline?: boolean;
}

export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  ({ 
    className, 
    direction, 
    align, 
    justify, 
    wrap, 
    gap, 
    as: Component = 'div', 
    inline = false,
    ...props 
  }, ref) => {
    const Comp = Component as any;
    
    return (
      <Comp
        className={cn(
          inline ? 'inline-flex' : 'flex',
          flexVariants({ direction, align, justify, wrap, gap }),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Flex.displayName = 'Flex';

// Specialized Flex components for common patterns
export const HStack: React.FC<FlexProps> = ({ children, align = 'center', gap = 2, ...props }) => (
  <Flex direction="row" align={align} gap={gap} {...props}>
    {children}
  </Flex>
);

export const VStack: React.FC<FlexProps> = ({ children, align = 'stretch', gap = 2, ...props }) => (
  <Flex direction="col" align={align} gap={gap} {...props}>
    {children}
  </Flex>
);

export const Center: React.FC<FlexProps> = ({ children, ...props }) => (
  <Flex align="center" justify="center" {...props}>
    {children}
  </Flex>
);

export const Spacer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex-1', className)} {...props} />
);

// Utility component for flex items
export interface FlexItemProps extends React.HTMLAttributes<HTMLDivElement> {
  flex?: string | number;
  grow?: boolean | number;
  shrink?: boolean | number;
  basis?: string;
  order?: number;
  alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  as?: keyof JSX.IntrinsicElements;
}

export const FlexItem = React.forwardRef<HTMLDivElement, FlexItemProps>(
  ({ 
    className, 
    flex, 
    grow, 
    shrink, 
    basis, 
    order, 
    alignSelf,
    as: Component = 'div',
    style,
    ...props 
  }, ref) => {
    const Comp = Component as any;
    
    const flexStyle: React.CSSProperties = {
      ...style,
      ...(flex && { flex }),
      ...(basis && { flexBasis: basis }),
      ...(typeof grow === 'number' && { flexGrow: grow }),
      ...(typeof shrink === 'number' && { flexShrink: shrink }),
      ...(order && { order }),
    };

    const alignSelfClasses = {
      auto: 'self-auto',
      start: 'self-start',
      center: 'self-center',
      end: 'self-end',
      baseline: 'self-baseline',
      stretch: 'self-stretch',
    };

    return (
      <Comp
        className={cn(
          grow === true && 'flex-grow',
          shrink === true && 'flex-shrink',
          shrink === false && 'flex-shrink-0',
          alignSelf && alignSelfClasses[alignSelf],
          className
        )}
        style={flexStyle}
        ref={ref}
        {...props}
      />
    );
  }
);

FlexItem.displayName = 'FlexItem';

export default Flex;