import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useOnboardingFeeds } from '@/hooks/useOnboardingFeeds';
import { useCreateFeed } from '@readspace/shared';
import { useOnboardingStore } from '@stores/onboarding';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function FeedSelectionStep({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const { onboardingData, updateOnboardingData } = useOnboardingStore();
  const [followedFeeds, setFollowedFeeds] = useState<string[]>(onboardingData.followedFeeds || []);

  const { displayedFeeds, isLoading, error, fetchSimilarFeeds } = useOnboardingFeeds(
    onboardingData.selectedCategories
  );

  const createFeed = useCreateFeed();

  const handleFeedSubscribed = (feedId: string, feedUrl: string) => {
    const newFollowedFeeds = [...followedFeeds, feedId];
    setFollowedFeeds(newFollowedFeeds);
    updateOnboardingData({ followedFeeds: newFollowedFeeds });

    createFeed.mutate({ url: feedUrl });
    fetchSimilarFeeds(feedId);
  };

  const router = useRouter();

  const handleComplete = () => {
    updateOnboardingData({ followedFeeds });
    router.replace('/(protected)/(tabs)');
  };

  const canComplete = followedFeeds.length >= 3;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#6A994E" />
      </View>
    );
  }

  return (
    <View className="flex-1 px-6">
      <View className="mb-8">
        <Text
          size="3xl"
          fontFamily="geist-bold"
          className="text-primary_foreground dark:text-primary_foreground mb-2">
          Build your news feed
        </Text>
        <Text size="lg" fontFamily="geist-regular" className="text-grey dark:text-grey">
          Pick at least 3 publications
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-2 pb-8">
          {displayedFeeds.map((feed) => (
            <FeedListItem
              key={feed.id}
              feedId={feed.id}
              feedUrl={feed.url}
              title={feed.title || 'Untitled'}
              description={feed.description || ''}
              iconUrl={feed.image_url || undefined}
              isFollowing={followedFeeds.includes(feed.id)}
              showFolderPicker={false}
              disableNavigation={true}
              onFollowRequest={() => handleFeedSubscribed(feed.id, feed.url)}
            />
          ))}
        </View>
      </ScrollView>

      <View className="mt-auto pt-4" style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}>
        <Button
          variant="primary"
          size="large"
          onPress={handleComplete}
          disabled={!canComplete}
          style={{ borderRadius: 12 }}>
          {canComplete ? 'Start Reading!' : `Add ${3 - followedFeeds.length} More`}
        </Button>
      </View>
    </View>
  );
}
