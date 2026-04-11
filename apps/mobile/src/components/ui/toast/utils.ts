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
  if (type === 'success') {
    return colors.icon_bg_green;
  }
  if (type === 'promise') {
    return colors.icon_bg_blue;
  }
  if (type === 'info') {
    return colors.icon_bg_yellow;
  }
  return colors.icon_bg_red;
};

export const getToastTextColor = (
  type: string,
  colors: ThemeColors,
  custom?: { textColor?: string }
) => {
  if (type === 'custom' && custom?.textColor) {
    return custom.textColor;
  }
  if (type === 'success') {
    return colors.secondary;
  }
  if (type === 'promise') {
    return colors.blue;
  }
  if (type === 'info') {
    return colors.orange;
  }
  return colors.red;
};
