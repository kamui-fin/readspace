import { FolderPicker } from '@/components/FolderPicker';
import { cn } from '@/utils/cn';
import BottomSheet from '@gorhom/bottom-sheet';
import { useCreateFeed, useDeleteFeed } from '@readspace/shared';
import { useRouter } from 'expo-router';
import { forwardRef, useRef } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';
import { toast } from 'sonner-native';

export interface FeedListItemProps extends PressableProps {
    title: string;
    description: string;
    iconUrl?: string;
    isFollowing?: boolean;
    feedUrl?: string;
    className?: string;
    feedId?: string;
    onFollowRequest?: (feedUrl: string) => void;
    showFolderPicker?: boolean; // If false, use onFollowRequest callback instead
}

export const FeedListItem = forwardRef<React.ElementRef<typeof Pressable>, FeedListItemProps>(
    (
        {
            title,
            description,
            iconUrl,
            isFollowing = false,
            feedUrl,
            className,
            feedId,
            onFollowRequest,
            showFolderPicker = true,
            ...props
        },
        ref
    ) => {
        const router = useRouter();
        const folderPickerRef = useRef<BottomSheet>(null);

        const createFeed = useCreateFeed();
        const deleteFeed = useDeleteFeed();

        const handlePress = () => {
            // Navigate to feed preview
            if (feedId) {
                router.push(`/feed/${feedId}`);
            }
        };

        const handleFollowPress = (e: any) => {
            e.stopPropagation();

            if (isFollowing && feedId) {
                // Unfollow: delete the feed
                deleteFeed.mutate(
                    { feedId, silent: false },
                    {
                        onSuccess: () => {
                            toast.success('Unfollowed feed');
                        },
                        onError: () => {
                            toast.error('Failed to unfollow feed');
                        },
                    }
                );
            } else {
                // Follow: either use callback or show local folder picker
                if (onFollowRequest && feedUrl) {
                    onFollowRequest(feedUrl);
                } else if (showFolderPicker) {
                    folderPickerRef.current?.expand();
                }
            }
        };

        const handleFolderSelect = async (folderId: string) => {
            if (!feedUrl) {
                toast.error('Feed URL is missing');
                return;
            }

            createFeed.mutate(
                {
                    url: feedUrl,
                    folder_id: folderId,
                    silent: false,
                },
                {
                    onSuccess: () => {
                        toast.success('Following feed!');
                    },
                    onError: (error: any) => {
                        toast.error(error?.message || 'Failed to follow feed');
                    },
                }
            );
        };

        return (
            <>
                <Pressable
                    ref={ref}
                    onPress={handlePress}
                    className={cn('flex-row items-center gap-4 bg-white py-4', className)}
                    {...props}>
                    {/* Icon */}
                    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-mid-grey">
                        {iconUrl ? (
                            <Image
                                source={{ uri: iconUrl }}
                                className="h-full w-full"
                                resizeMode="cover"
                            />
                        ) : (
                            <Text className="font-geist-bold text-lg text-grey">
                                {title.charAt(0).toUpperCase()}
                            </Text>
                        )}
                    </View>

                    {/* Content */}
                    <View className="flex-1">
                        <Text
                            className="mb-1 font-geist-semibold text-base text-black"
                            numberOfLines={1}>
                            {title}
                        </Text>
                        <Text className="font-geist text-sm text-grey" numberOfLines={2}>
                            {description}
                        </Text>
                    </View>

                    {/* Follow Button */}
                    <Pressable
                        onPress={handleFollowPress}
                        disabled={createFeed.isPending || deleteFeed.isPending}
                        className={cn(
                            'rounded-full border px-4 py-2',
                            isFollowing ? 'border-mid-grey' : 'border-primary bg-primary',
                            (createFeed.isPending || deleteFeed.isPending) && 'opacity-50'
                        )}>
                        <Text
                            className={cn(
                                'font-geist-semibold text-sm',
                                isFollowing ? 'text-grey' : 'text-white'
                            )}>
                            {createFeed.isPending || deleteFeed.isPending
                                ? '...'
                                : isFollowing
                                    ? 'Following'
                                    : 'Follow'}
                        </Text>
                    </Pressable>
                </Pressable>

                {/* Folder Picker Bottom Sheet - Only render if using local picker */}
                {showFolderPicker && !onFollowRequest && (
                    <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
                )}
            </>
        );
    }
);

FeedListItem.displayName = 'FeedListItem';
