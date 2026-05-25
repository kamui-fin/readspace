import { COLORS } from '@lib/constants/colors';

type ThemeColors = typeof COLORS.light | typeof COLORS.dark;

export const getToastBackgroundColor = (
  type: string,
  colors: ThemeColors,
  custom?: { backgroundColor?: string }
) => {
  if (type === 'custom' && custom?.backgroundColor) {
    return custom.backgroundColor;
  }

  // Standard unified dark-theme toast container background for dark mode
  const isDark = colors === COLORS.dark;
  if (isDark) {
    return colors.grey6;
  }

  // Premium colorful backgrounds in light mode
  if (type === 'success') {
    return 'rgb(240, 246, 238)'; // Beautiful soft forest green tint (secondary-foreground translucent blend)
  }
  if (type === 'error') {
    return 'rgb(254, 238, 237)'; // Soft rose/red tint
  }
  if (type === 'promise' || type === 'info') {
    return 'rgb(240, 244, 255)'; // Soft premium blue tint
  }

  return colors.grey6;
};

export const getToastTextColor = (
  type: string,
  colors: ThemeColors,
  custom?: { textColor?: string }
) => {
  if (type === 'custom' && custom?.textColor) {
    return custom.textColor;
  }

  // Standard high-contrast text for dark mode
  const isDark = colors === COLORS.dark;
  if (isDark) {
    return colors.primary_foreground;
  }

  // Premium colorful high-contrast text in light mode
  if (type === 'success') {
    return 'rgb(47, 68, 34)'; // Deep forest green
  }
  if (type === 'error') {
    return 'rgb(180, 20, 10)'; // Deep contrast red
  }
  if (type === 'promise' || type === 'info') {
    return 'rgb(20, 60, 160)'; // Deep contrast blue
  }

  return colors.primary_foreground;
};
