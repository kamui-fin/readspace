import AddCircleBoldDuotoneIcon from '@components/icons/solar/add-circle-bold-duotone';
import CheckCircleBoldDuotoneIcon from '@components/icons/solar/check-circle-bold-duotone';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { stripHtml } from '@lib/utils/html';
import { useCreateFeed, useDeleteFeed } from '@readspace/shared';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

export interface OnboardingFeedItemProps {
  feedId: string;
  feedUrl: string;
  title: string;
  description: string;
  iconUrl?: string;
  isFollowing: boolean;
  onSubscribed: () => void | Promise<void>;
  onUnsubscribed: () => void | Promise<void>;
}

export const OnboardingFeedItem = ({
  feedId,
  feedUrl,
  title,
  description,
  iconUrl,
  isFollowing,
  onSubscribed,
  onUnsubscribed,
}: OnboardingFeedItemProps) => {
  const [imageError, setImageError] = useState(false);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const createFeed = useCreateFeed();
  const deleteFeed = useDeleteFeed();

  const isLoading = createFeed.isPending || deleteFeed.isPending;

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isFollowing) {
      // Optimistic update
      onUnsubscribed();
      deleteFeed.mutate(
        { feedId, silent: true },
        {
          onError: () => {
            toast.error('Failed to unfollow feed');
            // Revert optimistic update
            onSubscribed();
          },
        }
      );
    } else {
      // Optimistic update
      onSubscribed();
      createFeed.mutate(
        { url: feedUrl }, // folder_id is omitted so it uses None on the backend (default folder)
        {
          onError: (error: any) => {
            toast.error(error?.message || 'Failed to follow feed');
            // Revert optimistic update
            onUnsubscribed();
          },
        }
      );
    }
  };

  const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    title
  )}&size=128&background=random&length=2&bold=true&format=png`;

  return (
    <View className="flex-row items-center gap-4 bg-transparent py-3">
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
        <Text
          size="base"
          fontFamily="geist-semibold"
          className="mb-1 tracking-tight text-black dark:text-white"
          numberOfLines={1}>
          {stripHtml(title)}
        </Text>
        <Text size="sm" fontFamily="geist" className="text-grey" numberOfLines={2}>
          {stripHtml(description)}
        </Text>
      </View>

      {/* Action Button */}
      <Pressable
        onPress={handlePress}
        disabled={isLoading}
        className="p-2 transition-opacity active:opacity-60">
        {isFollowing ? (
          <CheckCircleBoldDuotoneIcon width={32} height={32} color={colors.secondary} />
        ) : (
          <AddCircleBoldDuotoneIcon width={32} height={32} color={colors.grey3} />
        )}
      </Pressable>
    </View>
  );
};
