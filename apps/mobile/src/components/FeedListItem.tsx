import { FollowButton } from '@/components/FollowButton';
import { cn } from '@/utils/cn';
import { stripHtml } from '@/utils/html';
import { useRouter } from 'expo-router';
import { forwardRef, useState } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

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

export const FeedListItem = forwardRef<React.ElementRef<typeof Pressable>, FeedListItemProps>(
    (
        {
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
        },
        ref
    ) => {
        const router = useRouter();
        const [imageError, setImageError] = useState(false);

        const handlePress = () => {
            if (!disableNavigation) {
                router.push(`/discover/feed/${feedId}`);
            }
        };

        // Generate UI Avatars fallback URL
        const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=128&background=random&length=2&bold=true&format=png`;

        return (
            <>
                <Pressable
                    ref={ref}
                    onPress={handlePress}
                    className={cn(
                        'flex-row items-center gap-4 py-4',
                        isPreview
                            ? 'bg-secondary/10 dark:bg-secondary/20'
                            : 'bg-white dark:bg-white-dark',
                        className
                    )}
                    {...props}>
                    {/* Icon */}
                    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-mid-grey dark:bg-mid-grey-dark">
                        {iconUrl && !imageError ? (
                            <Image
                                source={{ uri: iconUrl }}
                                className="h-full w-full"
                                resizeMode="cover"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <Image
                                source={{ uri: fallbackAvatarUrl }}
                                className="h-full w-full"
                                resizeMode="cover"
                            />
                        )}
                    </View>

                    {/* Content */}
                    <View className="flex-1">
                        {/* Preview Badge */}
                        {isPreview && (
                            <View className="mb-1 self-start rounded-sm bg-secondary/20 px-1.5 py-0.5">
                                <Text className="font-geist-medium text-[10px] uppercase tracking-wider text-secondary">
                                    Preview
                                </Text>
                            </View>
                        )}
                        <Text
                            className="mb-1 font-geist-semibold text-base text-black dark:text-black-dark"
                            numberOfLines={1}>
                            {stripHtml(title)}
                        </Text>
                        <Text
                            className="font-geist text-sm text-grey dark:text-grey-dark"
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
            </>
        );
    }
);

FeedListItem.displayName = 'FeedListItem';
