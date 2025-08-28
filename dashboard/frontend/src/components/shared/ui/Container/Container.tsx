import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const containerVariants = cva(
  'mx-auto w-full',
  {
    variants: {
      size: {
        sm: 'max-w-screen-sm',
        md: 'max-w-screen-md',
        lg: 'max-w-screen-lg',
        xl: 'max-w-screen-xl',
        '2xl': 'max-w-screen-2xl',
        full: 'max-w-full',
        prose: 'max-w-prose',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        '6xl': 'max-w-6xl',
        '7xl': 'max-w-7xl',
      },
      padding: {
        none: '',
        sm: 'px-4 sm:px-6',
        md: 'px-4 sm:px-6 lg:px-8',
        lg: 'px-6 sm:px-8 lg:px-12',
        xl: 'px-8 sm:px-12 lg:px-16',
      },
      center: {
        true: 'mx-auto',
        false: '',
      },
    },
    defaultVariants: {
      size: 'lg',
      padding: 'md',
      center: true,
    },
  }
);

export interface ContainerProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  as?: keyof JSX.IntrinsicElements;
  fluid?: boolean;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size, padding, center, as: Component = 'div', fluid, ...props }, ref) => {
    const Comp = Component as any;
    
    return (
      <Comp
        className={cn(
          containerVariants({ 
            size: fluid ? 'full' : size, 
            padding, 
            center: fluid ? false : center 
          }),
          fluid && 'px-4 sm:px-6 lg:px-8',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Container.displayName = 'Container';

// Specialized container components
export const PageContainer: React.FC<ContainerProps> = ({ children, ...props }) => (
  <Container size="xl" padding="lg" {...props}>
    {children}
  </Container>
);

export const ContentContainer: React.FC<ContainerProps> = ({ children, ...props }) => (
  <Container size="4xl" padding="md" {...props}>
    {children}
  </Container>
);

export const NarrowContainer: React.FC<ContainerProps> = ({ children, ...props }) => (
  <Container size="2xl" padding="md" {...props}>
    {children}
  </Container>
);

export const WideContainer: React.FC<ContainerProps> = ({ children, ...props }) => (
  <Container size="7xl" padding="lg" {...props}>
    {children}
  </Container>
);

export const FluidContainer: React.FC<ContainerProps> = ({ children, ...props }) => (
  <Container fluid {...props}>
    {children}
  </Container>
);

export default Container;