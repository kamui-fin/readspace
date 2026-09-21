import { SearchActions } from '@components/screens/discover/ui/search-actions';
import { SearchBar } from '@components/screens/discover/ui/search-bar.input';
import { BackButton } from '@components/ui/back-button';
import { Text } from '@components/ui/text';
import { useRouter } from 'expo-router';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { type TextInput, View } from 'react-native';
import type { CategoryChromeProps, CategorySearchHandle } from './types';

export type { CategoryChromeProps, CategorySearchHandle } from './types';

/**
 * Android / default category chrome: our own back row and pill search bar. iOS swaps this for
 * the real navigation bar.
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
    const router = useRouter();
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
      <View className="px-4 pb-2">
        <View className="flex-row items-center gap-3 py-2">
          <BackButton onPress={() => router.back()} />
          <Text
            size="2xl"
            fontFamily="geist-semibold"
            className="text-primary-foreground flex-1 tracking-tight"
            numberOfLines={1}>
            {title}
          </Text>
          {/* Same cluster as the Discover landing screen: search behaviour is worth changing from
              wherever you happen to be searching, not only from one screen back. */}
          <SearchActions
            onOpenOptions={onOpenOptions}
            onOpenLanguage={onOpenLanguage}
            onOpenAddFeed={onOpenAddFeed}
          />
        </View>
        <SearchBar
          ref={inputRef}
          value={inputValue}
          onChangeText={onChangeText}
          onClear={onCancel}
          onSubmit={onSubmit}
          placeholder={`Search ${title}`}
        />
      </View>
    );
  }
);

CategoryChrome.displayName = 'CategoryChrome';
