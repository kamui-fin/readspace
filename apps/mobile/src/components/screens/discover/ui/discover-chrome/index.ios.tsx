import { Languages, Plus } from '@components/icons/svg';
import { SearchOptionsButton } from '@components/screens/discover/ui/search-options.button';
import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Stack } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';
import type { DiscoverChromeProps, DiscoverSearchHandle } from './types';

export type { DiscoverChromeProps, DiscoverSearchHandle } from './types';

/**
 * iOS Discover chrome: the native navigation header (UINavigationBar) with a large title, and
 * a native `UISearchController` search field (`headerSearchBarOptions`) — system cancel button,
 * keyboard handling and iOS 26 Liquid Glass — instead of our pill. Renders no RN UI itself; it
 * configures the surrounding stack screen.
 *
 * The native field keeps its own text, so JS-side changes (tapping a recent search, clearing a
 * query) are pushed into it with `setText` / `clearText`. `nativeText` remembers what the field
 * already shows so the sync never echoes a user's own typing back at them.
 */
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

    const headerRight = useCallback(
      () =>
        isBrowsing ? (
          <View className="flex-row items-center gap-2">
            <Button variant="icon" size="small" fullWidth={false} onPress={onOpenLanguage}>
              <Languages width={20} height={20} color={colors.grey} />
            </Button>
            <Button variant="icon" size="small" fullWidth={false} onPress={onOpenAddFeed}>
              <Plus width={20} height={20} color={colors.grey} />
            </Button>
          </View>
        ) : (
          <SearchOptionsButton onPress={onOpenOptions} />
        ),
      [isBrowsing, colors.grey, onOpenLanguage, onOpenAddFeed, onOpenOptions]
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
