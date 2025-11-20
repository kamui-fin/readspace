import { FolderPickerBottomSheet } from '@components/bottom-sheets/folder-picker';
import {
  FolderPickerModal,
  type FolderPickerModalRef,
} from '@components/modals/folder-picker.modal';
import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useDiscoverScroll } from '@contexts/discover-scroll-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import { ApiClient, type SimilarFeedsResponse, useCreateFeed } from '@readspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Platform, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const isIOS = Platform.OS === 'ios';

interface SimilarFeedsScreenProps {
  feedId: string;
}

export function SimilarFeedsScreen({ feedId }: SimilarFeedsScreenProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const folderPickerRef = useRef<FolderPickerModalRef>(null);
  const [pendingFeedUrl, setPendingFeedUrl] = useState<string | null>(null);

  const createFeed = useCreateFeed();

  // Scroll tracking for sticky header
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const scrollDirection = useSharedValue<'up' | 'down'>('down');
  const { setSimilarFeedsScrollValues, setSimilarFeedsTitle, headerHeight } = useDiscoverScroll();

  // Fetch the feed details to get the title
  const { data: feedData } = useQuery({
    queryKey: ['feed', feedId],
    queryFn: () => ApiClient.rss.getFeed(feedId),
    enabled: !!feedId,
  });

  // Fetch similar feeds data (full list - 20 items)
  const {
    data: similarData,
    isLoading,
    error,
  } = useQuery<SimilarFeedsResponse>({
    queryKey: ['similar-feeds-full', feedId, 20],
    queryFn: () => ApiClient.rss.getSimilarFeeds(feedId, { limit: 20 }),
    enabled: !!feedId,
  });

  const similarFeeds = similarData?.similar_feeds || [];
  const feedTitle = feedData?.title || 'this feed';

  // Update header title when feed data loads
  useEffect(() => {
    if (feedTitle && setSimilarFeedsTitle) {
      setSimilarFeedsTitle('Similar feeds');
    }
  }, [feedTitle, setSimilarFeedsTitle]);

  // Initialize scrollY to 0 and share with Header component immediately
  // This must happen before the header reads scrollY to prevent animation on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY, lastScrollY, and scrollDirection are SharedValues that should be initialized once, setSimilarFeedsScrollValues is stable
  useEffect(() => {
    // Initialize to 0 first
    scrollY.value = 0;
    lastScrollY.value = 0;
    scrollDirection.value = 'down';
    // Then share with header - ensures header always sees 0 initially
    setSimilarFeedsScrollValues?.(scrollY, scrollDirection);
  }, [setSimilarFeedsScrollValues]);

  // Reset scrollY when screen comes into focus to prevent animation on navigation
  // This ensures the header is always fully visible when navigating to this screen
  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY, lastScrollY, and scrollDirection are SharedValues that are stable references
    useCallback(() => {
      scrollY.value = 0;
      lastScrollY.value = 0;
      scrollDirection.value = 'down';
    }, [])
  );

  // Animated spacer that perfectly matches header collapse
  // Matches header's animation behavior: withTiming when scrolling up, linear when scrolling down
  const animatedPaddingTopStyle = useAnimatedStyle(() => {
    if (!headerHeight || headerHeight === 0) {
      return { height: 0 };
    }

    const currentScrollY = scrollY.value;
    const direction = scrollDirection.value;

    // Clamp scrollY to prevent negative values and handle overscroll
    const clampedScrollY = Math.max(0, currentScrollY);

    // When scrolling up (pulling down to reveal), use withTiming to match header's smooth reveal
    // Header animates to full height with 250ms cubic easing when direction === "up"
    // This prevents blank space during the pull-down animation
    if (direction === 'up') {
      return {
        height: withTiming(headerHeight, {
          duration: 250,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
      };
    }

    // Early return for top position - instant response (matches header behavior)
    if (clampedScrollY === 0) {
      return { height: headerHeight };
    }

    // Match header's visibility calculation exactly
    // Header uses: normalizedScroll = clampedScrollY / totalHeight, visibility = 1 - normalizedScroll
    // Note: headerHeight includes paddingTop, so we need to extract the content height
    // For simplicity, we'll use headerHeight directly since the spacer accounts for the full header space
    const normalizedScroll = Math.min(clampedScrollY / headerHeight, 1);

    // Ensure normalizedScroll is valid
    if (!Number.isFinite(normalizedScroll) || normalizedScroll < 0) {
      return { height: headerHeight };
    }

    // Use smooth interpolation for visibility (matches header exactly)
    const visibility = Math.max(0, Math.min(1, 1 - normalizedScroll));

    // Height directly matches visibility for perfect synchronization
    const height = headerHeight * visibility;

    return { height };
  }, [headerHeight]);

  // Handle scroll events - robust with no race conditions or edge cases
  // Increased threshold for more stable direction detection during slow scrolling
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawScrollY = event.nativeEvent.contentOffset.y;
    const previousScrollY = lastScrollY.value;

    // Clamp scrollY to >= 0 to prevent negative values from overscroll
    const currentScrollY = Math.max(0, rawScrollY);

    // Update scrollY value atomically - Reanimated handles smoothing on UI thread
    scrollY.value = currentScrollY;

    // Update direction with larger threshold to prevent jitter during slow scrolling
    // Use a larger threshold (5px) for more stable direction detection
    const scrollDelta = currentScrollY - previousScrollY;
    const absDelta = Math.abs(scrollDelta);

    if (absDelta > 5) {
      scrollDirection.value = scrollDelta > 0 ? 'down' : 'up';
    }

    // Update lastScrollY after all calculations to prevent race conditions
    lastScrollY.value = currentScrollY;
  };

  const handleFeedFollowRequest = useCallback((feedUrl: string) => {
    setPendingFeedUrl(feedUrl);
    folderPickerRef.current?.present();
  }, []);

  const handleFolderSelect = useCallback(
    (folderId: string | null) => {
      if (!pendingFeedUrl) {
        return;
      }

      createFeed.mutate(
        {
          url: pendingFeedUrl,
          folder_id: folderId || undefined,
          silent: false,
        },
        {
          onSuccess: () => {
            toast.success('Following feed!');
            setPendingFeedUrl(null);
          },
          onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Failed to follow feed';
            toast.error(errorMessage);
            setPendingFeedUrl(null);
          },
        }
      );
    },
    [pendingFeedUrl, createFeed]
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
          }}>
          <Animated.View style={animatedPaddingTopStyle} pointerEvents="none" collapsable={false} />
          <View className="gap-4 px-6 pt-4">
            {Array.from({ length: 8 }, (_, i) => `feed-skeleton-${i}`).map((key, index) => (
              <View key={key} className="gap-3">
                <View className="flex-row gap-3">
                  <Skeleton variant="circle" width={48} height={48} />
                  <View className="flex-1 gap-2">
                    <Skeleton variant="text" width="70%" height={20} />
                    <Skeleton variant="text" width="100%" height={16} />
                    <Skeleton variant="text" width="80%" height={16} />
                  </View>
                </View>
                {index < 7 && (
                  <View className="h-[0.5px]" style={{ backgroundColor: colors.grey5 }} />
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-1 items-center justify-center px-6">
          <Text
            size="base"
            fontFamily="geist"
            className="mb-4 text-center text-grey dark:text-grey-dark">
            Failed to load similar feeds
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View className="flex-1 bg-background dark:bg-background-dark">
        {similarFeeds.length > 0 ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
            }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}>
            {/* Animated spacer that matches header collapse */}
            <Animated.View
              style={animatedPaddingTopStyle}
              pointerEvents="none"
              collapsable={false}
            />
            <View className="gap-2 px-6 pt-4">
              {similarFeeds.map((similarFeed, index) => (
                <View key={similarFeed.id}>
                  <FeedListItem
                    feedId={similarFeed.id}
                    title={similarFeed.title || 'Untitled Feed'}
                    description={similarFeed.description || ''}
                    iconUrl={similarFeed.image_url || undefined}
                    isFollowing={similarFeed.is_subscribed || false}
                    isPreview={similarFeed.is_preview}
                    feedUrl={similarFeed.url}
                    onFollowRequest={handleFeedFollowRequest}
                  />
                  {index < similarFeeds.length - 1 && (
                    <View className="my-2 h-[0.5px]" style={{ backgroundColor: colors.grey5 }} />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Monicon name="solar:document-text-linear" size={64} color={colors.grey5} />
            <Text
              size="lg"
              fontFamily="geist-semibold"
              className="mt-4 text-center text-black dark:text-black-dark">
              No similar feeds found
            </Text>
            <Text
              size="base"
              fontFamily="geist"
              className="mt-2 text-center text-grey dark:text-grey-dark">
              This feed might be unique, or similar feeds may not have embeddings yet.
            </Text>
          </View>
        )}
      </View>

      {isIOS ? (
        <FolderPickerModal ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      ) : (
        <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      )}
    </>
  );
}
