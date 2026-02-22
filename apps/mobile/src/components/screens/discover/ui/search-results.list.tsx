import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import type { FeedSummary } from '@readspace/shared';
import { ScrollView, View } from 'react-native';
import { CategoriesList } from './categories.list';

interface SearchResultsProps {
  showSearchSkeleton: boolean;
  hits: FeedSummary[];
  contentPaddingBottom: number;
  selectedCategory: string | null;
  categoriesRow1: string[];
  categoriesRow2: string[];
  onCategoryPress: (category: string) => void;
  onClearCategory: () => void;
  categoryScrollRef: React.RefObject<ScrollView | null>;
}

export function SearchResults({
  showSearchSkeleton,
  hits,
  contentPaddingBottom,
  selectedCategory,
  categoriesRow1,
  categoriesRow2,
  onCategoryPress,
  onClearCategory,
  categoryScrollRef,
}: SearchResultsProps) {
  return (
    <View className="flex-1">
      {showSearchSkeleton ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: contentPaddingBottom,
          }}>
          <View className="gap-4 px-6 pt-4">
            {Array.from({ length: 8 }, (_, i) => `search-skeleton-${i}`).map((key) => (
              <View key={key} className="flex-row gap-3">
                <Skeleton variant="circle" width={48} height={48} />
                <View className="flex-1 gap-2">
                  <Skeleton variant="text" width="70%" height={20} />
                  <Skeleton variant="text" width="100%" height={16} />
                  <Skeleton variant="text" width="80%" height={16} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : hits && hits.length > 0 ? (
        <InfiniteScrollList
          data={hits}
          estimatedItemSize={80}
          renderItem={({ item }) => (
            <FeedListItem
              feedId={item.id}
              title={item.title || 'Untitled Feed'}
              description={item.description || ''}
              iconUrl={item.image_url || undefined}
              isFollowing={item.is_subscribed || false}
              className="px-6"
              isPreview={item.is_preview}
            />
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: contentPaddingBottom,
          }}
          ListHeaderComponent={
            selectedCategory ? (
              <View className="mb-6">
                <CategoriesList
                  selectedCategory={selectedCategory}
                  categoriesRow1={categoriesRow1}
                  categoriesRow2={categoriesRow2}
                  onCategoryPress={onCategoryPress}
                  onClearCategory={onClearCategory}
                  categoryScrollRef={categoryScrollRef}
                />
              </View>
            ) : undefined
          }
        />
      ) : (
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text size="base" fontFamily="geist" className="text-center text-grey">
            No feeds found matching your search
          </Text>
        </View>
      )}
    </View>
  );
}
