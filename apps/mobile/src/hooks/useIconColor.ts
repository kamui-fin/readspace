import { COLORS } from '@lib/constants/colors';
import { useThemeStore } from '@stores/theme';

export function useIconColor() {
  const getEffectiveColorScheme = useThemeStore((state) => state.getEffectiveColorScheme);

  const scheme = getEffectiveColorScheme();
  return COLORS[scheme].primary_foreground;
}
