import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { useCreateFeed, useDeleteFeed, useFeeds } from '@readspace/shared';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

const followButtonVariants = cva('flex-row items-center gap-2 border', {
  variants: {
    variant: {
      default: 'rounded-full px-4 py-2',
      large: 'rounded-2xl px-6 py-3 justify-center',
    },
    following: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      variant: 'default',
      following: true,
      class: 'border-grey4 dark:border-grey4-dark',
    },
    {
      variant: 'default',
      following: false,
      class: 'border-primary bg-primary dark:border-primary dark:bg-primary',
    },
    {
      variant: 'large',
      following: true,
      class: 'border border-grey4 bg-white dark:border-grey4-dark dark:bg-white-dark',
    },
    {
      variant: 'large',
      following: false,
      class: 'bg-primary dark:bg-primary',
    },
  ],
  defaultVariants: {
    variant: 'default',
    following: false,
  },
});

const followButtonTextVariants = cva('', {
  variants: {
    variant: {
      default: '',
      large: '',
    },
    following: {
      true: 'text-grey dark:text-grey-dark',
      false: 'text-white dark:text-white',
    },
  },
  defaultVariants: {
    variant: 'default',
    following: false,
  },
});

interface FollowButtonProps extends VariantProps<typeof followButtonVariants> {
  feedId: string;
  feedUrl?: string; // For onboarding flow
  isFollowing: boolean; // From feed data (discover/trending)
  className?: string;
  showFolderPicker?: boolean; // If false, use onFollowRequest instead
  onFollowRequest?: (feedUrl: string) => void | Promise<void>; // For onboarding flow
}

export function FollowButton({
  feedId,
  feedUrl,
  isFollowing,
  variant = 'default',
  className,
  showFolderPicker = true,
  onFollowRequest,
}: FollowButtonProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const folderPickerRef = useRef<FolderPickerBottomSheetRef>(null);

  const createFeed = useCreateFeed();
  const deleteFeed = useDeleteFeed();
  const { data: userFeeds } = useFeeds();

  // Track optimistic state
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);

  // Check if we're actually subscribed by looking at user's feed list
  const actuallyFollowing =
    userFeeds?.subscriptions?.some((sub) => sub.feed.id === feedId) ?? isFollowing;

  // Clear optimistic state when actual state catches up and matches it
  useEffect(() => {
    if (optimisticFollowing !== null && optimisticFollowing === actuallyFollowing) {
      setOptimisticFollowing(null);
    }
  }, [optimisticFollowing, actuallyFollowing]);

  // Determine display state: optimistic state overrides actual state
  const displayFollowing = optimisticFollowing !== null ? optimisticFollowing : actuallyFollowing;
  const isLoading = createFeed.isPending || deleteFeed.isPending;

  const handleFolderSelect = (folderId: string | null) => {
    if (!feedUrl) {
      toast.error('Cannot subscribe: Missing Feed URL');
      return;
    }
    setOptimisticFollowing(true);
    createFeed.mutate(
      { url: feedUrl, folder_id: folderId || '' },
      {
        onSuccess: () => {
          toast.success('Subscribed to feed');
          // Keep optimistic state, it will clear via useEffect
        },
        onError: (error: any) => {
          toast.error(error?.message || 'Failed to follow feed');
          setOptimisticFollowing(null);
        },
      }
    );
  };

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (displayFollowing) {
      // Unfollow
      setOptimisticFollowing(false);
      deleteFeed.mutate(
        { feedId, silent: false },
        {
          onSuccess: () => {
            toast.success('Unfollowed feed');
            // Keep optimistic state - will clear when actuallyFollowing updates
          },
          onError: () => {
            toast.error('Failed to unfollow feed');
            // On error, clear optimistic state immediately
            setOptimisticFollowing(null);
          },
        }
      );
    } else {
      // Follow
      if (!showFolderPicker && onFollowRequest && feedUrl) {
        // Onboarding flow: use custom follow handler
        setOptimisticFollowing(true);
        try {
          await onFollowRequest(feedUrl);
          // Keep optimistic state - will clear when actuallyFollowing updates
        } catch (error) {
          // On error, clear optimistic state
          setOptimisticFollowing(null);
        }
      } else if (showFolderPicker) {
        // Normal flow: open folder picker
        folderPickerRef.current?.present();
      }
    }
  };

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={isLoading}
        className={clsx(
          followButtonVariants({
            variant: variant || 'default',
            following: displayFollowing,
          }),
          isLoading && 'opacity-50',
          className
        )}>
        {isLoading && (
          <View style={{ transform: [{ scale: 0.75 }] }}>
            <Spinner size="small" color={displayFollowing ? colors.grey : colors.white} />
          </View>
        )}
        <Text
          size={variant === 'large' ? 'base' : 'sm'}
          fontFamily="geist-semibold"
          className={followButtonTextVariants({
            variant: variant || 'default',
            following: displayFollowing,
          })}>
          {createFeed.isPending
            ? 'Following...'
            : deleteFeed.isPending
              ? variant === 'large'
                ? 'Unfollowing...'
                : 'Unfollowing...'
              : displayFollowing
                ? variant === 'large'
                  ? 'Unfollow'
                  : 'Following'
                : 'Follow'}
        </Text>
      </Pressable>
      {showFolderPicker && (
        <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      )}
    </>
  );
}
