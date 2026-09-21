import { PlanChangeScreen } from '@components/screens/plan-change';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useReviewPrompt } from '@hooks/useReviewPrompt';
import { COLORS } from '@lib/constants/colors';
import { useUserLimits } from '@readspace/shared';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function ProtectedLayout() {
  const cancelReviewPrompt = useReviewPrompt();
  const isDark = useIsDarkMode();
  const backgroundColor = isDark ? COLORS.dark.background : COLORS.light.background;
  const { data: limits } = useUserLimits();

  // Downgraded with more than the plan allows: the API refuses content until the user picks what
  // to keep, so the whole navigator is replaced (no back gesture or route can escape it).
  if (limits?.over_limit?.downgrade_required) {
    return (
      <View style={{ flex: 1, backgroundColor }}>
        <PlanChangeScreen overLimit={limits.over_limit} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onTouchStart={cancelReviewPrompt}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="articles/[id]" />
        <Stack.Screen name="discover-category/[category]" />
        <Stack.Screen name="feed/[id]" />
      </Stack>
    </View>
  );
}
