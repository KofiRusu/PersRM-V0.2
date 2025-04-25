import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';
import { themingEngine, ThemeId, ThemeTokens, useTheme } from './index';

// Create React Context for theme
const ThemeContext = createContext<{
  theme: ThemeTokens;
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  themingEngine: typeof themingEngine;
}>({
  theme: themingEngine.getActiveTheme(),
  themeId: themingEngine.getActiveThemeId(),
  setTheme: themingEngine.setTheme.bind(themingEngine),
  themingEngine,
});

export interface ThemeProviderProps {
  defaultTheme?: ThemeId;
  storageKey?: string;
  children: React.ReactNode;
}

export function ThemeProvider({
  defaultTheme = 'light',
  storageKey = 'perslm-theme',
  children,
}: ThemeProviderProps) {
  // Initialize with active theme from ThemingEngine
  const [themeId, setThemeId] = useState<ThemeId>(themingEngine.getActiveThemeId());
  const [theme, setTheme] = useState<ThemeTokens>(themingEngine.getActiveTheme());

  // Load theme from storage on initial render
  useEffect(() => {
    // Add listener for theme changes
    const removeListener = themingEngine.addListener((newThemeId: ThemeId) => {
      setThemeId(newThemeId);
      setTheme(themingEngine.getTheme(newThemeId));
    });

    // Set initial theme if not already set
    if (themeId !== themingEngine.getActiveThemeId()) {
      themingEngine.setTheme(themeId);
    }

    return () => {
      removeListener();
    };
  }, []);

  // Handle theme changes
  const handleSetTheme = (newThemeId: ThemeId) => {
    themingEngine.setTheme(newThemeId);
  };

  // Value object for context
  const value = {
    theme,
    themeId,
    setTheme: handleSetTheme,
    themingEngine,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Export context and hooks
export { ThemeContext, useTheme };

// Example component to create a theme toggle
export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { themeId, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(themeId === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      className={className}
      onClick={toggleTheme}
      aria-label={`Switch to ${themeId === 'dark' ? 'light' : 'dark'} theme`}
    >
      {themeId === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

// Example component for a theme selector
export interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { themeId, setTheme, themingEngine } = useTheme();
  const themeIds = themingEngine.getThemeIds();
  const themes = themingEngine.getThemes();

  return (
    <select
      className={className}
      value={themeId}
      onChange={(e) => setTheme(e.target.value as ThemeId)}
      aria-label="Select theme"
    >
      {themeIds.map((id) => (
        <option key={id} value={id}>
          {themes[id]?.name || id}
        </option>
      ))}
    </select>
  );
}

// Example component that uses theme values
export interface ThemedComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export function ThemedComponent({ className, children }: ThemedComponentProps) {
  const { theme } = useTheme();

  const style = {
    backgroundColor: theme.colors.background,
    color: theme.colors.foreground,
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    boxShadow: theme.shadows.md,
  };

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

// Example Alert component showing theme integration
export interface AlertProps extends PropsWithChildren {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  className?: string;
}

export function Alert({ 
  variant = 'default', 
  className = '', 
  children 
}: AlertProps) {
  const { theme } = useTheme();
  
  // Map variant to theme colors
  const variantStyles = {
    default: {
      bg: theme.colors.muted,
      border: theme.colors.border,
      text: theme.colors.foreground,
    },
    destructive: {
      bg: theme.colors.destructive['50'],
      border: theme.colors.destructive['200'],
      text: theme.colors.destructive['700'],
    },
    success: {
      bg: theme.colors.success['50'],
      border: theme.colors.success['200'],
      text: theme.colors.success['700'],
    },
    warning: {
      bg: theme.colors.warning['50'],
      border: theme.colors.warning['200'],
      text: theme.colors.warning['700'],
    },
  };
  
  const style = {
    backgroundColor: variantStyles[variant].bg,
    borderColor: variantStyles[variant].border,
    color: variantStyles[variant].text,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[4],
  };
  
  return (
    <div className={className} style={style} role="alert">
      {children}
    </div>
  );
} 