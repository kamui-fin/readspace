import { FollowButton } from '@/components/FollowButton';
import { cn } from '@/utils/cn';
import { stripHtml } from '@/utils/html';
import { useRouter } from 'expo-router';
import { forwardRef } from 'react';
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
            ...props
        },
        ref
    ) => {
        const router = useRouter();

        const handlePress = () => {
            router.push(`/discover/feed/${feedId}`);
        };

        return (
            <>
                <Pressable
                    ref={ref}
                    onPress={handlePress}
                    className={cn(
                        'flex-row items-center gap-4 py-4',
                        isPreview ? 'bg-secondary/10 dark:bg-secondary/20' : 'bg-white dark:bg-white-dark',
                        className
                    )}
                    {...props}>
                    {/* Icon */}
                    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-mid-grey dark:bg-mid-grey-dark">
                        {iconUrl ? (
                            <Image
                                source={{ uri: iconUrl }}
                                className="h-full w-full"
                                resizeMode="cover"
                            />
                        ) : (
                            <Text className="font-geist-bold text-lg text-grey dark:text-grey-dark">
                                {title.charAt(0).toUpperCase()}
                            </Text>
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
            </>
        );
    }
);

FeedListItem.displayName = 'FeedListItem';
