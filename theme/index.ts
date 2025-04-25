import { createContext, useContext, useState, useEffect } from 'react';
import tokens from './tokens.json';

// Type definitions
export type ThemeId = 'light' | 'dark' | 'brand' | string;

export interface ThemeTokens {
  id: string;
  name: string;
  extends?: string;
  colors: {
    primary: Record<string, string>;
    secondary: Record<string, string>;
    destructive: Record<string, string>;
    success: Record<string, string>;
    warning: Record<string, string>;
    background: string;
    foreground: string;
    card: string;
    'card-foreground': string;
    popover: string;
    'popover-foreground': string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    border: string;
    input: string;
    ring: string;
    [key: string]: any;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    full: string;
    [key: string]: string;
  };
  typography: {
    fontFamily: {
      sans: string[];
      mono: string[];
      [key: string]: string[];
    };
    fontSize: Record<string, [string, { lineHeight: string } | any]>;
    fontWeight: Record<string, string>;
  };
  spacing: Record<string, string>;
  shadows: Record<string, string>;
  animation: {
    fast: string;
    normal: string;
    slow: string;
    [key: string]: string;
  };
  [key: string]: any;
}

export type ThemeMap = Record<ThemeId, ThemeTokens>;

// ThemingEngine class
export class ThemingEngine {
  private themes: ThemeMap;
  private activeThemeId: ThemeId;
  private listeners: Set<(themeId: ThemeId) => void>;
  private defaultThemeId: ThemeId;
  
  constructor(themes?: ThemeMap, defaultThemeId: ThemeId = 'light') {
    this.themes = themes || (tokens.themes as ThemeMap);
    this.defaultThemeId = defaultThemeId;
    this.activeThemeId = this.loadSavedTheme() || defaultThemeId;
    this.listeners = new Set();
    
    // Apply the active theme on initialization
    this.applyTheme(this.activeThemeId);
  }
  
  // Get all available themes
  public getThemes(): ThemeMap {
    return this.themes;
  }
  
  // Get a list of available theme IDs
  public getThemeIds(): ThemeId[] {
    return Object.keys(this.themes);
  }
  
  // Get current active theme ID
  public getActiveThemeId(): ThemeId {
    return this.activeThemeId;
  }
  
  // Get the active theme tokens
  public getActiveTheme(): ThemeTokens {
    return this.getTheme(this.activeThemeId);
  }
  
  // Get a specific theme by ID
  public getTheme(themeId: ThemeId): ThemeTokens {
    const theme = this.themes[themeId];
    
    if (!theme) {
      console.warn(`Theme "${themeId}" not found, using default theme "${this.defaultThemeId}"`);
      return this.themes[this.defaultThemeId];
    }
    
    // If theme extends another theme, merge them
    if (theme.extends && this.themes[theme.extends]) {
      const baseTheme = this.themes[theme.extends];
      return this.mergeThemes(baseTheme, theme);
    }
    
    return theme;
  }
  
  // Set and apply a theme
  public setTheme(themeId: ThemeId): void {
    if (!this.themes[themeId]) {
      console.warn(`Theme "${themeId}" not found, using default theme "${this.defaultThemeId}"`);
      themeId = this.defaultThemeId;
    }
    
    this.activeThemeId = themeId;
    this.saveTheme(themeId);
    this.applyTheme(themeId);
    this.notifyListeners(themeId);
  }
  
