import { Languages, Plus } from '@components/icons/svg';
import { SearchBar } from '@components/screens/discover/ui/search-bar.input';
import { SearchOptionsButton } from '@components/screens/discover/ui/search-options.button';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { MotiView } from 'moti';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, type TextInput, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import type { DiscoverChromeProps, DiscoverSearchHandle } from './types';

export type { DiscoverChromeProps, DiscoverSearchHandle } from './types';

/**
 * Android / default Discover chrome: our own title row (which collapses out of the way once
 * search takes over) and the pill search bar. iOS swaps this for the native navigation header.
 */
export const DiscoverChrome = forwardRef<DiscoverSearchHandle, DiscoverChromeProps>(
  (
    {
      inputValue,
      isBrowsing,
      onChangeText,
      onFocus,
      onBlur,
      onClear,
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
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
      }),
      []
    );

    return (
      <>
        {/* Header collapses out of the way as soon as search takes over */}
        <MotiView
          animate={{
            opacity: isBrowsing ? 1 : 0,
            height: isBrowsing ? 62 : 0,
            scale: isBrowsing ? 1 : 0.95,
          }}
          transition={{
            type: 'timing',
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }}
          style={{ overflow: 'hidden' }}>
          <View className="flex-row items-center justify-between px-6 pb-2 pt-3">
            <Text
              size="3xl"
              fontFamily="geist-bold"
              className="tracking-heading text-primary-foreground">
              Discover
            </Text>
            <View className="flex-row items-center gap-2">
              <Button
                variant="icon"
                size="small"
                className="bg-grey6"
                fullWidth={false}
                onPress={onOpenLanguage}>
                <Languages width={20} height={20} color={colors.grey} />
              </Button>
              <Button
                variant="icon"
                size="small"
                className="bg-grey6"
                fullWidth={false}
                onPress={onOpenAddFeed}>
                <Plus width={20} height={20} color={colors.grey} />
              </Button>
            </View>
          </View>
        </MotiView>

        {/* Always mounted so focus/blur morphs stay smooth */}
        <View className="px-6 pb-4 pt-2">
          <Pressable onPress={(event) => event.stopPropagation()}>
            <SearchBar
              ref={inputRef}
              value={inputValue}
              onChangeText={onChangeText}
              onFocus={onFocus}
              onBlur={onBlur}
              onClear={() => {
                onClear();
                inputRef.current?.focus();
              }}
              onCancel={onCancel}
              onSubmit={onSubmit}
              showCancelButton={!isBrowsing}
              autoFocus={false}
              trailingAction={isBrowsing ? null : <SearchOptionsButton onPress={onOpenOptions} />}
            />
          </Pressable>
        </View>
      </>
    );
  }
);

DiscoverChrome.displayName = 'DiscoverChrome';
