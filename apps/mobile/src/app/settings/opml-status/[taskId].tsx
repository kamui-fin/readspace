import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/Colors';
import { Monicon } from '@monicon/native';
import { ApiClient, RSS_QUERY_KEYS, useImportTaskStatus } from '@readspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

// Animated ticker component for counting animations
const AnimatedTicker = ({
    value,
    duration = 600,
    color,
    fontSize = 16,
    fontWeight = '600',
}: {
    value: number;
    duration?: number;
    color: string;
    fontSize?: number;
    fontWeight?: string;
}) => {
    const animatedValue = useSharedValue(value);

    useEffect(() => {
        // Use spring animation to match the progress bar
        animatedValue.value = withSpring(value, {
            damping: 20,
            stiffness: 100,
        });
    }, [value, animatedValue]);

    const animatedProps = useAnimatedStyle(() => ({
        opacity: 1,
    }));

    const displayValue = useDerivedValue(() => {
        return Math.round(animatedValue.value);
    });

    return (
        <Animated.Text
            style={[
                animatedProps,
                {
                    color,
                    fontSize,
                    fontWeight: fontWeight as any,
                    fontFamily: 'Geist_600SemiBold',
                },
            ]}>
            {displayValue.value}
        </Animated.Text>
    );
};

// Individual tick component to avoid hooks in callbacks
const ProgressTick = ({
    tickProgress,
    progressValue,
    colors,
}: {
    tickProgress: number;
    progressValue: any;
    colors: any;
}) => {
    const animatedStyle = useAnimatedStyle(() => {
        const isActive = progressValue.value >= tickProgress;
        const opacity = isActive ? 1 : 0.2;

        // Gradient from light green to dark green
        const backgroundColor = interpolateColor(
            tickProgress,
            [0, 1],
            [colors.secondary, colors.secondary]
        );

        return {
            opacity: withTiming(opacity, { duration: 300 }),
            backgroundColor,
            transform: [
                {
                    scaleY: withSpring(isActive ? 1 : 0.6, {
                        damping: 15,
                        stiffness: 200,
                    }),
                },
            ],
        };
    });

    return (
        <Animated.View
            style={[
                {
                    width: 3,
                    height: 16,
                    borderRadius: 1.5,
                    marginHorizontal: 1,
                },
                animatedStyle,
            ]}
        />
    );
};

// Progress bar with gradient ticks
const TickProgressBar = ({
    progress,
    totalTicks = 35,
    colors,
}: {
    progress: number; // 0-1
    totalTicks?: number;
    colors: any;
}) => {
    const progressValue = useSharedValue(0);

    useEffect(() => {
        progressValue.value = withSpring(progress, {
            damping: 20,
            stiffness: 100,
        });
    }, [progress, progressValue]);

    const ticks = Array.from({ length: totalTicks }, (_, i) => {
        const tickProgress = (i + 1) / totalTicks;

        return (
            <ProgressTick
                key={i}
                tickProgress={tickProgress}
                progressValue={progressValue}
                colors={colors}
            />
        );
    });

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 20,
                width: '100%',
                justifyContent: 'space-between',
            }}>
            {ticks}
        </View>
    );
};

// Mock data for different states
const MOCK_STATES = {
    pending: {
        status: 'pending' as const,
        message: 'Your import will start processing shortly.',
        result: null,
        error: null,
    },
    in_progress_25: {
        status: 'in_progress' as const,
        message: 'Importing feeds...',
        progress: {
            completed: 31,
            total: 340,
            successful: 14,
            already_existed: 0,
            failed: 17,
        },
        error: null,
    },
    in_progress_50: {
        status: 'in_progress' as const,
        message: 'Importing feeds...',
        progress: {
            completed: 170,
            total: 340,
            successful: 120,
            already_existed: 25,
            failed: 25,
        },
        error: null,
    },
    in_progress_75: {
        status: 'in_progress' as const,
        message: 'Importing feeds...',
        progress: {
            completed: 255,
            total: 340,
            successful: 200,
            already_existed: 45,
            failed: 10,
        },
        error: null,
    },
    completed: {
        status: 'completed' as const,
        message: 'Import completed successfully!',
        result: {
            total_feeds: 340,
            estimated_feeds: 340,
            summary: {
                successful: 287,
                already_existed: 38,
                failed: 15,
            },
            errors: [
                {
                    title: 'TechCrunch',
                    url: 'https://techcrunch.com/feed/',
                    error: 'Feed timeout after 30 seconds',
                    status: 'failed',
                },
                {
                    title: 'The Verge',
                    url: 'https://www.theverge.com/rss/index.xml',
                    error: 'Invalid RSS format',
                    status: 'failed',
                },
            ],
        },
        error: null,
    },
    failed: {
        status: 'failed' as const,
        message: null,
        result: null,
        error: 'Unable to parse OPML file. The file may be corrupted or in an invalid format.',
    },
};

