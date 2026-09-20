import { COLORS } from '@lib/constants/colors';
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

/**
 * React Navigation's theme, rebuilt on our palette.
 *
 * This is not only about JS colours. expo-router feeds `theme.dark` straight through to the native
 * header as `experimental_userInterfaceStyle`, which becomes the navigation bar's
 * `overrideUserInterfaceStyle`. Our own theme lives in the Zustand store, so React Navigation was
 * left on its default (light) theme and every native bar was pinned to light appearance —
 * including the `UISearchController` field inside it, whose magnifier and placeholder are resolved
 * by UIKit from the trait collection and are not settable from JS (`RNSSearchBar` only implements
 * `textColor`, `tintColor` and `barTintColor`). That is what drew a black magnifier and a
 * light-mode placeholder on Discover's dark search field.
 */
export const NAVIGATION_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: COLORS.light.primary,
      background: COLORS.light.background,
      card: COLORS.light.card,
      text: COLORS.light.black,
      border: COLORS.light.grey4,
      notification: COLORS.light.red,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      // The brand green only carries on a light surface; dark chrome tints with the lighter one.
      primary: COLORS.dark.secondary,
      background: COLORS.dark.background,
      card: COLORS.dark.card,
      // `black` is an inverted token — it is the foreground colour, white in dark mode.
      text: COLORS.dark.black,
      border: COLORS.dark.grey4,
      notification: COLORS.dark.red,
    },
  },
};
