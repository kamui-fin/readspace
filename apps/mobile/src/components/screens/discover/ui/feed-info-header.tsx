import { Button } from '@components/ui/button';
import { Chip } from '@components/ui/chip';
import { FeedFallbackIcon } from '@components/ui/feed-fallback-icon';
import { FeedIcon } from '@components/ui/feed-icon';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Feed, FeedDiscoveryResult } from '@readspace/shared';
import { LinkMinimalistic2Icon, TrashBinTrashIcon } from '@solar-icons/react-native/bold';
import {
  ArrowLeftIcon,
  LayersMinimalisticIcon,
  UserCircleIcon,
} from '@solar-icons/react-native/linear';
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

  const isDark = useIsDarkMode();
  const linkColor = isDark ? colors.secondary : colors.primary;

  return (
    <View className="px-4 pb-4 pt-2">
      {/* Back button row */}
      <View className="mb-6 flex-row items-center">
        <Button variant="icon" size="small" fullWidth={false} onPress={onBack}>
          <ArrowLeftIcon size={18} strokeWidth={2.4} color={greyColor} />
        </Button>
      </View>

      {/* Feed Icon + Title Row */}
      <View className="mb-4 flex-row items-center gap-4">
        {/* Feed Icon */}
        <View className="relative">
          <FeedIcon
            url={feed.image_url}
            fallbackComponent={({
              size = 80,
              className,
            }: {
              size?: number;
              className?: string;
            }) => (
              <FeedFallbackIcon
                feedName={feed.title}
                size={size}
                borderRadius={16}
                className={className}
              />
            )}
            size={80}
            borderRadius={16}
          />
          {isFeedDead && (
            <Chip
              label="Dead"
              variant="filled"
              size="small"
              className="bg-red absolute -right-1 -top-1"
              textClassName="text-white"
            />
          )}
        </View>

        {/* Title + meta info */}
        <View className="flex-1">
          <Text
            size="xl"
            fontFamily="geist-bold"
            className="tracking-heading mb-1 text-black"
            numberOfLines={2}>
            {feed.title || 'Untitled Feed'}
          </Text>

          {/* Author */}
          {author ? (
            <View className="mb-1 flex-row items-center gap-1.5">
              <UserCircleIcon size={13} color={greyColor} strokeWidth={1.8} />
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
              <LayersMinimalisticIcon size={13} color={greyColor} strokeWidth={1.8} />
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
            <Text size="sm" fontFamily="geist" className="text-grey leading-6">
              {isDescriptionExpanded
                ? trimmedDescription
                : `${trimmedDescription.slice(0, 120)}... `}
              <Text
                size="sm"
                fontFamily="geist-medium"
                onPress={toggleDescription}
                className="text-black">
                {isDescriptionExpanded ? ' less' : 'more'}
              </Text>
            </Text>
          ) : (
            <Text size="sm" fontFamily="geist" className="text-grey leading-6">
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
          <LinkMinimalistic2Icon size={14} strokeWidth={2.4} color={linkColor} />
          <Text
            size="sm"
            fontFamily="geist"
            className="flex-1 flex-shrink text-left"
            style={{ color: linkColor, fontSize: 12 }}
            numberOfLines={1}>
            {feed.link || feed.url}
          </Text>
        </Button>
      )}

      {/* Feed Tags */}
      {(() => {
        const fallBackTags = (feed as any).tags;
        const displayTagsRaw =
          feed.tags_native && feed.tags_native.length > 0 ? feed.tags_native : fallBackTags;
        if (!displayTagsRaw || displayTagsRaw.length === 0) return null;

        const displayTags: string[] = Array.from(
          new Set<string>(
            displayTagsRaw
              .flatMap((tag: string | { name: string }) => {
                const tagName = typeof tag === 'string' ? tag : (tag as any)?.name || '';
                return tagName.split(',');
              })
              .map((tag: string) => {
                const decoded = tag
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&apos;/g, "'")
                  .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
                  .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
                    String.fromCharCode(parseInt(hex, 16))
                  );
                return decoded.trim();
              })
              .filter(Boolean)
          )
        );

        if (displayTags.length === 0) return null;

        return (
          <View className="mb-5 flex-row flex-wrap items-center gap-2">
            {displayTags.slice(0, 5).map((tag: string, index: number) => {
              const formattedTag = tag.replace(/\s+/g, '-');
              return (
                <View
                  key={`${tag}-${index.toString()}`}
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
            <TrashBinTrashIcon size={16} color={colors === COLORS.dark ? '#fe4336' : '#EA4335'} />
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
        textClassName={
          isFollowing ? (colors === COLORS.dark ? 'text-destructive' : 'text-[#EA4335]') : undefined
        }>
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
