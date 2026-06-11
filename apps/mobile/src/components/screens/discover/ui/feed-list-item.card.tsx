import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { stripHtml } from '@lib/utils/html';
import { resolveSupabaseImageUrl } from '@lib/utils/network';
import clsx from 'clsx';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, type PressableProps, View } from 'react-native';
import { FollowButton } from './follow.button';

export interface FeedListItemProps extends PressableProps {
  title: string;
  description: string;
  iconUrl?: string;
  isFollowing?: boolean;
  className?: string;
  feedId: string;
  feedUrl?: string; // For onboarding flow
  isPreview?: boolean;
  showFolderPicker?: boolean; // If false, use onFollowRequest instead
  onFollowRequest?: (feedUrl: string) => void | Promise<void>; // For onboarding flow
  onUnfollowRequest?: (feedId: string) => void | Promise<void>; // For onboarding flow
  disableNavigation?: boolean; // Disable navigation to feed details
  disabled?: boolean;
}

export const FeedListItem = ({
  title,
  description,
  iconUrl,
  isFollowing = false,
  className,
  feedId,
  feedUrl,
  isPreview = false,
  showFolderPicker = true,
  onFollowRequest,
  onUnfollowRequest,
  disableNavigation = false,
  disabled = false,
  ...props
}: FeedListItemProps) => {
  const [imageError, setImageError] = useState(false);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  // Generate UI Avatars fallback URL
  const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=128&background=random&length=2&bold=true&format=png`;

  const innerPressable = (
    <Pressable className={clsx('flex-row items-center gap-4 py-3', className)} {...props}>
      {/* Icon */}
      <View
        className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg"
        style={{
          backgroundColor: colors.grey5,
        }}>
        {iconUrl && !imageError ? (
          <Image
            source={{ uri: resolveSupabaseImageUrl(iconUrl) }}
            className="h-full w-full"
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Image source={{ uri: fallbackAvatarUrl }} className="h-full w-full" resizeMode="cover" />
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text
          size="base"
          fontFamily="geist-semibold"
          className="mb-1 tracking-tight text-black"
          numberOfLines={1}>
          {stripHtml(title)}
        </Text>
        <Text size="sm" fontFamily="geist" className="text-grey" numberOfLines={2}>
          {stripHtml(description)}
        </Text>
      </View>

      {/* Follow Button */}
      <FollowButton
        feedId={feedId}
        feedUrl={feedUrl}
        isFollowing={isFollowing}
        showFolderPicker={showFolderPicker}
        onFollowRequest={onFollowRequest}
        onUnfollowRequest={onUnfollowRequest}
        disabled={disabled}
      />
    </Pressable>
  );

  if (disableNavigation) {
    return innerPressable;
  }

  return (
    <Link href={`/(protected)/(tabs)/discover/feed/${feedId}`} asChild>
      {innerPressable}
    </Link>
  );
};
