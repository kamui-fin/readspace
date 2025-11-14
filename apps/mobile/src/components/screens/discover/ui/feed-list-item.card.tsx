import { useState } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';
import { useRouter } from 'expo-router';
import { stripHtml } from '@lib/utils/html';
import { FollowButton } from './follow.button';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import clsx from 'clsx';

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
  disableNavigation?: boolean; // Disable navigation to feed details
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
  disableNavigation = false,
  ...props
}: FeedListItemProps) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const handlePress = () => {
    if (!disableNavigation) {
      router.push(`/(protected)/(tabs)/discover/feed/${feedId}`);
    }
  };

  // Generate UI Avatars fallback URL
  const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=128&background=random&length=2&bold=true&format=png`;

  return (
    <Pressable
      onPress={handlePress}
      className={clsx(
        'flex-row items-center gap-4 py-4',
        isPreview ? 'bg-secondary/10 dark:bg-secondary/20' : 'bg-white dark:bg-white-dark',
        className
      )}
      {...props}>
      {/* Icon */}
      <View
        className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg"
        style={{
          backgroundColor: colors.grey5,
        }}>
        {iconUrl && !imageError ? (
          <Image
            source={{ uri: iconUrl }}
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
        {/* Preview Badge */}
        {isPreview && (
          <View
            className="mb-1 self-start rounded-sm px-1.5 py-0.5"
            style={{
              backgroundColor: `${colors.secondary}33`,
            }}>
            <Text
              className="font-geist-medium text-[10px] uppercase tracking-wider"
              style={{
                color: colors.secondary,
              }}>
              Preview
            </Text>
          </View>
        )}
        <Text
          className="mb-1 font-geist-semibold text-base text-black dark:text-black-dark"
          numberOfLines={1}>
          {stripHtml(title)}
        </Text>
        <Text className="font-geist text-sm text-grey dark:text-grey-dark" numberOfLines={2}>
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
      />
    </Pressable>
  );
};
