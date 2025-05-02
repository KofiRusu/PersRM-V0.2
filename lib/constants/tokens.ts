// Design tokens for PersRM UI system

// Color system
export const colors = {
  // Primary palette
  primary: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1', // Primary brand color
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
    950: '#1E1B4B',
  },
  
  // Neutrals for UI
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0D1117',
  },
  
  // Semantic colors
  success: {
    light: '#ECFDF5',
    main: '#10B981',
    dark: '#065F46',
  },
  warning: {
    light: '#FFFBEB',
    main: '#F59E0B',
    dark: '#92400E',
  },
  error: {
    light: '#FEF2F2',
    main: '#EF4444',
    dark: '#991B1B',
  },
  info: {
    light: '#EFF6FF',
    main: '#3B82F6',
    dark: '#1E40AF',
  },
}

// Typography system
export const typography = {
  fontFamily: {
    sans: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    none: '1',
    tight: '1.25',
    normal: '1.5',
    loose: '2',
  },
}

// Spacing system
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
}

// Breakpoints for responsive design
export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
}

// Component styles
export const componentStyles = {
  // Button variants
  button: {
    primary: {
      backgroundColor: colors.primary[600],
      color: 'white',
      hoverBackgroundColor: colors.primary[700],
    },
    secondary: {
      backgroundColor: colors.neutral[200],
      color: colors.neutral[800],
      hoverBackgroundColor: colors.neutral[300],
    },
    outline: {
      backgroundColor: 'transparent',
      color: colors.primary[600],
      border: `1px solid ${colors.primary[600]}`,
      hoverBackgroundColor: colors.primary[50],
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.primary[600],
      hoverBackgroundColor: colors.primary[50],
    },
    destructive: {
      backgroundColor: colors.error.main,
      color: 'white',
      hoverBackgroundColor: colors.error.dark,
    },
  },
  
  // Card styles
  card: {
    default: {
      backgroundColor: 'hsl(var(--card))',
      color: 'hsl(var(--card-foreground))',
      borderRadius: '0.5rem',
    },
    elevated: {
      backgroundColor: 'hsl(var(--card))',
      color: 'hsl(var(--card-foreground))',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    },
  },
} 