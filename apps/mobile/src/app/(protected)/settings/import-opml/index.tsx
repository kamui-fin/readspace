import { OPMLImportBottomSheet } from '@components/bottom-sheets/opml-import';
import DocumentTextBoldIcon from '@components/icons/solar/document-text-bold';
import { Header } from '@components/navigation/header';
import { OPMLStatusCard } from '@components/screens/profile/ui/opml-status-card';
import { SettingsGroup } from '@components/screens/profile/ui/settings-group';
import { SettingsItem } from '@components/screens/profile/ui/settings-item';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { Button } from '@components/ui/button';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { readFileContent, validateOPMLFile } from '@lib/utils/opml';
import {
  ApiClient,
  RSS_QUERY_KEYS,
  useActiveImportTask,
  useImportTaskStatus,
} from '@readspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ImportOPMLScreen() {
  const router = useRouter();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();

  const importSheetRef = useRef<BottomSheetModal>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [feedCount, setFeedCount] = useState(0);
  const [isPicking, setIsPicking] = useState(false);

  // Status tracking state
  const [localTaskId, setLocalTaskId] = useState<string | null>(null);
  const [shouldPoll, setShouldPoll] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // Get active task if one exists in the background
  const { data: activeTask, isLoading: isCheckingTask } = useActiveImportTask();

  // Use either the task we just started, or the one we found in the background
  const currentTaskId = localTaskId || activeTask?.task_id || null;

  // Poll for task status
  const { data: taskStatus } = useImportTaskStatus(currentTaskId, !!currentTaskId && shouldPoll);

  // Stop polling when complete or failed
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
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] }),
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS] }),
      ]);
    }
  }, [taskStatus?.status, queryClient]);

  const hasActiveTask = !!(currentTaskId && taskStatus);

  const handleImportStarted = useCallback((taskId: string) => {
    setLocalTaskId(taskId);
    setShouldPoll(true);
  }, []);

  const handleCancelProcess = async () => {
    if (!currentTaskId) return;

    setIsCancelling(true);
    try {
      await ApiClient.cancelImportTask(currentTaskId);
      await queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS] });
      toast.success('Import cancelled successfully');

      // Reset state to show start screen instantly
      setLocalTaskId(null);
      setShouldPoll(false);

      // Also explicitly drop it from cache if currently viewed
      queryClient.setQueryData([RSS_QUERY_KEYS.OPML_IMPORT_TASKS, 'active'], null);
    } catch (error) {
      console.error('Error cancelling import:', error);
      toast.error('Failed to cancel import. It may have already completed.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOPMLImport = useCallback(async () => {
    try {
      setIsPicking(true);
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: '*/*',
      });

      if (result.canceled) {
        setIsPicking(false);
        return;
      }

      const file = result.assets[0];
      if (!file) {
        setIsPicking(false);
        return;
      }

      // Read and validate the file
      const content = await readFileContent(file.uri);
      const validation = await validateOPMLFile(content);

      if (!validation.isValid) {
        toast.error(validation.error || 'Invalid OPML file');
        setIsPicking(false);
        return;
      }

      if (validation.hasNestedCategories) {
        toast.error(
          'OPML files with nested categories are not supported. Please flatten your categories before importing.'
        );
        setIsPicking(false);
        return;
      }

      // Store file and feed count, then show confirmation sheet
      setSelectedFile(file);
      setFeedCount(validation.feedCount);
      importSheetRef.current?.present();
    } catch (error) {
      console.error('Error picking document:', error);
      toast.error('Failed to select file. Please try again.');
    } finally {
      setIsPicking(false);
    }
  }, []);

  const handleCancelImport = useCallback(() => {
    setSelectedFile(null);
    setFeedCount(0);
  }, []);

  return (
    <View
      className="bg-background flex-1"
      style={{
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <Header
        variant="static"
        title={hasActiveTask ? 'Import Status' : ''}
        titleFontWeight="semibold"
        transparentBackground={true}
        showBackButton={true}
        disableSafeAreaTop={true}
        onBackPress={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 20,
        }}>
        {hasActiveTask && taskStatus ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} className="px-6">
            <OPMLStatusCard
              taskStatus={taskStatus}
              isCancelling={isCancelling}
              onCancel={handleCancelProcess}
              onClear={() => setLocalTaskId(null)}
            />
          </Animated.View>
        ) : (
          <View className="px-6">
            {/* Screen Header Info */}
            <View className="mb-6">
              <Text size="2xl" fontFamily="geist-bold" className="mb-2 text-black dark:text-white">
                Import Subscriptions
              </Text>
              <Text
                size="sm"
                fontFamily="geist-medium"
                className="text-grey dark:text-grey leading-relaxed">
                Bring your reading list with you. Upload an OPML file exported from your previous
                RSS reader to import all your feeds at once.
              </Text>
            </View>

            {/* Premium Upload Card */}
            {isPicking ? (
              <View
                className="items-center justify-center rounded-2xl border py-12"
                style={{
                  backgroundColor: colors.grey6,
                  borderColor: isDark ? colors.grey5 : colors.grey4,
                  borderStyle: 'dashed',
                  borderWidth: 1.5,
                }}>
                <Spinner size="medium" color={colors.secondary} />
                <Text
                  size="base"
                  fontFamily="geist-semibold"
                  className="mt-4 text-center text-black dark:text-white">
                  Analyzing file...
                </Text>
                <Text
                  size="xs"
                  fontFamily="geist"
                  className="text-grey dark:text-grey mt-1 text-center">
                  Reading OPML structure and counting feeds
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleOPMLImport}
                className="items-center justify-center rounded-2xl border px-5 py-12"
                style={({ pressed }) => ({
                  backgroundColor: colors.grey6,
                  borderColor: isDark ? colors.grey5 : colors.grey4,
                  borderStyle: 'dashed',
                  borderWidth: 1.5,
                  opacity: pressed ? 0.85 : 1,
                })}>
                <View
                  className="mb-4 h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isDark
                      ? 'rgba(106, 153, 78, 0.15)'
                      : 'rgba(106, 153, 78, 0.1)',
                  }}>
                  <DocumentTextBoldIcon width={32} height={32} color={colors.secondary} />
                </View>

                <Text
                  size="lg"
                  fontFamily="geist-bold"
                  className="text-center text-black dark:text-white">
                  Select OPML File
                </Text>
                <Text
                  size="xs"
                  fontFamily="geist-medium"
                  className="text-grey dark:text-grey mt-1.5 text-center">
                  Tap to browse .opml or .xml subscription files
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <OPMLImportBottomSheet
        ref={importSheetRef}
        file={selectedFile}
        feedCount={feedCount}
        onCancel={handleCancelImport}
        onImportStarted={handleImportStarted}
      />
    </View>
  );
}
