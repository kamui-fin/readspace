import { COLORS } from '@/constants/Colors';
import { FeedListItem } from '@/components/FeedListItem';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { LibraryIcon } from '@/components/ui/icons/LibraryIcon';
import { useAuth } from '@/contexts/AuthProvider';
import { useGetRecommendations, useRefreshFeed, useSubscribeToFeed } from '@readspace/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { toast } from 'sonner-native';

export default function FeedRecommendationsStep() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const { categories } = useLocalSearchParams<{ categories: string }>();
    const [subscribedFeeds, setSubscribedFeeds] = useState<string[]>([]);

    const subscribeToFeed = useSubscribeToFeed();
    const refreshFeed = useRefreshFeed();
    const { checkOnboardingStatus } = useAuth();

    // Parse categories from URL param
    const categoryList = categories ? categories.split(',') : [];

    // Fetch recommendations based on selected categories
    const {
        data: recommendationsData,
        isLoading,
        error,
    } = useGetRecommendations(categoryList, { limit: 20 });

    const handleFollowRequest = async (feedUrl: string) => {
        const feed = recommendationsData?.results.find((f: any) => f.url === feedUrl);
        if (!feed) return;

        try {
            // Subscribe to feed with default folder (backend will handle creating default folder)
            await subscribeToFeed.mutateAsync({
                feedId: feed.id,
                folderId: 'default', // Backend will handle this
            });

            // Track subscribed feed
            setSubscribedFeeds((prev) => [...prev, feed.id]);

            // Trigger background refresh - user doesn't need to wait
            refreshFeed.mutate({
                feedId: feed.id,
                forceRefetch: true,
            });

            // Button state changes to "Following", no toast needed
        } catch (error) {
            console.error('Failed to subscribe:', error);
            toast.error('Failed to follow feed');
        }
    };

    const handleFinish = async () => {
        // Update onboarding status before navigating
        await checkOnboardingStatus();
        // Navigate to main app
        router.replace('/(tabs)');
    };

    const minFollowCount = 3;
    const canFinish = subscribedFeeds.length >= minFollowCount;
    const iconColor = colorScheme === 'dark' ? COLORS.dark.grey : COLORS.light.grey;

    // Loading state with skeleton
    if (isLoading) {
        return (
            <OnboardingLayout
                currentStep={1}
                totalSteps={2}
                icon={<LibraryIcon size={24} color={iconColor} />}
                title="Curating your newsfeed..."
                subtitle="Finding quality sources that match your interests">
                <View className="flex-1">
                    {/* Skeleton loaders */}
                    {Array.from({ length: 3 }).map((_, i) => (
                        <View
                            key={i}
                            className="mb-4 flex-row items-center gap-4 rounded-lg bg-mid-grey/20 p-4 dark:bg-mid-grey-dark/20">
                            <View className="h-12 w-12 animate-pulse rounded-lg bg-mid-grey dark:bg-mid-grey-dark" />
                            <View className="flex-1">
                                <View className="mb-2 h-4 w-3/4 animate-pulse rounded bg-mid-grey dark:bg-mid-grey-dark" />
                                <View className="mb-1 h-3 w-1/2 animate-pulse rounded bg-mid-grey/70 dark:bg-mid-grey-dark/70" />
                                <View className="h-3 w-full animate-pulse rounded bg-mid-grey/70 dark:bg-mid-grey-dark/70" />
                            </View>
                        </View>
                    ))}
                </View>
            </OnboardingLayout>
        );
    }

    // Error state
    if (error || !recommendationsData?.results?.length) {
        return (
            <OnboardingLayout
                currentStep={1}
                totalSteps={2}
                icon={<LibraryIcon size={24} color={iconColor} />}
                title="Having trouble finding sources"
                subtitle="We couldn't load publications for your selected topics">
                <View className="flex-1 items-center justify-center">
                    <Text className="mb-4 text-center font-geist text-base text-grey dark:text-grey-dark">
                        We couldn't load publications for your selected topics.
                    </Text>
                    <Button variant="primary" size="lg" fullWidth onPress={() => router.back()}>
                        Go Back
                    </Button>
                </View>
            </OnboardingLayout>
        );
    }

    return (
        <OnboardingLayout
            currentStep={1}
            totalSteps={2}
            icon={<LibraryIcon size={24} color={iconColor} />}
            title="Picked for you"
            subtitle="Here are some top feeds based on your interests">
            <View className="flex-1">
                <ScrollView className="mb-2 flex-1" showsVerticalScrollIndicator={false}>
                    {recommendationsData.results.map((feed: any) => (
                        <FeedListItem
                            key={feed.id}
                            title={feed.title || 'Untitled Feed'}
                            description={feed.description || ''}
                            iconUrl={feed.image_url}
                            feedUrl={feed.url}
                            feedId={feed.id}
                            onFollowRequest={handleFollowRequest}
                            showFolderPicker={false}
                            disableNavigation={true}
                            className="border-b border-mid-grey dark:border-mid-grey-dark"
                        />
                    ))}
                </ScrollView>

                {subscribedFeeds.length > 0 && (
                    <View className="mb-4 mt-2">
                        <Text className="text-center font-geist text-sm text-grey dark:text-grey-dark">
                            {subscribedFeeds.length} source{subscribedFeeds.length === 1 ? '' : 's'}{' '}
                            added
                            {subscribedFeeds.length < minFollowCount &&
                                ` • ${minFollowCount - subscribedFeeds.length} more to go`}
                        </Text>
                    </View>
                )}

                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleFinish}
                    disabled={!canFinish || subscribeToFeed.isPending}>
                    {subscribeToFeed.isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : canFinish ? (
                        'Start reading!'
                    ) : (
                        `Follow at least ${minFollowCount} feeds (${subscribedFeeds.length}/${minFollowCount})`
                    )}
                </Button>
            </View>
        </OnboardingLayout>
    );
}
