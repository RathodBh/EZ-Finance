import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

// Curated luxury Slate & Gold/Emerald theme palette
export const ThemeColors = {
  dark: {
    background: '#0F1218', // Deep Charcoal Slate
    surface: '#171C26', // Lighter Slate Card
    surfaceVariant: '#222A38', // Elevated Slate
    primary: '#E2B85C', // Premium Gold Accent
    primaryContainer: '#4B3F1E',
    secondary: '#10B981', // Emerald Green (Income)
    error: '#EF4444', // Ruby Red (Expense)
    text: '#F3F4F6', // Off-White
    textSecondary: '#9CA3AF', // Cool Muted Gray
    border: '#2A3345', // Dark borders
    glass: 'rgba(23, 28, 38, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    background: '#F9FAFB', // Cool White/Gray
    surface: '#FFFFFF', // Clean White Card
    surfaceVariant: '#F3F4F6', // Light gray background element
    primary: '#D97706', // Warm Amber Gold
    primaryContainer: '#FEF3C7',
    secondary: '#059669', // Emerald Green (Income)
    error: '#DC2626', // Crimson Red (Expense)
    text: '#111827', // Dark Gray
    textSecondary: '#4B5563', // Charcoal Muted Gray
    border: '#E5E7EB', // Light borders
    glass: 'rgba(255, 255, 255, 0.85)',
    glassBorder: 'rgba(0, 0, 0, 0.05)',
  },
};

// React Native Paper theme integration
export const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: ThemeColors.dark.primary,
    background: ThemeColors.dark.background,
    surface: ThemeColors.dark.surface,
    surfaceVariant: ThemeColors.dark.surfaceVariant,
    secondary: ThemeColors.dark.secondary,
    error: ThemeColors.dark.error,
    outline: ThemeColors.dark.border,
  },
};

export const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: ThemeColors.light.primary,
    background: ThemeColors.light.background,
    surface: ThemeColors.light.surface,
    surfaceVariant: ThemeColors.light.surfaceVariant,
    secondary: ThemeColors.light.secondary,
    error: ThemeColors.light.error,
    outline: ThemeColors.light.border,
  },
};

// Aesthetic layout styles
export const LayoutStyles = {
  cardGlass: (theme: 'light' | 'dark') => ({
    backgroundColor: ThemeColors[theme].glass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ThemeColors[theme].glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme === 'dark' ? 0.3 : 0.06,
    shadowRadius: 16,
    elevation: 4,
    padding: 18,
  }),
  shadow: (theme: 'light' | 'dark') => ({
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme === 'dark' ? 0.25 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  }),
};
