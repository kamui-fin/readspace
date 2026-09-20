import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { useReviewPrompt } from '@hooks/useReviewPrompt';
import { View } from 'react-native';
import { Stack } from 'expo-router';

export default function ProtectedLayout() {
  const cancelReviewPrompt = useReviewPrompt();
  const isDark = useIsDarkMode();
  const backgroundColor = isDark ? COLORS.dark.background : COLORS.light.background;

  return (
    <View style={{ flex: 1 }} onTouchStart={cancelReviewPrompt}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="articles/[id]" />
      </Stack>
    </View>
  );
}
