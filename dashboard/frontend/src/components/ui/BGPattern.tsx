import React from 'react';

// Utility function for className merging
const cn = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface BGPatternProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'dots' | 'grid' | 'diagonal-stripes' | 'horizontal-lines' | 'vertical-lines' | 'checkerboard';
  mask?: 'fade-edges' | 'fade-center' | 'fade-top' | 'fade-bottom' | 'fade-left' | 'fade-right' | 'fade-x' | 'fade-y' | 'none';
  size?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}

const BGPattern: React.FC<BGPatternProps> = React.memo(({ 
  variant = 'grid', 
  mask = 'fade-edges', 
  size = 24, 
  fill = '#1e293b', 
  className, 
  style, 
  ...props 
}) => {
  const maskClasses: Record<string, string> = {
    'fade-edges': '[mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]',
    'fade-center': '[mask-image:radial-gradient(ellipse_at_center,transparent,var(--background))]',
    'fade-top': '[mask-image:linear-gradient(to_bottom,transparent,var(--background))]',
    'fade-bottom': '[mask-image:linear-gradient(to_bottom,var(--background),transparent)]',
    'fade-left': '[mask-image:linear-gradient(to_right,transparent,var(--background))]',
    'fade-right': '[mask-image:linear-gradient(to_right,var(--background),transparent)]',
    'fade-x': '[mask-image:linear-gradient(to_right,transparent,var(--background),transparent)]',
    'fade-y': '[mask-image:linear-gradient(to_bottom,transparent,var(--background),transparent)]',
    'none': '',
  };

  const getBgImage = (variant: string, fill: string, size: number) => {
    switch (variant) {
      case 'dots':
        return `radial-gradient(${fill} 1px, transparent 1px)`;
      case 'grid':
        return `linear-gradient(to right, ${fill} 1px, transparent 1px), linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
      case 'diagonal-stripes':
        return `repeating-linear-gradient(45deg, ${fill}, ${fill} 1px, transparent 1px, transparent ${size}px)`;
      case 'horizontal-lines':
        return `linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
      case 'vertical-lines':
        return `linear-gradient(to right, ${fill} 1px, transparent 1px)`;
      case 'checkerboard':
        return `linear-gradient(45deg, ${fill} 25%, transparent 25%), linear-gradient(-45deg, ${fill} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${fill} 75%), linear-gradient(-45deg, transparent 75%, ${fill} 75%)`;
      default:
        return undefined;
    }
  };

  const bgSize = `${size}px ${size}px`;
  const backgroundImage = getBgImage(variant, fill, size);

  return (
    <div
      className={cn('absolute inset-0 z-[-10] size-full', maskClasses[mask], className)}
      style={{
        backgroundImage,
        backgroundSize: bgSize,
        ...style,
      }}
      {...props}
    />
  );
});

BGPattern.displayName = 'BGPattern';

export { BGPattern };
export type { BGPatternProps };