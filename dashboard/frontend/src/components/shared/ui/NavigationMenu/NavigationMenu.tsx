import React, { forwardRef, createContext, useContext, useState, useRef, useEffect } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const navigationMenuVariants = cva(
  'relative z-10 flex max-w-max flex-1 items-center justify-center',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
);

const navigationMenuListVariants = cva(
  'group flex flex-1 list-none items-center justify-center space-x-1',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row space-x-1 space-y-0',
        vertical: 'flex-col space-x-0 space-y-1',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
);

const navigationMenuItemVariants = cva('relative');

const navigationMenuTriggerVariants = cva(
  'group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50',
  {
    variants: {
      size: {
        sm: 'h-8 px-2 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const navigationMenuContentVariants = cva(
  'absolute top-0 left-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto',
  {
    variants: {
      orientation: {
        horizontal: 'top-full mt-1',
        vertical: 'left-full top-0 ml-1',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
);

const navigationMenuLinkVariants = cva(
  'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
);

const navigationMenuIndicatorVariants = cva(
  'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
  {
    variants: {
      orientation: {
        horizontal: 'top-full',
        vertical: 'left-full top-0',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
);

// Context for NavigationMenu
interface NavigationMenuContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  delayDuration: number;
  skipDelayDuration: number;
  dir: 'ltr' | 'rtl';
}

const NavigationMenuContext = createContext<NavigationMenuContextValue | undefined>(undefined);

const useNavigationMenu = () => {
  const context = useContext(NavigationMenuContext);
  if (!context) {
    throw new Error('NavigationMenu components must be used within NavigationMenu');
  }
  return context;
};

// NavigationMenu Root
export interface NavigationMenuProps extends 
  React.HTMLAttributes<HTMLElement>,
  VariantProps<typeof navigationMenuVariants> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  delayDuration?: number;
  skipDelayDuration?: number;
  dir?: 'ltr' | 'rtl';
}

export const NavigationMenu = forwardRef<HTMLElement, NavigationMenuProps>(
  ({
    className,
    children,
    orientation = 'horizontal',
    value,
    defaultValue,
    onValueChange,
    delayDuration = 200,
    skipDelayDuration = 300,
    dir = 'ltr',
    ...props
  }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue || '');
    
    const currentValue = value !== undefined ? value : internalValue;
    const handleValueChange = (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <NavigationMenuContext.Provider
        value={{
          value: currentValue,
          onValueChange: handleValueChange,
          orientation: orientation || 'horizontal',
          delayDuration,
          skipDelayDuration,
          dir,
        }}
      >
        <nav
          ref={ref}
          className={cn(navigationMenuVariants({ orientation }), className)}
          dir={dir}
          {...props}
        >
          {children}
        </nav>
      </NavigationMenuContext.Provider>
    );
  }
);

NavigationMenu.displayName = 'NavigationMenu';

// NavigationMenuList
export interface NavigationMenuListProps extends React.HTMLAttributes<HTMLUListElement> {}

export const NavigationMenuList = forwardRef<HTMLUListElement, NavigationMenuListProps>(
  ({ className, ...props }, ref) => {
    const { orientation } = useNavigationMenu();
    
    return (
      <ul
        ref={ref}
        className={cn(navigationMenuListVariants({ orientation }), className)}
        {...props}
      />
    );
  }
);

NavigationMenuList.displayName = 'NavigationMenuList';

// NavigationMenuItem
export interface NavigationMenuItemProps extends React.HTMLAttributes<HTMLLIElement> {}

export const NavigationMenuItem = forwardRef<HTMLLIElement, NavigationMenuItemProps>(
  ({ className, ...props }, ref) => {
    return (
      <li
        ref={ref}
        className={cn(navigationMenuItemVariants(), className)}
        {...props}
      />
    );
  }
);

NavigationMenuItem.displayName = 'NavigationMenuItem';

// NavigationMenuTrigger
export interface NavigationMenuTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const NavigationMenuTrigger = forwardRef<HTMLButtonElement, NavigationMenuTriggerProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(navigationMenuTriggerVariants({ size }), className)}
        {...props}
      />
    );
  }
);

NavigationMenuTrigger.displayName = 'NavigationMenuTrigger';

// NavigationMenuContent
export interface NavigationMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const NavigationMenuContent = forwardRef<HTMLDivElement, NavigationMenuContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(navigationMenuContentVariants(), className)}
        {...props}
      />
    );
  }
);

NavigationMenuContent.displayName = 'NavigationMenuContent';

// NavigationMenuLink
export interface NavigationMenuLinkProps extends React.HTMLAttributes<HTMLAnchorElement> {
  href?: string;
}

export const NavigationMenuLink = forwardRef<HTMLAnchorElement, NavigationMenuLinkProps>(
  ({ className, href, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        className={cn(navigationMenuLinkVariants(), className)}
        {...props}
      />
    );
  }
);

NavigationMenuLink.displayName = 'NavigationMenuLink';

// NavigationMenuIndicator
export interface NavigationMenuIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export const NavigationMenuIndicator = forwardRef<HTMLDivElement, NavigationMenuIndicatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(navigationMenuIndicatorVariants(), className)}
        {...props}
      />
    );
  }
);

NavigationMenuIndicator.displayName = 'NavigationMenuIndicator';

// NavigationMenuViewport
export interface NavigationMenuViewportProps extends React.HTMLAttributes<HTMLDivElement> {}

export const NavigationMenuViewport = forwardRef<HTMLDivElement, NavigationMenuViewportProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="absolute left-0 top-full flex justify-center">
        <div
          ref={ref}
          className={cn(
            'origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

NavigationMenuViewport.displayName = 'NavigationMenuViewport';

// Utility Components

// NavigationMenuSub for nested menus
export interface NavigationMenuSubProps extends NavigationMenuProps {}

export const NavigationMenuSub = forwardRef<HTMLElement, NavigationMenuSubProps>(
  ({ className, ...props }, ref) => {
    return (
      <NavigationMenu
        ref={ref}
        className={cn('relative', className)}
        {...props}
      />
    );
  }
);

NavigationMenuSub.displayName = 'NavigationMenuSub';

// NavigationMenuGroup for grouping items
export interface NavigationMenuGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export const NavigationMenuGroup = forwardRef<HTMLDivElement, NavigationMenuGroupProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('grid gap-3 p-4', className)}
        {...props}
      >
        {title && (
          <div className="text-sm font-medium leading-none text-muted-foreground">
            {title}
          </div>
        )}
        {children}
      </div>
    );
  }
);

NavigationMenuGroup.displayName = 'NavigationMenuGroup';

// NavigationMenuSeparator
export interface NavigationMenuSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export const NavigationMenuSeparator = forwardRef<HTMLDivElement, NavigationMenuSeparatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('mx-1 h-4 w-px bg-border', className)}
        role="separator"
        aria-orientation="vertical"
        {...props}
      />
    );
  }
);

NavigationMenuSeparator.displayName = 'NavigationMenuSeparator';

export default NavigationMenu;