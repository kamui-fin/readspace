import FeedLinearIcon from '@components/icons/solar/feed-linear';
import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/ui/empty-state';
import { SectionHeader } from '@components/ui/section-header';
import { Text } from '@components/ui/text';
import { COLORS } from '@lib/constants/colors';
import { View } from 'react-native';

interface FeedSimilarListProps {
  similarFeeds: any[];
  isLoading: boolean;
  onShowMore: () => void;
  onFollowRequest: (url: string) => void;
  colors: typeof COLORS.light | typeof COLORS.dark;
  greyColor: string;
}

export function FeedSimilarList({
  similarFeeds,
  isLoading,
  onShowMore,
  onFollowRequest,
  colors,
  greyColor,
}: FeedSimilarListProps) {
  return (
    <View className="px-6 pb-8">
      <SectionHeader
        title="You might also like"
        onSeeAll={similarFeeds.length > 0 ? onShowMore : undefined}
        className="mb-4"
        iconColor={greyColor}
      />

      {isLoading ? (
        <View className="gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index.toString()} className="flex-row gap-3 py-3">
              <View className="h-14 w-14 rounded-lg" style={{ backgroundColor: colors.grey5 }} />
              <View className="flex-1 gap-2">
                <View
                  className="h-4 rounded"
                  style={{
                    width: '100%',
                    backgroundColor: colors.grey5,
                  }}
                />
                <View
                  className="h-3 rounded"
                  style={{
                    width: '100%',
                    backgroundColor: colors.grey5,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : similarFeeds.length > 0 ? (
        <View className="gap-2">
          {similarFeeds.map((similarFeed) => (
            <FeedListItem
              key={similarFeed.id}
              feedId={similarFeed.id}
              title={similarFeed.title || 'Untitled Feed'}
              description={similarFeed.description || ''}
              iconUrl={similarFeed.image_url || undefined}
              isFollowing={similarFeed.is_subscribed || false}
              isPreview={similarFeed.is_preview}
              feedUrl={similarFeed.url}
              onFollowRequest={(url) => onFollowRequest(url)}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon={FeedLinearIcon} message="No similar feeds found" className="py-8" />
      )}
    </View>
  );
}
