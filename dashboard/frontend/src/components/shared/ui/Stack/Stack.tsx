import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const stackVariants = cva(
  'flex',
  {
    variants: {
      direction: {
        vertical: 'flex-col',
        horizontal: 'flex-row',
      },
      spacing: {
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
      align: {
        start: 'items-start',
        center: 'items-center',
        end: 'items-end',
        stretch: 'items-stretch',
        baseline: 'items-baseline',
      },
      justify: {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end',
        between: 'justify-between',
        around: 'justify-around',
        evenly: 'justify-evenly',
      },
    },
    defaultVariants: {
      direction: 'vertical',
      spacing: 0,
      align: 'stretch',
      justify: 'start',
    },
  }
);

export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackVariants> {
  as?: keyof JSX.IntrinsicElements;
  divider?: React.ReactNode;
  wrap?: boolean;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ 
    className, 
    direction, 
    spacing, 
    align, 
    justify, 
    as: Component = 'div', 
    divider,
    wrap = false,
    children,
    ...props 
  }, ref) => {
    const Comp = Component as any;
    
    const childrenArray = React.Children.toArray(children);
    const stackChildren = divider 
      ? childrenArray.reduce<React.ReactNode[]>((acc, child, index) => {
          acc.push(child);
          if (index < childrenArray.length - 1) {
            acc.push(
              <div key={`divider-${index}`} className="flex-shrink-0">
                {divider}
              </div>
            );
          }
          return acc;
        }, [])
      : children;
    
    return (
      <Comp
        className={cn(
          stackVariants({ direction, spacing, align, justify }),
          wrap && 'flex-wrap',
          className
        )}
        ref={ref}
        {...props}
      >
        {stackChildren}
      </Comp>
    );
  }
);

Stack.displayName = 'Stack';

// Specialized Stack components
export const VStack: React.FC<StackProps> = ({ 
  children, 
  spacing = 4,
  align = 'stretch',
  ...props 
}) => (
  <Stack direction="vertical" spacing={spacing} align={align} {...props}>
    {children}
  </Stack>
);

export const HStack: React.FC<StackProps> = ({ 
  children, 
  spacing = 4,
  align = 'center',
  ...props 
}) => (
  <Stack direction="horizontal" spacing={spacing} align={align} {...props}>
    {children}
  </Stack>
);

export const StackDivider: React.FC<{
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}> = ({ orientation = 'horizontal', className }) => {
  const dividerClasses = {
    horizontal: 'h-px w-full bg-gray-200',
    vertical: 'w-px h-full bg-gray-200',
  };

  return <div className={cn(dividerClasses[orientation], className)} />;
};

export const StackItem: React.FC<React.HTMLAttributes<HTMLDivElement> & {
  flex?: string | number;
  as?: keyof JSX.IntrinsicElements;
}> = ({ 
  className, 
  flex,
  as: Component = 'div',
  style,
  ...props 
}) => {
  const Comp = Component as any;
  
  return (
    <Comp
      className={cn('min-w-0', className)}
      style={{
        ...style,
        ...(flex && { flex }),
      }}
      {...props}
    />
  );
};

export default Stack;