import { useThemeStore } from '@stores/theme';

export const useIsDarkMode = () => {
  return useThemeStore((state) => {
    if (state.theme === 'system') {
      return state.systemColorScheme === 'dark';
    }
    return state.theme === 'dark';
  });
};
