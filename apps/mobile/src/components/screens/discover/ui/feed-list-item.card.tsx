import { FeedFallbackIcon } from '@components/ui/feed-fallback-icon';
import { FeedIcon } from '@components/ui/feed-icon';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { stripHtml } from '@lib/utils/html';
import clsx from 'clsx';
import { Link } from 'expo-router';
import { Pressable, type PressableProps, View } from 'react-native';
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
  const isDark = useIsDarkMode();
  const _colors = COLORS[isDark ? 'dark' : 'light'];

  const Fallback = ({ size = 48, className }: { size?: number; className?: string }) => (
    <FeedFallbackIcon feedName={title} size={size} borderRadius={8} className={className} />
  );

  const innerPressable = (
    <Pressable className={clsx('flex-row items-center gap-4 py-3', className)} {...props}>
      {/* Icon */}
      <FeedIcon url={iconUrl} fallbackComponent={Fallback} size={48} borderRadius={8} />

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
