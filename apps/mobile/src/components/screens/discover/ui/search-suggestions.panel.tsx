import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { ClockCircleIcon } from '@solar-icons/react-native/outline';
import type { DiscoverSearchMode } from '@stores/discover-preferences';
import { Pressable, ScrollView, View } from 'react-native';

interface SearchSuggestionsPanelProps {
  recentSearches: string[];
  onRecentSearchPress: (query: string) => void;
  onClearHistory: () => void;
  contentPaddingBottom: number;
}

/**
 * What the search field shows while it's focused and empty: recent searches.
 *
 * Deliberately nothing else. Both search modes now respond to typing, so this
 * panel disappears on the first keystroke and anything parked here would only
 * ever be glimpsed.
 */
export function SearchSuggestionsPanel({
  recentSearches,
  onRecentSearchPress,
  onClearHistory,
  contentPaddingBottom,
}: SearchSuggestionsPanelProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className="px-6"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}>
      {recentSearches.length > 0 ? (
        <>
          <View className="mb-4 flex-row items-center justify-between">
            <Text size="base" fontFamily="geist-semibold" className="text-black">
              Recent searches
            </Text>
            <Pressable onPress={onClearHistory} hitSlop={8} className="active:opacity-60">
              <Text size="sm" fontFamily="geist-medium" className="text-danger">
                Clear
              </Text>
            </Pressable>
          </View>
          <View className="gap-3">
            {recentSearches.map((query) => (
              <Pressable
                key={query}
                onPress={() => onRecentSearchPress(query)}
                className="flex-row items-center gap-3 py-2 active:opacity-60">
                <ClockCircleIcon size={20} color={colors.grey} />
                <Text
                  size="base"
                  fontFamily="geist"
                  className="flex-1 text-black"
                  numberOfLines={1}>
                  {query}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View className="py-12">
          <Text size="base" fontFamily="geist" className="text-grey text-center">
            No recent searches yet
          </Text>
          <Text size="sm" fontFamily="geist" className="text-grey mt-2 text-center">
            Your search history will appear here
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
