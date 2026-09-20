import { SearchActions } from '@components/screens/discover/ui/search-actions';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Stack } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { SearchBarCommands } from 'react-native-screens';
import type { DiscoverChromeProps, DiscoverSearchHandle } from './types';

export type { DiscoverChromeProps, DiscoverSearchHandle } from './types';

export const DiscoverChrome = forwardRef<DiscoverSearchHandle, DiscoverChromeProps>(
  (
    {
      inputValue,
      isBrowsing,
      onChangeText,
      onFocus,
      onBlur,
      onCancel,
      onSubmit,
      onOpenLanguage,
      onOpenAddFeed,
      onOpenOptions,
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const searchRef = useRef<SearchBarCommands>(null);
    const nativeText = useRef('');

    useImperativeHandle(
      ref,
      () => ({
        focus: () => searchRef.current?.focus(),
        blur: () => searchRef.current?.blur(),
      }),
      []
    );

    useEffect(() => {
      if (inputValue === nativeText.current) return;
      nativeText.current = inputValue;
      if (inputValue) searchRef.current?.setText(inputValue);
      else searchRef.current?.clearText();
    }, [inputValue]);

    const handleChangeText = useCallback(
      (event: { nativeEvent: { text: string } }) => {
        nativeText.current = event.nativeEvent.text;
        onChangeText(event.nativeEvent.text);
      },
      [onChangeText]
    );

    /**
     * Search options are always present. They used to appear only once a search was running,
     * which meant the one screen where you'd go to change how search behaves — the landing
     * screen, before typing — was the one screen with no way to reach them. The category screens
     * carry the same cluster, for the same reason.
     */
    const headerRight = useCallback(
      () => (
        <SearchActions
          onOpenOptions={onOpenOptions}
          onOpenLanguage={onOpenLanguage}
          onOpenAddFeed={onOpenAddFeed}
        />
      ),
      [onOpenLanguage, onOpenAddFeed, onOpenOptions]
    );

    return (
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Discover',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerLargeStyle: { backgroundColor: colors.background },
          headerTintColor: colors.black,
          headerRight,
          headerSearchBarOptions: {
            ref: searchRef,
            placeholder: 'What are you looking for?',
            autoCapitalize: 'none',
            hideWhenScrolling: false,
            // `textColor`, `tintColor` and `barTintColor` are the only three RNSSearchBar
            // implements on iOS. The placeholder and the magnifier are drawn by UIKit from the
            // navigation bar's trait collection and cannot be set from JS at all —
            // NAVIGATION_THEME is what keeps that trait collection in step with the app theme.
            textColor: colors.black,
            tintColor: colors.secondary,
            // Our own surface rather than the default material, so the field matches the pill on
            // Android and the cards below it.
            barTintColor: colors.grey6,
            onChangeText: handleChangeText,
            onFocus,
            onBlur,
            onSearchButtonPress: onSubmit,
            onCancelButtonPress: onCancel,
          },
        }}
      />
    );
  }
);

DiscoverChrome.displayName = 'DiscoverChrome';
