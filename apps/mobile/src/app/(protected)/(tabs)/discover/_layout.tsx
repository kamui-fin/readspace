import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Stack } from 'expo-router';

export default function DiscoverLayout() {
  const isDark = useIsDarkMode();
  const backgroundColor = isDark ? COLORS.dark.background : COLORS.light.background;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="feed/[id]" />
    </Stack>
  );
}
