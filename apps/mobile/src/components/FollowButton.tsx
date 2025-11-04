import { cn } from '@/utils/cn';
import { useFolderPicker } from '@/contexts/FolderPickerContext';
import { useDeleteFeed, useFeeds, useSubscribeToFeed } from '@readspace/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { toast } from 'sonner-native';

interface FollowButtonProps {
    feedId: string;
    feedUrl?: string; // For onboarding flow
    isFollowing: boolean; // From feed data (discover/trending)
    variant?: 'default' | 'large';
    className?: string;
    showFolderPicker?: boolean; // If false, use onFollowRequest instead (for onboarding)
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
    // Make FolderPickerContext optional - it may not be available during onboarding
    let openPicker: ((callback: (folderId: string) => void) => void) | undefined;
    try {
        const context = useFolderPicker();
        openPicker = context?.openPicker;
    } catch {
        // FolderPickerContext not available (e.g., during onboarding)
        openPicker = undefined;
    }

    const subscribeToFeed = useSubscribeToFeed();
    const deleteFeed = useDeleteFeed();
    const { data: userFeeds } = useFeeds();

    // Track optimistic state
    const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);

    // Check if we're actually subscribed by looking at user's feed list
    const actuallyFollowing = userFeeds?.some((feed) => feed.id === feedId) ?? isFollowing;

    // Clear optimistic state when actual state catches up and matches it
    useEffect(() => {
        if (optimisticFollowing !== null && optimisticFollowing === actuallyFollowing) {
            setOptimisticFollowing(null);
        }
    }, [optimisticFollowing, actuallyFollowing]);

    // Determine display state: optimistic state overrides actual state
    const displayFollowing = optimisticFollowing !== null ? optimisticFollowing : actuallyFollowing;
    const isLoading = subscribeToFeed.isPending || deleteFeed.isPending;

    const handlePress = async (e?: any) => {
        e?.stopPropagation?.();

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
            } else if (openPicker) {
                // Normal flow: open folder picker
                openPicker((folderId) => {
                    setOptimisticFollowing(true);
                    subscribeToFeed.mutate(
                        { feedId, folderId },
                        {
                            onSuccess: () => {
                                // Keep optimistic state, it will clear via useEffect
                            },
                            onError: (error: any) => {
                                toast.error(error?.message || 'Failed to follow feed');
                                setOptimisticFollowing(null);
                            },
                        }
                    );
                });
            } else {
                console.error('FollowButton: Neither onFollowRequest nor openPicker available');
            }
        }
    };

    if (variant === 'large') {
        return (
            <Pressable
                onPress={handlePress}
                disabled={isLoading}
                className={cn(
                    'flex-row items-center justify-center gap-2 rounded-2xl px-6 py-3',
                    displayFollowing
                        ? 'border border-mid-grey bg-white dark:border-mid-grey-dark dark:bg-white-dark'
                        : 'bg-primary dark:bg-primary',
                    isLoading && 'opacity-50',
                    className
                )}>
                {isLoading && (
                    <ActivityIndicator
                        size="small"
                        color={displayFollowing ? '#90988B' : '#FFFFFF'}
                    />
                )}
                <Text
                    className={cn(
                        'font-geist-semibold text-base',
                        displayFollowing
                            ? 'text-grey dark:text-grey-dark'
                            : 'text-white dark:text-white'
                    )}>
                    {subscribeToFeed.isPending
                        ? 'Following...'
                        : deleteFeed.isPending
                          ? 'Unfollowing...'
                          : displayFollowing
                            ? 'Unfollow'
                            : 'Follow'}
                </Text>
            </Pressable>
        );
    }

    // Default variant (small, for list items)
    return (
        <Pressable
            onPress={handlePress}
            disabled={isLoading}
            className={cn(
                'flex-row items-center gap-2 rounded-full border px-4 py-2',
                displayFollowing
                    ? 'border-mid-grey dark:border-mid-grey-dark'
                    : 'border-primary bg-primary dark:border-primary dark:bg-primary',
                isLoading && 'opacity-50',
                className
            )}>
            {isLoading && (
                <ActivityIndicator size="small" color={displayFollowing ? '#90988B' : '#FFFFFF'} />
            )}
            <Text
                className={cn(
                    'font-geist-semibold text-sm',
                    displayFollowing
                        ? 'text-grey dark:text-grey-dark'
                        : 'text-white dark:text-white'
                )}>
                {subscribeToFeed.isPending
                    ? 'Following...'
                    : deleteFeed.isPending
                      ? 'Unfollowing...'
                      : displayFollowing
                        ? 'Following'
                        : 'Follow'}
            </Text>
        </Pressable>
    );
}
