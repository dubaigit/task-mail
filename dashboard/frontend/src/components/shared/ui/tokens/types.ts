// Design Token Types
// TypeScript definitions for the design system

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface TypographyScale {
  fontFamily: {
    sans: string[];
    mono: string[];
  };
  fontSize: {
    [key: string]: [string, { lineHeight: string }] | [string];
  };
  fontWeight: {
    [key: string]: string;
  };
}

export interface SpacingScale {
  [key: string]: string;
}

export interface BreakpointScale {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface BorderRadiusScale {
  none: string;
  sm: string;
  DEFAULT: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  full: string;
}

export interface BoxShadowScale {
  sm: string;
  DEFAULT: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
  none: string;
}

export interface AnimationTokens {
  duration: {
    [key: string]: string;
  };
  timingFunction: {
    [key: string]: string;
  };
}

export interface ZIndexScale {
  [key: string]: string;
}

export interface DesignTokens {
  colors: {
    primary: ColorScale;
    neutral: ColorScale;
    success: ColorScale;
    error: ColorScale;
    warning: ColorScale;
    info: ColorScale;
  };
  typography: TypographyScale;
  spacing: SpacingScale;
  breakpoints: BreakpointScale;
  borderRadius: BorderRadiusScale;
  boxShadow: BoxShadowScale;
  animation: AnimationTokens;
  zIndex: ZIndexScale;
}

// Component variant types
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ComponentVariant = 'default' | 'outline' | 'ghost' | 'link';
export type ComponentColor = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  mode: ThemeMode;
  tokens: DesignTokens;
}
