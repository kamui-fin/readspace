import { ProgressBar } from '@/components/ui/ProgressBar';
import { COLORS } from '@/constants/Colors';
import { Monicon } from '@monicon/native';
import { ApiClient, RSS_QUERY_KEYS, useImportTaskStatus } from '@readspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function OPMLStatusPage() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const colors = COLORS[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  const [showErrors, setShowErrors] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Poll for task status every 2 seconds
  const { data: taskStatus, isLoading } = useImportTaskStatus(taskId, !!taskId);

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

  const handleViewFeeds = () => {
    router.push('/(tabs)/discover');
  };

  if (isLoading) {
    return (
      <SafeAreaView
        className="flex-1 bg-white dark:bg-white-dark"
        edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!taskStatus) {
    return (
      <SafeAreaView
        className="flex-1 bg-white dark:bg-white-dark"
        edges={['top']}>
        <View className="flex-1 items-center justify-center p-6">
          <Monicon
            name="solar:close-circle-linear"
            size={48}
            color={colors.red}
          />
          <Text className="mt-4 text-center font-geist-bold text-xl text-black dark:text-black-dark">
            Import Task Not Found
          </Text>
          <Text className="mt-2 text-center font-geist text-base text-grey dark:text-grey-dark">
            This import task may have expired or been removed.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 rounded-2xl bg-primary px-6 py-3 active:opacity-70">
            <Text className="font-geist-semibold text-base text-white">
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { status, result, error, message } = taskStatus;
  const progress = result?.summary;
  const errors = result?.errors || [];

  const totalProcessed = progress
    ? progress.successful + progress.already_existed + progress.broken_feeds
    : 0;
  const totalFeeds = result?.total_feeds || result?.estimated_feeds || 0;
  const progressPercentage =
    totalFeeds > 0 ? (totalProcessed / totalFeeds) * 100 : 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
      {/* Header */}
      <View className="border-b border-light-grey dark:border-light-grey-dark px-6 pb-4 pt-2">
        <Pressable
          onPress={() => router.back()}
          className="mb-3 flex-row items-center gap-2 active:opacity-70">
          <Monicon
            name="solar:arrow-left-linear"
            size={24}
            color={colors.primary_foreground}
          />
          <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
            Back
          </Text>
        </Pressable>
        <Text className="font-geist-bold text-3xl tracking-heading text-black dark:text-black-dark">
          Import Status
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-6">
          {/* Pending State */}
          {status === 'pending' && (
            <View className="rounded-2xl bg-light-grey dark:bg-light-grey-dark p-6">
              <View className="mb-4 flex-row items-start gap-3">
                <Monicon
                  name="solar:clock-circle-linear"
                  size={32}
                  color={colors.grey}
                />
                <View className="flex-1">
                  <Text className="mb-2 font-geist-bold text-xl text-black dark:text-black-dark">
                    Import Queued
                  </Text>
                  <Text className="font-geist text-base text-grey dark:text-grey-dark">
                    {message || 'Your import will start processing shortly.'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleCancelImport}
                disabled={isCancelling}
                className="mt-4 items-center rounded-2xl bg-mid-grey dark:bg-mid-grey-dark py-3 active:opacity-70">
                <Text className="font-geist-semibold text-base text-red">
                  {isCancelling ? 'Cancelling...' : 'Cancel Import'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* In Progress State */}
          {status === 'in_progress' && (
            <View className="rounded-2xl bg-light-grey dark:bg-light-grey-dark p-6">
              <View className="mb-4 flex-row items-start gap-3">
                <ActivityIndicator size={32} color={colors.secondary} />
                <View className="flex-1">
                  <Text className="mb-2 font-geist-bold text-xl text-black dark:text-black-dark">
                    Importing Feeds
                  </Text>
                  <Text className="font-geist text-base text-grey dark:text-grey-dark">
                    {message || 'Processing your feeds...'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View className="mb-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="font-geist-medium text-sm text-grey dark:text-grey-dark">
                    Progress
                  </Text>
                  <Text className="font-geist-semibold text-sm text-black dark:text-black-dark">
                    {totalProcessed} / {totalFeeds}
                  </Text>
                </View>
                <ProgressBar percentage={progressPercentage} className="h-2" />
              </View>

              {/* Statistics */}
              {progress && (
                <View className="gap-3">
                  <View className="flex-row items-center justify-between rounded-xl bg-white dark:bg-white-dark p-3">
                    <View className="flex-row items-center gap-2">
                      <Monicon
                        name="solar:check-circle-linear"
                        size={20}
                        color={colors.secondary}
                      />
                      <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                        Successfully Imported
                      </Text>
                    </View>
                    <Text className="font-geist-bold text-base text-secondary">
                      {progress.successful}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between rounded-xl bg-white dark:bg-white-dark p-3">
                    <View className="flex-row items-center gap-2">
                      <Monicon
                        name="solar:info-circle-linear"
                        size={20}
                        color="#F59E0B"
                      />
                      <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                        Already Existed
                      </Text>
                    </View>
                    <Text className="font-geist-bold text-base" style={{ color: '#F59E0B' }}>
                      {progress.already_existed}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between rounded-xl bg-white dark:bg-white-dark p-3">
                    <View className="flex-row items-center gap-2">
                      <Monicon
                        name="solar:close-circle-linear"
                        size={20}
                        color={colors.red}
                      />
                      <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                        Failed
                      </Text>
                    </View>
                    <Text className="font-geist-bold text-base text-red">
                      {progress.broken_feeds}
                    </Text>
                  </View>
                </View>
              )}

              <Pressable
                onPress={handleCancelImport}
                disabled={isCancelling}
                className="mt-4 items-center rounded-2xl bg-mid-grey dark:bg-mid-grey-dark py-3 active:opacity-70">
                <Text className="font-geist-semibold text-base text-red">
                  {isCancelling ? 'Cancelling...' : 'Cancel Import'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Completed State */}
          {status === 'completed' && (
            <View>
              <View className="mb-6 rounded-2xl bg-light-grey dark:bg-light-grey-dark p-6">
                <View className="mb-4 flex-row items-start gap-3">
                  <Monicon
                    name="solar:check-circle-linear"
                    size={32}
                    color={colors.secondary}
                  />
                  <View className="flex-1">
                    <Text className="mb-2 font-geist-bold text-xl text-black dark:text-black-dark">
                      Import Complete
                    </Text>
                    <Text className="font-geist text-base text-grey dark:text-grey-dark">
                      Your OPML file has been successfully processed.
                    </Text>
                  </View>
                </View>

                {/* Statistics */}
                {progress && (
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between rounded-xl bg-white dark:bg-white-dark p-3">
                      <View className="flex-row items-center gap-2">
                        <Monicon
                          name="solar:check-circle-linear"
                          size={20}
                          color={colors.secondary}
                        />
                        <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                          Successfully Imported
                        </Text>
                      </View>
                      <Text className="font-geist-bold text-base text-secondary">
                        {progress.successful}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between rounded-xl bg-white dark:bg-white-dark p-3">
                      <View className="flex-row items-center gap-2">
                        <Monicon
                          name="solar:info-circle-linear"
                          size={20}
                          color="#F59E0B"
                        />
                        <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                          Already Existed
                        </Text>
                      </View>
                      <Text className="font-geist-bold text-base" style={{ color: '#F59E0B' }}>
                        {progress.already_existed}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between rounded-xl bg-white dark:bg-white-dark p-3">
                      <View className="flex-row items-center gap-2">
                        <Monicon
                          name="solar:close-circle-linear"
                          size={20}
                          color={colors.red}
                        />
                        <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                          Failed
                        </Text>
                      </View>
                      <Text className="font-geist-bold text-base text-red">
                        {progress.broken_feeds}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Error Details */}
              {errors.length > 0 && (
                <View className="mb-6 rounded-2xl bg-light-grey dark:bg-light-grey-dark p-4">
                  <Pressable
                    onPress={() => setShowErrors(!showErrors)}
                    className="flex-row items-center justify-between active:opacity-70">
                    <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                      {showErrors ? 'Hide' : 'Show'} Failed Feeds ({errors.length})
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
                      {errors.map((err, index) => (
                        <View
                          key={index}
                          className="rounded-xl bg-white dark:bg-white-dark p-3">
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
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View className="gap-3">
                <Pressable
                  onPress={handleViewFeeds}
                  className="items-center rounded-2xl bg-primary py-4 active:opacity-70">
                  <Text className="font-geist-semibold text-base text-white">
                    View Feeds
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleBackToBrowsing}
                  className="items-center rounded-2xl bg-mid-grey dark:bg-mid-grey-dark py-4 active:opacity-70">
                  <Text className="font-geist-semibold text-base text-grey dark:text-grey-dark">
                    Back to Browsing
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Failed State */}
          {status === 'failed' && (
            <View className="rounded-2xl bg-light-grey dark:bg-light-grey-dark p-6">
              <View className="mb-4 flex-row items-start gap-3">
                <Monicon
                  name="solar:close-circle-linear"
                  size={32}
                  color={colors.red}
                />
                <View className="flex-1">
                  <Text className="mb-2 font-geist-bold text-xl text-black dark:text-black-dark">
                    Import Failed
                  </Text>
                  <Text className="font-geist text-base text-red">
                    {error || 'The import process encountered an error.'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => router.push('/(tabs)/settings')}
                className="mt-4 items-center rounded-2xl bg-primary py-3 active:opacity-70">
                <Text className="font-geist-semibold text-base text-white">
                  Try Again
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
