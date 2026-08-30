import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { DocumentTextIcon } from '@solar-icons/react-native/bold';
import {
  CheckCircleIcon,
  ClockCircleIcon,
  CloseCircleIcon,
} from '@solar-icons/react-native/linear';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);

  if (!taskStatus) return null;

  const status = taskStatus.status;
  const result = 'result' in taskStatus ? taskStatus.result : null;
  const progressData = 'progress' in taskStatus ? taskStatus.progress : null;
  const errorMsg = 'error' in taskStatus ? taskStatus.error : null;
  const message = 'message' in taskStatus ? taskStatus.message : null;
  const filename = taskStatus.metadata?.filename || 'subscriptions.opml';

  const progress = status === 'in_progress' ? progressData : result;

  const totalProcessed =
    status === 'in_progress' && progressData
      ? progressData.completed
      : progress
        ? progress.successful + progress.already_existed + (progress.failed || 0)
        : 0;
  const totalFeeds = status === 'in_progress' ? progressData?.total || 0 : result?.total_feeds || 0;
  const progressPercentage = totalFeeds > 0 ? (totalProcessed / totalFeeds) * 100 : 0;

  // Premium card styling values
  const cardBorderColor = isDark ? colors.grey5 : colors.grey4;
  const statItemBgColor = colors.grey6;

  return (
    <View>
      {/* Pending State */}
      {status === 'pending' && (
        <View className="py-8">
          <View className="items-center">
            <View
              className="mb-4 h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}>
              <ClockCircleIcon size={32} color={colors.grey} />
            </View>
            <Text className="font-geist-bold text-xl text-black dark:text-white">
              Import Queued
            </Text>
            <Text className="font-geist-medium text-grey dark:text-grey mt-1.5 px-6 text-center text-sm leading-5">
              {message || 'Your import will start processing shortly.'}
            </Text>
          </View>

          <View className="mt-8 w-full">
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
        <View className="py-6">
          {/* File Info Header */}
          <View className="mb-6 flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-xl"
              style={{
                backgroundColor: isDark ? 'rgba(106, 153, 78, 0.15)' : 'rgba(106, 153, 78, 0.1)',
              }}>
              <DocumentTextIcon size={24} color={colors.secondary} />
            </View>
            <View className="flex-1 flex-row items-center justify-between">
              <View className="flex-1">
                <Text
                  className="font-geist-semibold text-base text-black dark:text-white"
                  numberOfLines={1}>
                  {filename}
                </Text>
                <Text className="font-geist text-grey dark:text-grey text-xs">
                  {totalFeeds > 0 ? `${totalFeeds} feeds` : 'Importing...'}
                </Text>
              </View>
            </View>
          </View>

          {/* Tick Progress Bar */}
          <View className="mb-4">
            <TickProgressBar progress={progressPercentage / 100} totalTicks={35} colors={colors} />
          </View>

          {/* Progress Counter & Live Stats */}
          <View className="mb-4 items-center">
            <View className="flex-row items-baseline">
              <AnimatedTicker
                value={totalProcessed}
                color={colors.black}
                fontSize={32}
                fontWeight="700"
              />
              <Text className="font-geist-bold text-grey dark:text-grey mx-1 text-xl">/</Text>
              <Text className="font-geist-bold text-grey dark:text-grey text-xl">{totalFeeds}</Text>
            </View>
            <Text className="font-geist-medium text-grey dark:text-grey mt-0.5 text-xs">
              feeds processed
            </Text>

            {/* Live Progress Stats Sub-row */}
            {progressData && (
              <View
                className="mt-4 flex-row justify-center gap-3 rounded-lg px-2 py-1.5"
                style={{ backgroundColor: statItemBgColor }}>
                <Text size="xs" fontFamily="geist-medium" className="text-secondary">
                  {progressData.successful} imported
                </Text>
                <Text size="xs" fontFamily="geist-medium" className="text-grey dark:text-grey">
                  •
                </Text>
                <Text size="xs" fontFamily="geist-medium" style={{ color: '#F59E0B' }}>
                  {progressData.already_existed} existed
                </Text>
                {progressData.failed > 0 && (
                  <>
                    <Text size="xs" fontFamily="geist-medium" className="text-grey dark:text-grey">
                      •
                    </Text>
                    <Text size="xs" fontFamily="geist-medium" style={{ color: colors.red }}>
                      {progressData.failed} failed
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Cancel Button */}
          <View className="mt-8 w-full">
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
        <View className="py-6">
          <View className="mb-6 items-center">
            <View
              className="mb-3 h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: isDark ? 'rgba(106, 153, 78, 0.15)' : 'rgba(106, 153, 78, 0.1)',
              }}>
              <CheckCircleIcon size={32} color={colors.secondary} />
            </View>
            <Text className="font-geist-bold text-xl text-black dark:text-white">
              Import Complete
            </Text>
            <Text className="font-geist-medium text-grey dark:text-grey mt-1.5 px-6 text-center text-sm leading-5">
              Your subscriptions have been successfully processed.
            </Text>
          </View>

          {/* Statistics */}
          {progress && (
            <View className="gap-2">
              <View
                className="flex-row items-center justify-between rounded-xl px-4 py-3"
                style={{ backgroundColor: statItemBgColor }}>
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colors.secondary }}
                  />
                  <Text className="font-geist-medium text-grey dark:text-grey text-sm">
                    Successfully Imported
                  </Text>
                </View>
                <Text className="font-geist-bold text-base" style={{ color: colors.secondary }}>
                  {progress.successful}
                </Text>
              </View>

              {progress.already_existed > 0 && (
                <View
                  className="flex-row items-center justify-between rounded-xl px-4 py-3"
                  style={{ backgroundColor: statItemBgColor }}>
                  <View className="flex-row items-center gap-2.5">
                    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                    <Text className="font-geist-medium text-grey dark:text-grey text-sm">
                      Already Existed
                    </Text>
                  </View>
                  <Text className="font-geist-bold text-base" style={{ color: '#F59E0B' }}>
                    {progress.already_existed}
                  </Text>
                </View>
              )}

              {progress.failed > 0 && (
                <View
                  className="flex-row items-center justify-between rounded-xl px-4 py-3"
                  style={{ backgroundColor: statItemBgColor }}>
                  <View className="flex-row items-center gap-2.5">
                    <View
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors.red }}
                    />
                    <Text className="font-geist-medium text-grey dark:text-grey text-sm">
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

          {/* Action Buttons */}
          <View className="mt-8 w-full">
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
        <View className="py-8">
          <View className="items-center">
            <View
              className="mb-3 h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: isDark ? 'rgba(234, 67, 53, 0.15)' : 'rgba(234, 67, 53, 0.08)',
              }}>
              <CloseCircleIcon size={32} color={colors.red} />
            </View>
            <Text className="font-geist-bold text-xl text-black dark:text-white">
              Import Failed
            </Text>
            <Text className="font-geist-medium text-grey dark:text-grey mt-1.5 px-6 text-center text-sm leading-5">
              We ran into an issue processing your OPML file. Please ensure it is a valid
              subscription export.
            </Text>
          </View>

          {/* Technical Details Toggle */}
          {errorMsg && (
            <View className="mt-4 w-full">
              <Pressable
                onPress={() => setShowErrorDetails(!showErrorDetails)}
                className="flex-row items-center justify-center gap-1 py-1.5">
                <Text size="xs" fontFamily="geist-semibold" style={{ color: colors.secondary }}>
                  {showErrorDetails ? 'Hide technical details' : 'Show technical details'}
                </Text>
              </Pressable>

              {showErrorDetails && (
                <View
                  className="mt-2 rounded-lg border p-3"
                  style={{
                    backgroundColor: statItemBgColor,
                    borderColor: cardBorderColor,
                  }}>
                  <Text
                    fontFamily="mono"
                    size="xs"
                    className="leading-relaxed text-black dark:text-white">
                    {errorMsg}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View className="mt-8">
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
