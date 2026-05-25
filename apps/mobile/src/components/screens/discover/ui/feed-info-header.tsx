import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import LayersMinimalisticLinearIcon from '@components/icons/solar/layers-minimalistic-linear';
import LinkMinimalistic2BoldIcon from '@components/icons/solar/link-minimalistic-2-bold';
import TrashBinTrashBoldIcon from '@components/icons/solar/trash-bin-trash-bold';
import UserCircleLinearIcon from '@components/icons/solar/user-circle-linear';
import { Button } from '@components/ui/button';
import { Chip } from '@components/ui/chip';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { COLORS } from '@lib/constants/colors';
import { Feed, FeedDiscoveryResult } from '@readspace/shared';
import { Image } from 'expo-image';
import { memo, useCallback, useState } from 'react';
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

function formatContentType(contentType: string): string {
  return contentType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const FeedInfoHeader = memo(function FeedInfoHeader({
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
  const [imageError, setImageError] = useState(false);

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

  const contentType = (feed as FeedDiscoveryResult).content_type;
  const author = (feed as FeedDiscoveryResult).author || (feed as any).author;
  const trimmedDescription = feed.description?.trim();

  console.log(feed.image_url, imageError);

  return (
    <View className="px-4 pb-4 pt-2">
      {/* Back button row */}
      <View className="mb-6 flex-row items-center">
        <Button variant="icon" size="small" fullWidth={false} onPress={onBack}>
          <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={greyColor} />
        </Button>
      </View>

      {/* Feed Icon + Title Row */}
      <View className="mb-4 flex-row items-center gap-4">
        {/* Feed Icon */}
        <View className="relative">
          <View
            className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl"
            style={{
              backgroundColor: colors.grey5,
            }}>
            {feed.image_url && !imageError ? (
              <Image
                source={{ uri: feed.image_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                onError={(e) => {
                  console.log(e);
                  setImageError(true);
                }}
              />
            ) : (
              <Text size="lg" fontFamily="geist-bold" style={{ color: colors.grey, fontSize: 28 }}>
                {(feed.title || 'F').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          {isFeedDead && (
            <Chip
              label="Dead"
              variant="filled"
              size="small"
              className="absolute -right-1 -top-1 bg-red"
              textClassName="text-white"
            />
          )}
        </View>

        {/* Title + meta info */}
        <View className="flex-1">
          <Text
            size="xl"
            fontFamily="geist-bold"
            className="mb-1 tracking-heading text-black"
            numberOfLines={2}>
            {feed.title || 'Untitled Feed'}
          </Text>

          {/* Author */}
          {author ? (
            <View className="mb-1 flex-row items-center gap-1.5">
              <UserCircleLinearIcon width={13} height={13} color={greyColor} strokeWidth={1.8} />
              <Text
                size="sm"
                fontFamily="geist"
                style={{ color: colors.grey, fontSize: 12 }}
                numberOfLines={1}>
                {author}
              </Text>
            </View>
          ) : null}

          {/* Content Type */}
          {contentType ? (
            <View className="flex-row items-center gap-1.5">
              <LayersMinimalisticLinearIcon
                width={13}
                height={13}
                color={greyColor}
                strokeWidth={1.8}
              />
              <Text size="sm" fontFamily="geist" style={{ color: colors.grey, fontSize: 12 }}>
                {formatContentType(contentType)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Feed Description */}
      {trimmedDescription && (
        <View className="mb-4">
          {trimmedDescription.length > 120 ? (
            <Text
              size="sm"
              fontFamily="geist"
              className="leading-6 text-grey">
              {isDescriptionExpanded ? trimmedDescription : `${trimmedDescription.slice(0, 120)}... `}
              <Text
                size="sm"
                fontFamily="geist-medium"
                onPress={toggleDescription}
                className="text-black">
                {isDescriptionExpanded ? ' less' : 'more'}
              </Text>
            </Text>
          ) : (
            <Text size="sm" fontFamily="geist" className="leading-6 text-grey">
              {trimmedDescription}
            </Text>
          )}
        </View>
      )}

      {/* Feed URL */}
      {(feed.link || feed.url) && (
        <Button
          variant="text"
          size="small"
          onPress={handleUrlPress}
          className="mb-4 h-auto flex-row items-center justify-start gap-2 px-0">
          <LinkMinimalistic2BoldIcon
            width={14}
            height={14}
            strokeWidth={2.4}
            color={colors.primary}
          />
          <Text
            size="sm"
            fontFamily="geist"
            className="flex-1 flex-shrink text-left"
            style={{ color: colors.primary, fontSize: 12 }}
            numberOfLines={1}>
            {feed.link || feed.url}
          </Text>
        </Button>
      )}

      {/* Feed Tags */}
      {(() => {
        const fallBackTags = (feed as any).tags;
        const displayTags =
          feed.tags_native && feed.tags_native.length > 0 ? feed.tags_native : fallBackTags;
        if (!displayTags || displayTags.length === 0) return null;
        return (
          <View className="mb-5 flex-row flex-wrap items-center gap-2">
            {displayTags.slice(0, 5).map((tag: string | { name: string }, index: number) => {
              const tagName = typeof tag === 'string' ? tag : (tag as any)?.name || 'Tag';
              const formattedTag = tagName.replace(/\s+/g, '-');
              return (
                <View
                  key={`${tagName}-${index.toString()}`}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1"
                  style={{ backgroundColor: colors.grey5 }}>
                  <Text size="sm" fontFamily="geist" style={{ color: colors.grey, fontSize: 11 }}>
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
        loading={isFollowLoading}
        leftIcon={
          isFollowing && !isFollowLoading ? (
            <TrashBinTrashBoldIcon width={16} height={16} color={colors === COLORS.dark ? '#fe4336' : '#EA4335'} />
          ) : undefined
        }
        style={
          isFollowing
            ? {
                backgroundColor: colors.grey6,
                borderWidth: 0,
              }
            : undefined
        }
        textClassName={isFollowing ? (colors === COLORS.dark ? 'text-destructive' : 'text-[#EA4335]') : undefined}>
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
});
