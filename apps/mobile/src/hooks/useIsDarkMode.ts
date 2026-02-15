import { useThemeStore } from '@stores/theme';

export const useIsDarkMode = () => {
  const getEffectiveColorScheme = useThemeStore((state) => state.getEffectiveColorScheme);
  return getEffectiveColorScheme() === 'dark';
};
