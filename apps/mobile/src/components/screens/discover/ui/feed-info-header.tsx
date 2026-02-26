import { Button } from '@components/ui/button';
import { Chip } from '@components/ui/chip';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { COLORS } from '@lib/constants/colors';
import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import LinkMinimalistic2BoldIcon from '@components/icons/solar/link-minimalistic-2-bold';
import { Feed, FeedDiscoveryResult } from '@readspace/shared';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

interface FeedInfoHeaderProps {
  feed: FeedDiscoveryResult | Feed;
  isFollowing: boolean;
  isFeedDead: boolean;
  isFollowLoading: boolean;
  onBack: () => void;
  onFollow: () => void;
  colors: typeof COLORS.light | typeof COLORS.dark;
  greyColor: string;
}

export function FeedInfoHeader({
  feed,
  isFollowing,
  isFeedDead,
  isFollowLoading,
  onBack,
  onFollow,
  colors,
  greyColor,
}: FeedInfoHeaderProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const toggleDescription = useCallback(() => {
    setIsDescriptionExpanded((prev) => !prev);
  }, []);

  const handleUrlPress = useCallback(async () => {
    const url = feed.link || feed.url;
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const supported = await Linking.canOpenURL(fullUrl);
    if (supported) {
      await Linking.openURL(fullUrl);
    } else {
      toast.error('Cannot open this URL');
    }
  }, [feed]);

  return (
    <View className="px-4 pb-4 pt-2">
      <View className="mb-6 flex-row items-center">
        <Button variant="icon" size="small" fullWidth={false} onPress={onBack}>
          <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={greyColor} />
        </Button>
      </View>

      {/* Feed Icon */}
      <View className="relative mb-4">
        <View
          className="h-24 w-24 items-center justify-center overflow-hidden rounded-3xl"
          style={{
            backgroundColor: colors.white,
          }}>
          {feed.image_url ? (
            <Image source={{ uri: feed.image_url }} className="h-full w-full" contentFit="cover" />
          ) : (
            <Text size="lg" fontFamily="geist-bold" style={{ color: colors.grey, fontSize: 30 }}>
              {(feed.title || 'F').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        {isFeedDead && (
          <Chip
            label="Inactive"
            variant="filled"
            size="medium"
            className="absolute -right-1 -top-1 bg-red"
            textClassName="text-white"
          />
        )}
      </View>

      {/* Feed Title */}
      <Text
        size="2xl"
        fontFamily="geist-bold"
        className="mb-2 tracking-heading text-black dark:text-black-dark">
        {feed.title || 'Untitled Feed'}
      </Text>

      {/* Feed Description */}
      {feed.description && (
        <View className="mb-4">
          {feed.description.length > 80 ? (
            <>
              <Text
                size="base"
                fontFamily="geist"
                className="leading-6 text-grey dark:text-grey-dark">
                {isDescriptionExpanded ? feed.description : `${feed.description.slice(0, 80)}... `}
                {!isDescriptionExpanded && (
                  <Text
                    size="base"
                    fontFamily="geist-medium"
                    onPress={toggleDescription}
                    className="text-black dark:text-black-dark">
                    more
                  </Text>
                )}
              </Text>
              {isDescriptionExpanded && (
                <Button
                  variant="ghost"
                  size="small"
                  onPress={toggleDescription}
                  className="mt-1 h-auto self-start px-0"
                  textClassName="text-base font-geist-medium text-black dark:text-black-dark">
                  less
                </Button>
              )}
            </>
          ) : (
            <Text
              size="base"
              fontFamily="geist"
              className="leading-6 text-grey dark:text-grey-dark">
              {feed.description}
            </Text>
          )}
        </View>
      )}

      {/* Feed URL */}
      {(feed.link || feed.url) && (
        <Button
          variant="ghost"
          size="small"
          onPress={handleUrlPress}
          className="mb-4 h-auto flex-row items-center justify-start gap-2 px-0">
          <LinkMinimalistic2BoldIcon
            width={20}
            height={20}
            strokeWidth={2.4}
            color={colors.primary}
          />
          <Text
            size="sm"
            fontFamily="geist"
            className="flex-1 flex-shrink underline text-left"
            style={{ color: colors.primary }}
            numberOfLines={1}>
            {feed.link || feed.url}
          </Text>
        </Button>
      )}

      {/* Feed Tags */}
      {(() => {
        const fallBackTags = (feed as any).tags;
        const displayTags = (feed.tags_native && feed.tags_native.length > 0) ? feed.tags_native : fallBackTags;
        if (!displayTags || displayTags.length === 0) return null;
        return (
          <View className="mb-6 flex-row flex-wrap items-center gap-2">
            {displayTags.slice(0, 5).map((tag: string | { name: string }, index: number) => {
              const tagName = typeof tag === 'string' ? tag : (tag as any)?.name || 'Tag';
              const formattedTag = tagName.replace(/\s+/g, '-');
              return (
                <View
                  key={`${tagName}-${index.toString()}`}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: colors.grey5 }}>
                  <Text size="sm" fontFamily="geist" style={{ color: colors.grey, fontSize: 12 }}>
                    #{formattedTag}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* Follow Button */}
      <Button
        onPress={onFollow}
        variant={isFollowing ? 'secondary' : 'primary'}
        fullWidth
        disabled={isFollowLoading}
        loading={isFollowLoading}>
        {isFollowLoading
          ? isFollowing
            ? 'Unfollowing...'
            : 'Following...'
          : isFollowing
            ? 'Unfollow'
            : 'Follow'}
      </Button>
    </View>
  );
}
