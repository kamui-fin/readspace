import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { stripHtml } from '@lib/utils/html';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
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
      router.push({
        pathname: `/(protected)/(tabs)/discover/feed/${feedId}`,
        params: {
          title,
          description,
          image_url: iconUrl,
        },
      });
    }
  };

  // Generate UI Avatars fallback URL
  const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=128&background=random&length=2&bold=true&format=png`;

  return (
    <Pressable
      onPress={handlePress}
      className={clsx(
        'flex-row items-center gap-4 py-4',
        isPreview ? 'bg-secondary/10 dark:bg-secondary/20' : 'dark:bg-white-dark bg-white',
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
              size="sm"
              fontFamily="geist-medium"
              className="uppercase tracking-wider"
              style={{
                color: colors.secondary,
                fontSize: 10,
              }}>
              Preview
            </Text>
          </View>
        )}
        <Text
          size="base"
          fontFamily="geist-semibold"
          className="dark:text-black-dark mb-1 text-black"
          numberOfLines={1}>
          {stripHtml(title)}
        </Text>
        <Text
          size="sm"
          fontFamily="geist"
          className="text-grey dark:text-grey-dark"
          numberOfLines={2}>
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
