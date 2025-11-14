import { useColorScheme } from 'react-native';

export const useIsDarkMode = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark';
};
