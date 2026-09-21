import { SearchActions } from '@components/screens/discover/ui/search-actions';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Stack } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { SearchBarCommands } from 'react-native-screens';
import type { CategoryChromeProps, CategorySearchHandle } from './types';

export type { CategoryChromeProps, CategorySearchHandle } from './types';

/**
 * iOS category chrome: the real navigation bar. The system supplies the back chevron (and with
 * it the edge-swipe), the large title is the category, and the search field belongs to the bar
 * rather than the page — which is why this screen sits outside the tabs: a `UISearchController`
 * wants the whole header, and there is no tab bar competing for the bottom edge.
 */
export const CategoryChrome = forwardRef<CategorySearchHandle, CategoryChromeProps>(
  (
    {
      title,
      inputValue,
      onChangeText,
      onCancel,
      onSubmit,
      onOpenOptions,
      onOpenLanguage,
      onOpenAddFeed,
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

    // The native field owns its own text, so JS-side clears have to be pushed into it.
    // `nativeText` remembers what it already shows so we never echo typing back at the user.
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

    // Same cluster as the Discover landing screen: search behaviour is worth changing from
    // wherever you happen to be searching, not only from one screen back.
    const headerRight = useCallback(
      () => (
        <SearchActions
          onOpenOptions={onOpenOptions}
          onOpenLanguage={onOpenLanguage}
          onOpenAddFeed={onOpenAddFeed}
        />
      ),
      [onOpenOptions, onOpenLanguage, onOpenAddFeed]
    );

    return (
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerBackTitle: 'Discover',
          headerStyle: { backgroundColor: colors.background },
          headerLargeStyle: { backgroundColor: colors.background },
          headerTintColor: colors.black,
          headerRight,
          headerSearchBarOptions: {
            ref: searchRef,
            placeholder: `Search ${title}`,
            autoCapitalize: 'none',
            hideWhenScrolling: false,
            // See the Discover chrome: only these three apply on iOS. The placeholder and the
            // magnifier come from the navigation bar's trait collection, which NAVIGATION_THEME
            // keeps in step with the app theme.
            textColor: colors.black,
            tintColor: colors.secondary,
            barTintColor: colors.grey6,
            onChangeText: handleChangeText,
            onSearchButtonPress: onSubmit,
            onCancelButtonPress: onCancel,
          },
        }}
      />
    );
  }
);

CategoryChrome.displayName = 'CategoryChrome';
