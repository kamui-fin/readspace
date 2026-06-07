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
import { useLimitChecker } from '@hooks/useLimitChecker';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

const followButtonVariants = cva('flex-row items-center gap-2', {
  variants: {
    variant: {
      default: 'rounded-full px-4 py-2',
      large: 'rounded-full px-6 py-3 justify-center',
    },
    following: {
      true: '',
      false: 'border',
    },
  },
  compoundVariants: [
    {
      variant: 'default',
      following: true,
      class: '',
    },
    {
      variant: 'default',
      following: false,
      class: 'border-primary bg-primary dark:border-primary dark:bg-primary',
    },
    {
      variant: 'large',
      following: true,
      class: 'bg-background',
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
      true: 'text-grey ',
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
  onUnfollowRequest?: (feedId: string) => void | Promise<void>; // For onboarding flow
  disabled?: boolean;
}

export function FollowButton({
  feedId,
  feedUrl,
  isFollowing,
  variant = 'default',
  className,
  showFolderPicker = true,
  onFollowRequest,
  onUnfollowRequest,
  disabled = false,
}: FollowButtonProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const folderPickerRef = useRef<FolderPickerBottomSheetRef>(null);

  const createFeed = useCreateFeed();
  const deleteFeed = useDeleteFeed();
  const { data: userFeeds } = useFeeds();
  const { checkAndTriggerUpgrade } = useLimitChecker();

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
    if (!checkAndTriggerUpgrade('feed')) {
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
      if (!showFolderPicker && onUnfollowRequest) {
        setOptimisticFollowing(false);
        try {
          await onUnfollowRequest(feedId);
        } catch {
          setOptimisticFollowing(null);
        }
      } else {
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
      }
    } else {
      // Follow
      if (!checkAndTriggerUpgrade('feed')) {
        return;
      }
      if (!showFolderPicker && onFollowRequest && feedUrl) {
        // Onboarding flow: use custom follow handler
        setOptimisticFollowing(true);
        try {
          await onFollowRequest(feedUrl);
          // Keep optimistic state - will clear when actuallyFollowing updates
        } catch {
          // On error, clear optimistic state
          setOptimisticFollowing(null);
        }
      } else if (showFolderPicker) {
        // Normal flow: open folder picker
        folderPickerRef.current?.present();
      }
    }
  };

  // Use starting state (actuallyFollowing) during loading to prevent abrupt color transitions
  const isStylingFollowing = isLoading ? actuallyFollowing : displayFollowing;

  // Dynamically resolve follow button style to guarantee perfect contrast and visibility
  const buttonStyle = useMemo(() => {
    if (isStylingFollowing) {
      return {
        backgroundColor: colors.grey6, // Solid gray surface for high contrast
        borderWidth: 0, // Borderless
      };
    }
    return {
      backgroundColor: colors.primary, // Notion brand green
      borderColor: colors.primary,
      opacity: disabled ? 0.4 : 1,
    };
  }, [isStylingFollowing, colors, disabled]);

  const textStyle = useMemo(() => {
    if (isStylingFollowing) {
      return {
        color: isDark ? colors.grey2 : colors.grey, // Clean grey text, no red!
      };
    }
    return {
      color: '#ffffff', // High contrast white text on green
    };
  }, [isStylingFollowing, colors, isDark]);

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={isLoading || disabled}
        className={clsx(
          followButtonVariants({
            variant: variant || 'default',
            following: isStylingFollowing,
          }),
          isLoading && 'opacity-50',
          className
        )}
        style={buttonStyle}>
        {isLoading ? (
          <View style={{ transform: [{ scale: 0.75 }] }}>
            <Spinner
              size="small"
              color={isStylingFollowing ? (isDark ? colors.grey2 : colors.grey) : '#ffffff'}
            />
          </View>
        ) : null}
        <Text
          size={variant === 'large' ? 'base' : 'sm'}
          fontFamily="geist-semibold"
          className={followButtonTextVariants({
            variant: variant || 'default',
            following: isStylingFollowing,
          })}
          style={textStyle}>
          {createFeed.isPending
            ? 'Following...'
            : deleteFeed.isPending
              ? 'Unfollowing...'
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
