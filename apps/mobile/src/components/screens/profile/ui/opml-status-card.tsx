import React, { useEffect } from 'react';
import { View, TextInput } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedProps,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Text } from '@components/ui/text';
import { Button } from '@components/ui/button';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useRouter } from 'expo-router';
import CheckCircleLinearIcon from '@components/icons/solar/check-circle-linear';
import CloseCircleLinearIcon from '@components/icons/solar/close-circle-linear';
import ClockCircleLinearIcon from '@components/icons/solar/clock-circle-linear';
import DocumentTextBoldIcon from '@components/icons/solar/document-text-bold';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

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
        // Use timing animation for numbers to prevent progress bouncing backwards via spring overshoot
        animatedValue.value = withTiming(value, { duration: 300 });
    }, [value, animatedValue]);

    const animatedProps = useAnimatedProps(() => {
        const textValue = String(Math.round(animatedValue.value));
        return {
            text: textValue,
            defaultValue: textValue,
        } as any;
    });

    return (
        <AnimatedTextInput
            animatedProps={animatedProps}
            editable={false}
            scrollEnabled={false}
            style={{
                color,
                fontSize,
                fontWeight: fontWeight as any,
                fontFamily: 'Geist_600SemiBold',
                padding: 0,
                margin: 0,
                minHeight: 0,
                includeFontPadding: false,
            }}
        />
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
        progressValue.value = withTiming(progress, { duration: 300 });
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

export interface OPMLStatusCardProps {
    taskStatus: any;
    isCancelling: boolean;
    onCancel: () => void;
    onClear: () => void;
}

export function OPMLStatusCard({
    taskStatus,
    isCancelling,
    onCancel,
    onClear,
}: OPMLStatusCardProps) {
    const router = useRouter();
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    if (!taskStatus) return null;

    const status = taskStatus.status;
    const result = 'result' in taskStatus ? taskStatus.result : null;
    const progressData = 'progress' in taskStatus ? taskStatus.progress : null;
    const errorMsg = 'error' in taskStatus ? taskStatus.error : null;
    const message = 'message' in taskStatus ? taskStatus.message : null;

    const progress = status === 'in_progress' ? progressData : result;

    const totalProcessed =
        status === 'in_progress' && progressData
            ? progressData.completed
            : progress
                ? progress.successful + progress.already_existed + (progress.failed || 0)
                : 0;
    const totalFeeds =
        status === 'in_progress'
            ? progressData?.total || 0
            : result?.total_feeds || 0;
    const progressPercentage = totalFeeds > 0 ? (totalProcessed / totalFeeds) * 100 : 0;

    return (
        <View>
            {/* Pending State */}
            {status === 'pending' && (
                <View className="rounded-3xl bg-grey6 p-5 dark:bg-grey6">
                    <View className="mb-4 items-center">
                        <ClockCircleLinearIcon width={48} height={48} color={colors.grey} />
                        <Text className="mt-3 font-geist-bold text-xl text-black dark:text-white">
                            Import Queued
                        </Text>
                        <Text className="mt-1 text-center font-geist-medium text-base text-grey dark:text-grey">
                            {message || 'Your import will start processing shortly.'}
                        </Text>
                    </View>

                    <View className="mt-4 w-full">
                        <Button
                            onPress={onCancel}
                            disabled={isCancelling}
                            variant="secondary"
                            size="large"
                            textClassName="text-red dark:text-red"
                            style={{ borderRadius: 100 }}
                            fullWidth>
                            {isCancelling ? 'Cancelling...' : 'Cancel'}
                        </Button>
                    </View>
                </View>
            )}

            {/* In Progress State */}
            {status === 'in_progress' && (
                <View className="rounded-3xl bg-grey6 p-5 dark:bg-grey6">
                    {/* File Info Header */}
                    <View className="mb-8 flex-row items-start gap-3">
                        <DocumentTextBoldIcon width={48} height={48} color={colors.secondary} />
                        <View className="flex-1 flex-row items-start justify-between">
                            <View className="flex-1">
                                <Text
                                    className="font-geist-semibold text-base text-black dark:text-white"
                                    numberOfLines={1}>
                                    OPML File
                                </Text>
                                <Text className="font-geist-medium text-sm text-grey dark:text-grey">
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
                                <Text className="font-geist-mono-bold text-2xl text-grey dark:text-grey">
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
                        <View className="flex-row items-baseline mt-2">
                            <AnimatedTicker
                                value={totalProcessed}
                                color={colors.primary_foreground}
                                fontSize={36}
                                fontWeight="700"
                            />
                            <Text className="mx-1 font-geist-bold text-2xl text-grey dark:text-grey">
                                /
                            </Text>
                            <Text className="font-geist-bold text-2xl text-grey dark:text-grey">
                                {totalFeeds}
                            </Text>
                        </View>
                        <Text className="mt-1 font-geist-medium text-sm text-grey dark:text-grey">
                            feeds processed
                        </Text>
                    </View>

                    {/* Cancel Button */}
                    <View className="mt-4 pt-4 border-t border-grey5 dark:border-grey5">
                        <Button
                            onPress={onCancel}
                            disabled={isCancelling}
                            variant="secondary"
                            size="large"
                            textClassName="text-red dark:text-red"
                            style={{ borderRadius: 100 }}
                            fullWidth>
                            {isCancelling ? 'Cancelling...' : 'Cancel Import'}
                        </Button>
                    </View>
                </View>
            )}

            {/* Completed State */}
            {status === 'completed' && (
                <View>
                    <View className="mb-6 rounded-3xl bg-grey6 p-5 dark:bg-grey6">
                        <View className="mb-4 items-center">
                            <CheckCircleLinearIcon width={48} height={48} color={colors.secondary} />
                            <Text className="mt-3 font-geist-bold text-xl text-black dark:text-white">
                                Import Complete
                            </Text>
                            <Text className="mt-1 text-center font-geist-medium text-base text-grey dark:text-grey">
                                Your OPML file has been successfully processed.
                            </Text>
                        </View>

                        {/* Statistics */}
                        {progress && (
                            <View className="gap-2.5">
                                <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-black border border-grey5 dark:border-grey4">
                                    <View className="flex-row items-center gap-2.5">
                                        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.secondary }} />
                                        <Text className="font-geist-medium text-sm text-grey dark:text-grey">
                                            Successfully Imported
                                        </Text>
                                    </View>
                                    <Text className="font-geist-bold text-base" style={{ color: colors.secondary }}>
                                        {progress.successful}
                                    </Text>
                                </View>

                                {progress.already_existed > 0 && (
                                    <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-black border border-grey5 dark:border-grey4">
                                        <View className="flex-row items-center gap-2.5">
                                            <View
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: '#F59E0B' }}
                                            />
                                            <Text className="font-geist-medium text-sm text-grey dark:text-grey">
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
                                    <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-black border border-grey5 dark:border-grey4">
                                        <View className="flex-row items-center gap-2.5">
                                            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.red }} />
                                            <Text className="font-geist-medium text-sm text-grey dark:text-grey">
                                                Failed
                                            </Text>
                                        </View>
                                        <Text className="font-geist-bold text-base" style={{ color: colors.red }}>
                                            {progress.failed}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View className="mt-2 w-full">
                        <Button
                            onPress={() => router.push('/(tabs)')}
                            variant="primary"
                            size="large"
                            style={{ borderRadius: 100 }}
                            fullWidth>
                            Start browsing
                        </Button>
                    </View>
                </View>
            )}

            {/* Failed State */}
            {status === 'failed' && (
                <View className="rounded-3xl bg-grey6 p-5 dark:bg-grey6">
                    <View className="mb-4 items-center">
                        <CloseCircleLinearIcon width={48} height={48} color={colors.red} />
                        <Text className="mt-3 font-geist-bold text-xl text-black dark:text-white">
                            Import Failed
                        </Text>
                        <Text className="mt-1 text-center font-geist-medium text-base" style={{ color: colors.red }}>
                            {errorMsg || 'The import process encountered an error.'}
                        </Text>
                    </View>

                    <View className="mt-4">
                        <Button
                            onPress={onClear}
                            variant="primary"
                            size="large"
                            style={{ borderRadius: 100 }}
                            fullWidth>
                            Try Again
                        </Button>
                    </View>
                </View>
            )}
        </View>
    );
}
