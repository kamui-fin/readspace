import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Stack } from 'expo-router';
import type { NativeScreenHeaderProps } from './types';

export type { NativeScreenHeaderProps } from './types';

/**
 * iOS: turns on the real navigation bar for a pushed detail screen.
 *
 * A page-level `BackButton` can look like the system's, but only the bar's own back button carries
 * the interactive pop gesture, the back-title, the long-press stack menu and — from iOS 26 — the
 * Liquid Glass treatment that tracks the scroll edge. Screens using this render no back affordance
 * of their own; Android keeps theirs, since `index.tsx` renders nothing.
 *
 * An inline title rather than a large one: these are drill-downs, where iOS reserves large titles
 * for top-level browse screens (which is what Discover and the category screens use).
 *
 * `Stack.Screen` options set from inside a screen override the parent stack's `screenOptions`,
 * so this works against layouts that declare `headerShown: false`.
 */
export function NativeScreenHeader({ title = '', backTitle }: NativeScreenHeaderProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerBackTitle: backTitle,
        // Without an explicit label iOS falls back to the previous screen's title, and an
        // expo-router screen's default title is its route name — which is how the back button
        // ended up reading "(tabs)". A bare chevron is the right answer when we have no name.
        headerBackButtonDisplayMode: backTitle ? 'default' : 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        // `black` is an inverted token — the foreground colour, white in dark mode.
        headerTintColor: colors.black,
      }}
    />
  );
}