  // Register a theme change listener
  public addListener(listener: (themeId: ThemeId) => void): () => void {
    this.listeners.add(listener);
    
    // Return a function to remove this listener
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  // Add or update a theme
  public addTheme(themeId: ThemeId, theme: Partial<ThemeTokens>): void {
    // Handle extends
    if (theme.extends && this.themes[theme.extends]) {
      const baseTheme = this.themes[theme.extends];
      this.themes[themeId] = this.mergeThemes(baseTheme, theme as ThemeTokens);
    } else {
      // If no extends or base theme doesn't exist, ensure it has all required properties
      const baseTheme = this.themes[this.defaultThemeId];
      this.themes[themeId] = this.mergeThemes(baseTheme, theme as ThemeTokens);
    }
    
    // If the active theme was updated, reapply it
    if (this.activeThemeId === themeId) {
      this.applyTheme(themeId);
      this.notifyListeners(themeId);
    }
  }
  
  // Remove a theme
  public removeTheme(themeId: ThemeId): boolean {
    // Don't allow removing the default theme
    if (themeId === this.defaultThemeId) {
      console.warn("Cannot remove the default theme");
      return false;
    }
    
    // If the active theme is being removed, switch to default
    if (this.activeThemeId === themeId) {
      this.setTheme(this.defaultThemeId);
    }
    
    // Remove the theme
    const success = delete this.themes[themeId];
    return success;
  }
  
  // Export themes to JSON
  public exportThemesToJSON(): string {
    return JSON.stringify({ themes: this.themes }, null, 2);
  }
  
  // Import themes from JSON
  public importThemesFromJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.themes) {
        this.themes = data.themes;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to import themes:", error);
      return false;
    }
  }
  
  // Extract design tokens from a Figma JSON export
  public extractFromFigma(figmaData: any): Partial<ThemeTokens> {
    // This is a placeholder for Figma integration
    // A real implementation would parse Figma tokens format
    console.warn("Figma import not yet implemented");
    return {};
  }
  
  // Generate a Tailwind config
  public generateTailwindConfig(): any {
    const theme = this.getActiveTheme();
    
    return {
      theme: {
        extend: {
          colors: {
            primary: theme.colors.primary,
            secondary: theme.colors.secondary,
            destructive: theme.colors.destructive,
            success: theme.colors.success,
            warning: theme.colors.warning,
            background: theme.colors.background,
            foreground: theme.colors.foreground,
            card: theme.colors.card,
            "card-foreground": theme.colors["card-foreground"],
            popover: theme.colors.popover,
            "popover-foreground": theme.colors["popover-foreground"],
            muted: theme.colors.muted,
            "muted-foreground": theme.colors["muted-foreground"],
            accent: theme.colors.accent,
            "accent-foreground": theme.colors["accent-foreground"],
            border: theme.colors.border,
            input: theme.colors.input,
            ring: theme.colors.ring,
          },
          borderRadius: theme.borderRadius,
          fontFamily: theme.typography.fontFamily,
          boxShadow: theme.shadows,
          transitionDuration: theme.animation,
        },
      },
    };
  }
  
  // Helper method to merge themes
  private mergeThemes(baseTheme: ThemeTokens, overrideTheme: Partial<ThemeTokens>): ThemeTokens {
    // Create a deep clone of the base theme
    const result = JSON.parse(JSON.stringify(baseTheme)) as ThemeTokens;
    
    // Ensure the result has the correct ID and name
    result.id = overrideTheme.id || result.id;
    result.name = overrideTheme.name || result.name;
    
    // Recursively merge properties
    const mergeRecursive = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] instanceof Object && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          mergeRecursive(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    
    // Apply overrides
    mergeRecursive(result, overrideTheme);
    
    return result;
  }
  
  // Apply CSS variables to the document
  private applyTheme(themeId: ThemeId): void {
    if (typeof document === 'undefined') return; // Skip during SSR
    
    const theme = this.getTheme(themeId);
    const root = document.documentElement;
    
    // Apply colors
    this.applyCSSVariables(root, 'colors', theme.colors);
    
    // Apply border radius
    this.applyCSSVariables(root, 'radius', theme.borderRadius);
    
    // Apply other token categories as needed
    
    // Add theme class to html element
    document.documentElement.classList.remove(...this.getThemeIds().map(id => `theme-${id}`));
    document.documentElement.classList.add(`theme-${themeId}`);
    
    // Set data-theme attribute
    document.documentElement.setAttribute('data-theme', themeId);
  }
  
  // Helper to apply CSS variables
  private applyCSSVariables(element: HTMLElement, prefix: string, values: Record<string, any>, path: string = ''): void {
    // For flat objects
    if (typeof values !== 'object' || values === null) {
      const variableName = `--${prefix}${path ? '-' + path : ''}`;
      element.style.setProperty(variableName, values);
      return;
    }
    
    // For nested objects (like color scales)
    for (const [key, value] of Object.entries(values)) {
      const newPath = path ? `${path}-${key}` : key;
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        this.applyCSSVariables(element, prefix, value, newPath);
      } else {
        const variableName = `--${prefix}-${newPath}`;
        element.style.setProperty(variableName, value as string);
      }
    }
  }
  
  // Save theme to localStorage
  private saveTheme(themeId: ThemeId): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('perslm-theme', themeId);
    }
  }
  
  // Load theme from localStorage
  private loadSavedTheme(): ThemeId | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('perslm-theme') as ThemeId;
    }
    return null;
  }
  
  // Notify listeners of theme change
  private notifyListeners(themeId: ThemeId): void {
    this.listeners.forEach(listener => listener(themeId));
  }
}

// Create singleton instance
export const themingEngine = new ThemingEngine();

// React Context
interface ThemeContextType {
  theme: ThemeTokens;
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  themingEngine: ThemingEngine;
}

// Create React Context for theme
const ThemeContext = createContext<ThemeContextType>({
  theme: themingEngine.getActiveTheme(),
  themeId: themingEngine.getActiveThemeId(),
  setTheme: themingEngine.setTheme.bind(themingEngine),
  themingEngine,
});

// Custom hook to use theme
export const useTheme = () => useContext(ThemeContext);

// Hook for extracting theme value
export function useThemeValue<T>(path: string, defaultValue?: T): T {
  const { theme } = useTheme();
  
  const getValue = (obj: any, paths: string[]): any => {
    if (paths.length === 0) return obj;
    if (!obj) return undefined;
    
    const [first, ...rest] = paths;
    return getValue(obj[first], rest);
  };
  
  const pathParts = path.split('.');
  const value = getValue(theme, pathParts);
  
  return value !== undefined ? value : defaultValue;
}

export default themingEngine; 