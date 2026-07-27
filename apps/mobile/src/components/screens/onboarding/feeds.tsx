import { FeedListSkeleton } from '@components/screens/discover/ui/feed-list.skeleton';
import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useCreateFeed, useDeleteFeed, ApiClient } from '@readspace/shared';
import { useOnboardingStore } from '@stores/onboarding';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingFeeds } from '@/hooks/useOnboardingFeeds';
import { useSession } from '@contexts/auth-context';

// Onboarding feed limits configuration:
// - ONBOARDING_MIN_FEEDS: Minimum number of feeds the user must follow to proceed.
// - ONBOARDING_MAX_FEEDS: Maximum number of feeds allowed during onboarding (keep this synced with backend free limit).
export const ONBOARDING_MIN_FEEDS = 3;
export const ONBOARDING_MAX_FEEDS = 5;

// Mutation key must match what useCreateFeed registers
const CREATE_FEED_MUTATION_KEY = ['create-feed'];

export function FeedSelectionStep({
  onNext: _onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { setIsOnboarded } = useSession();
  const { onboardingData, updateOnboardingData } = useOnboardingStore();
  const [followedFeeds, setFollowedFeeds] = useState<string[]>(onboardingData.followedFeeds || []);
  const [isNavigating, setIsNavigating] = useState(false);

  const { displayedFeeds, isLoading, fetchSimilarFeeds } = useOnboardingFeeds(
    onboardingData.selectedCategories
  );

  const createFeed = useCreateFeed();
  const deleteFeed = useDeleteFeed();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Track how many createFeed mutations are still in-flight
  const pendingFeedCreations = useIsMutating({ mutationKey: CREATE_FEED_MUTATION_KEY });

  const handleFeedSubscribed = (feedId: string, feedUrl: string) => {
    if (followedFeeds.length >= ONBOARDING_MAX_FEEDS) return;
    const newFollowedFeeds = [...followedFeeds, feedId];
    setFollowedFeeds(newFollowedFeeds);
    updateOnboardingData({ followedFeeds: newFollowedFeeds });

    createFeed.mutate({ url: feedUrl });
    fetchSimilarFeeds(feedId);
  };

  const handleFeedUnsubscribed = (feedId: string) => {
    const newFollowedFeeds = followedFeeds.filter((id) => id !== feedId);
    setFollowedFeeds(newFollowedFeeds);
    updateOnboardingData({ followedFeeds: newFollowedFeeds });

    deleteFeed.mutate({ feedId, silent: true });
  };

  const handleComplete = async () => {
    setIsNavigating(true);
    updateOnboardingData({ followedFeeds });

    // Yield control to UI thread so the button has a chance to render the loading spinner
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // Wait for any still-in-flight createFeed mutations to settle before navigating.
    if (pendingFeedCreations > 0) {
      await queryClient.getMutationCache().subscribe(() => {});
      await new Promise<void>((resolve) => {
        const check = () => {
          const stillPending = queryClient
            .getMutationCache()
            .findAll({ mutationKey: CREATE_FEED_MUTATION_KEY, status: 'pending' });
          if (stillPending.length === 0) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    // Mark the user as onboarded on the server so future sign-ins skip onboarding
    try {
      await ApiClient.patch('/api/users/profile', { is_onboarded: true });
    } catch (e) {
      console.warn('[Onboarding] Failed to mark user as onboarded:', e);
    }

    setIsOnboarded(true);

    // Invalidate caches so the following screen starts with a fresh fetch
    queryClient.invalidateQueries({ queryKey: ['rss-articles'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['rss-feeds', 'list'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['rss-unread-counts'], refetchType: 'all' });

    router.replace('/(protected)/(tabs)');
  };

  const canComplete = followedFeeds.length >= ONBOARDING_MIN_FEEDS;
  const isLimitReached = followedFeeds.length >= ONBOARDING_MAX_FEEDS;
  // Button is loading while feeds are being created OR while we're navigating
  const isButtonLoading = isNavigating || pendingFeedCreations > 0;

  const subtext =
    (ONBOARDING_MIN_FEEDS as number) === (ONBOARDING_MAX_FEEDS as number)
      ? `Pick ${ONBOARDING_MAX_FEEDS} publications`
      : `Pick between ${ONBOARDING_MIN_FEEDS} and ${ONBOARDING_MAX_FEEDS} publications`;

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
          {subtext}
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-2 pb-8">
          {isLoading || displayedFeeds.length === 0 ? (
            <FeedListSkeleton count={5} />
          ) : (
            displayedFeeds.map((feed) => {
              const isFollowing = followedFeeds.includes(feed.id);
              return (
                <FeedListItem
                  key={feed.id}
                  feedId={feed.id}
                  feedUrl={feed.url}
                  title={feed.title || 'Untitled'}
                  description={feed.description || ''}
                  iconUrl={feed.image_url || undefined}
                  isFollowing={isFollowing}
                  showFolderPicker={false}
                  disableNavigation={true}
                  onFollowRequest={() => handleFeedSubscribed(feed.id, feed.url)}
                  onUnfollowRequest={() => handleFeedUnsubscribed(feed.id)}
                  disabled={isLimitReached && !isFollowing}
                />
              );
            })
          )}
        </View>
      </ScrollView>

      <View className="mt-auto pt-4" style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}>
        <Button
          variant="primary"
          size="large"
          onPress={handleComplete}
          disabled={!canComplete}
          loading={isButtonLoading}
          style={{ borderRadius: 12 }}>
          {canComplete
            ? 'Start Reading!'
            : `Add ${ONBOARDING_MIN_FEEDS - followedFeeds.length} More`}
        </Button>
        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            style={{ alignSelf: 'center', marginTop: 16, padding: 8 }}
            activeOpacity={0.7}>
            <Text
              size="sm"
              fontFamily="geist-medium"
              className="text-grey dark:text-grey text-center">
              Skip for now
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