export default function OPMLStatusPage() {
    const { taskId } = useLocalSearchParams<{ taskId: string }>();
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const colors = COLORS[colorScheme ?? 'light'];
    const queryClient = useQueryClient();

    const [showErrors, setShowErrors] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [shouldPoll, setShouldPoll] = useState(true);

    // Mock mode controls
    const [mockMode, setMockMode] = useState(taskId === 'mock');
    const [mockState, setMockState] = useState<keyof typeof MOCK_STATES>('in_progress_25');

    // Poll for task status every 2 seconds - stop polling when complete or failed
    const { data: realTaskStatus, isLoading } = useImportTaskStatus(
        taskId,
        !!taskId && !mockMode && shouldPoll
    );

    // Use mock data in mock mode, otherwise use real data
    const taskStatus = mockMode ? MOCK_STATES[mockState] : realTaskStatus;

    // Stop polling when task is complete or failed
    useEffect(() => {
        if (taskStatus?.status === 'completed' || taskStatus?.status === 'failed') {
            setShouldPoll(false);
        }
    }, [taskStatus?.status]);

    // Invalidate queries when import completes
    useEffect(() => {
        if (taskStatus?.status === 'completed') {
            Promise.all([
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] }),
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] }),
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] }),
                queryClient.invalidateQueries({
                    queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
                }),
                queryClient.invalidateQueries({
                    queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
                }),
            ]);
        }
    }, [taskStatus?.status, queryClient]);

    const handleCancelImport = async () => {
        if (!taskId) return;

        setIsCancelling(true);
        try {
            await ApiClient.rss.cancelImportTask(taskId);
            // Immediately invalidate the import tasks query to update UI
            await queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
            });
            toast.success('Import cancelled successfully');
            router.back();
        } catch (error) {
            console.error('Error cancelling import:', error);
            toast.error('Failed to cancel import. It may have already completed.');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleBackToBrowsing = () => {
        router.push('/(tabs)');
    };

    if (isLoading && !mockMode) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={colors.secondary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!taskStatus && !mockMode) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <View className="flex-1 items-center justify-center p-6">
                    <Monicon name="solar:close-circle-linear" size={48} color={colors.red} />
                    <Text className="mt-4 text-center font-geist-bold text-xl text-black dark:text-black-dark">
                        Import Task Not Found
                    </Text>
                    <Text className="mt-2 text-center font-geist text-base text-grey dark:text-grey-dark">
                        This import task may have expired or been removed.
                    </Text>
                    <View className="mt-6 w-full max-w-xs">
                        <Button onPress={() => router.back()} variant="primary" size="lg" fullWidth>
                            Go Back
                        </Button>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const status = taskStatus?.status;
    const result = taskStatus && 'result' in taskStatus ? taskStatus.result : null;
    const progressData = taskStatus && 'progress' in taskStatus ? taskStatus.progress : null;
    const error = taskStatus && 'error' in taskStatus ? taskStatus.error : null;
    const message = taskStatus && 'message' in taskStatus ? taskStatus.message : null;

    // For in_progress status, use progress field; for completed, use result.summary
    const progress = status === 'in_progress' ? progressData : result?.summary;
    const errors = result?.errors || [];

    // Use the completed field directly from progressData when in progress
    const totalProcessed =
        status === 'in_progress' && progressData
            ? progressData.completed
            : progress
              ? progress.successful + progress.already_existed + (progress.failed || 0)
              : 0;
    const totalFeeds =
        status === 'in_progress'
            ? progressData?.total || 0
            : result?.total_feeds || result?.estimated_feeds || 0;
    const progressPercentage = totalFeeds > 0 ? (totalProcessed / totalFeeds) * 100 : 0;

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
            {/* Header */}
            <View className="border-b border-light-grey px-4 py-4 dark:border-light-grey-dark">
                <View className="flex-row items-center gap-3">
                    <Pressable onPress={() => router.back()} className="active:opacity-70">
                        <Monicon
                            name="solar:arrow-left-linear"
                            size={24}
                            color={colors.primary_foreground}
                        />
                    </Pressable>
                    <Text className="font-geist-medium text-black dark:text-black-dark">
                        Import Status
                    </Text>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="p-6">
                    {/* Pending State */}
                    {status === 'pending' && (
                        <View className="rounded-3xl bg-light-grey p-5 dark:bg-light-grey-dark">
                            <View className="mb-4 items-center">
                                <Monicon
                                    name="solar:clock-circle-linear"
                                    size={48}
                                    color={colors.grey}
                                />
                                <Text className="mt-3 font-geist-bold text-xl text-black dark:text-black-dark">
                                    Import Queued
                                </Text>
                                <Text className="mt-1 text-center font-geist text-base text-grey dark:text-grey-dark">
                                    {message || 'Your import will start processing shortly.'}
                                </Text>
                            </View>

                            <Pressable
                                onPress={handleCancelImport}
                                disabled={isCancelling}
                                className="items-center py-2 active:opacity-70">
                                <Text className="font-geist-semibold text-base text-red">
                                    {isCancelling ? 'Cancelling...' : 'Cancel'}
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    {/* In Progress State */}
                    {status === 'in_progress' && (
                        <View className="rounded-3xl bg-light-grey p-5 dark:bg-light-grey-dark">
                            {/* File Info Header */}
                            <View className="mb-8 flex-row items-start gap-3">
                                <Monicon
                                    name="solar:file-text-bold"
                                    size={48}
                                    color={colors.secondary}
                                />
                                <View className="flex-1 flex-row items-start justify-between">
                                    <View className="flex-1">
                                        <Text
                                            className="font-geist-semibold text-base text-black dark:text-black-dark"
                                            numberOfLines={1}>
                                            OPML File
                                        </Text>
                                        <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                                            {totalFeeds > 0 ? `${totalFeeds} feeds` : ''}
                                        </Text>
                                    </View>
                                    <View className="ml-2 flex-row items-baseline">
                                        <AnimatedTicker
                                            value={Math.round(progressPercentage)}
                                            color={colors.grey}
                                            fontSize={24}
                                            fontWeight="700"
                                        />
                                        <Text className="font-geist-mono-bold text-2xl text-grey dark:text-grey-dark">
                                            %
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Tick Progress Bar */}
                            <View className="mb-4">
                                <TickProgressBar
                                    progress={progressPercentage / 100}
                                    totalTicks={35}
                                    colors={colors}
                                />
                            </View>

                            {/* Progress Counter */}
                            <View className="mb-4 items-center">
                                <View className="flex-row items-baseline">
                                    <AnimatedTicker
                                        value={totalProcessed}
                                        color={colors.primary_foreground}
                                        fontSize={36}
                                        fontWeight="700"
                                    />
                                    <Text className="mx-1 font-geist-bold text-2xl text-grey dark:text-grey-dark">
                                        /
                                    </Text>
                                    <Text className="font-geist-bold text-2xl text-grey dark:text-grey-dark">
                                        {totalFeeds}
                                    </Text>
                                </View>
                                <Text className="mt-1 font-geist text-sm text-grey dark:text-grey-dark">
                                    feeds processed
                                </Text>
                            </View>

                            {/* Status Details */}
                            {progress && (progress.successful > 0 || progress.failed > 0) && (
                                <View className="mb-6 flex-row items-center justify-center gap-4">
                                    {progress.successful > 0 && (
                                        <View className="flex-row items-center gap-1.5">
                                            <View className="h-2 w-2 rounded-full bg-secondary" />
                                            <View className="flex-row items-baseline gap-1">
                                                <AnimatedTicker
                                                    value={progress.successful}
                                                    color={colors.grey}
                                                    fontSize={12}
                                                />
                                                <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                                                    imported
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                    {progress.failed > 0 && (
                                        <View className="flex-row items-center gap-1.5">
                                            <View className="h-2 w-2 rounded-full bg-red" />
                                            <View className="flex-row items-baseline gap-1">
                                                <AnimatedTicker
                                                    value={progress.failed}
                                                    color={colors.grey}
                                                    fontSize={12}
                                                />
                                                <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                                                    failed
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Cancel Button */}
                            <Pressable
                                onPress={handleCancelImport}
                                disabled={isCancelling}
                                className="items-center py-2 active:opacity-70">
                                <Text className="font-geist-semibold text-base text-red">
                                    {isCancelling ? 'Cancelling...' : 'Cancel'}
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Completed State */}
                    {status === 'completed' && (
                        <View>
                            <View className="mb-6 rounded-3xl bg-light-grey p-5 dark:bg-light-grey-dark">
                                <View className="mb-4 items-center">
                                    <Monicon
                                        name="solar:check-circle-linear"
                                        size={48}
                                        color={colors.secondary}
                                    />
                                    <Text className="mt-3 font-geist-bold text-xl text-black dark:text-black-dark">
                                        Import Complete
                                    </Text>
                                    <Text className="mt-1 text-center font-geist text-base text-grey dark:text-grey-dark">
                                        Your OPML file has been successfully processed.
                                    </Text>
                                </View>

                                {/* Statistics */}
                                {progress && (
                                    <View className="gap-2.5">
                                        <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-white-dark">
                                            <View className="flex-row items-center gap-2.5">
                                                <View className="h-2 w-2 rounded-full bg-secondary" />
                                                <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                                                    Successfully Imported
                                                </Text>
                                            </View>
                                            <Text className="font-geist-bold text-base text-secondary">
                                                {progress.successful}
                                            </Text>
                                        </View>

                                        {progress.already_existed > 0 && (
                                            <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-white-dark">
                                                <View className="flex-row items-center gap-2.5">
                                                    <View
                                                        className="h-2 w-2 rounded-full"
                                                        style={{ backgroundColor: '#F59E0B' }}
                                                    />
                                                    <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                                                        Already Existed
                                                    </Text>
                                                </View>
                                                <Text
                                                    className="font-geist-bold text-base"
                                                    style={{ color: '#F59E0B' }}>
                                                    {progress.already_existed}
                                                </Text>
                                            </View>
                                        )}

                                        {progress.failed > 0 && (
                                            <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-white-dark">
                                                <View className="flex-row items-center gap-2.5">
                                                    <View className="h-2 w-2 rounded-full bg-red" />
                                                    <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                                                        Failed
                                                    </Text>
                                                </View>
                                                <Text className="font-geist-bold text-base text-red">
                                                    {progress.failed}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Error Details */}
                            {errors.length > 0 && (
                                <View className="mb-6 rounded-3xl bg-light-grey p-4 dark:bg-light-grey-dark">
                                    <Pressable
                                        onPress={() => setShowErrors(!showErrors)}
                                        className="flex-row items-center justify-between active:opacity-70">
                                        <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                                            {showErrors ? 'Hide' : 'Show'} Failed Feeds (
                                            {errors.length})
                                        </Text>
                                        <Monicon
                                            name={
                                                showErrors
                                                    ? 'solar:alt-arrow-up-linear'
                                                    : 'solar:alt-arrow-down-linear'
                                            }
                                            size={20}
                                            color={colors.primary_foreground}
                                        />
                                    </Pressable>

                                    {showErrors && (
                                        <View className="mt-4 gap-3">
                                            {errors.map(
                                                (
                                                    err: {
                                                        title?: string;
                                                        url: string;
                                                        error: string;
                                                    },
                                                    index: number
                                                ) => (
                                                    <View
                                                        key={index}
                                                        className="rounded-2xl bg-white p-3 dark:bg-white-dark">
                                                        <Text className="mb-1 font-geist-semibold text-sm text-black dark:text-black-dark">
                                                            {err.title || 'Unknown feed'}
                                                        </Text>
                                                        <Text
                                                            className="mb-2 font-geist-mono text-xs text-grey dark:text-grey-dark"
                                                            numberOfLines={1}>
                                                            {err.url}
                                                        </Text>
                                                        <Text className="font-geist text-xs text-red">
                                                            {err.error}
                                                        </Text>
                                                    </View>
                                                )
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Action Buttons */}

                            <Button
                                onPress={handleBackToBrowsing}
                                variant="primary"
                                size="lg"
                                fullWidth>
                                Back to Browsing
                            </Button>
                        </View>
                    )}

                    {/* Failed State */}
                    {status === 'failed' && (
                        <View className="rounded-3xl bg-light-grey p-5 dark:bg-light-grey-dark">
                            <View className="mb-4 items-center">
                                <Monicon
                                    name="solar:close-circle-linear"
                                    size={48}
                                    color={colors.red}
                                />
                                <Text className="mt-3 font-geist-bold text-xl text-black dark:text-black-dark">
                                    Import Failed
                                </Text>
                                <Text className="mt-1 text-center font-geist text-base text-red">
                                    {error || 'The import process encountered an error.'}
                                </Text>
                            </View>

                            <Button
                                onPress={() => router.push('/(tabs)/settings')}
                                variant="primary"
                                size="lg"
                                fullWidth>
                                Try Again
                            </Button>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
