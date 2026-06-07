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

  // Soft premium tinted backgrounds matching Readspace palette in light mode
  if (type === 'success') {
    return 'rgb(243, 249, 243)'; // Very soft forest green
  }
  if (type === 'error') {
    return 'rgb(255, 245, 245)'; // Very soft rose red
  }
  if (type === 'info') {
    return 'rgb(255, 248, 240)'; // Soft apricot/orange tint
  }
  if (type === 'promise') {
    return 'rgb(244, 247, 244)'; // Cohesive light green-grey (adhering to readspace theme)
  }

  return 'rgb(244, 247, 244)';
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

  // High-contrast themed text in light mode
  if (type === 'success') {
    return '#2c4f32'; // Deep forest green (AAA contrast)
  }
  if (type === 'error') {
    return '#a81c1c'; // Deep rose red (AAA contrast)
  }
  if (type === 'info') {
    return '#9c4203'; // Deep themed orange/rust (AAA contrast)
  }
  if (type === 'promise') {
    return '#2c4f32'; // Deep themed forest green for promise
  }

  return '#2c4f32';
};

export const getToastBorderColor = (
  _type: string,
  colors: ThemeColors,
  custom?: { borderColor?: string }
) => {
  if (custom?.borderColor) {
    return custom.borderColor;
  }

  const isDark = colors === COLORS.dark;
  if (isDark) {
    return 'rgba(255, 255, 255, 0.05)'; // Very subtle border in dark mode
  }

  // Premium neutral borders in light mode to blend into the toast
  return 'rgba(0, 0, 0, 0.08)';
};
