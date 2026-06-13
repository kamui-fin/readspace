import ClockCircleOutlineIcon from '@components/icons/solar/clock-circle-outline';
import { Text } from '@components/ui/text';
import { COLORS } from '@lib/constants/colors';
import { Pressable, ScrollView, View } from 'react-native';

interface RecentSearchesProps {
  recentSearches: string[];
  onRecentSearchPress: (query: string) => void;
  onClearHistory: () => void;
  contentPaddingBottom: number;
  colors: typeof COLORS.light | typeof COLORS.dark;
}

export function RecentSearches({
  recentSearches,
  onRecentSearchPress,
  onClearHistory,
  contentPaddingBottom,
  colors,
}: RecentSearchesProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className="px-6"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{
        paddingBottom: contentPaddingBottom,
      }}>
      {recentSearches.length > 0 ? (
        <>
          <View className="mb-4 flex-row items-center justify-between">
            <Text size="base" fontFamily="geist-semibold" className="text-black">
              Recent searches
            </Text>
            <Pressable onPress={onClearHistory} className="active:opacity-60">
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
                className="flex-row items-center gap-3 py-2 transition-opacity active:opacity-60">
                <ClockCircleOutlineIcon width={20} height={20} color={colors.grey} />
                <Text size="base" fontFamily="geist" className="flex-1 text-black">
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
