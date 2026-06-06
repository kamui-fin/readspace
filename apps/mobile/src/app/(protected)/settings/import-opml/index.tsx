import { OPMLImportBottomSheet } from '@components/bottom-sheets/opml-import';
import DocumentTextBoldIcon from '@components/icons/solar/document-text-bold';
import { Header } from '@components/navigation/header';
import { OPMLStatusCard } from '@components/screens/profile/ui/opml-status-card';
import { SettingsGroup } from '@components/screens/profile/ui/settings-group';
import { SettingsItem } from '@components/screens/profile/ui/settings-item';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      <Header
        variant="static"
        title="Import OPML"
        titleFontWeight="semibold"
        titleSize="xs"
        transparentBackground={true}
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <ScrollView className="flex-1">
        {isCheckingTask ? (
          <View className="flex-1 items-center justify-center">
            <Spinner size="large" color={colors.secondary} />
          </View>
        ) : currentTaskId && taskStatus ? (
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
            <SettingsGroup title="Source File" className="mb-2">
              {isPicking ? (
                <View
                  className="items-center justify-center rounded-2xl py-4"
                  style={{ backgroundColor: colors.grey6 }}>
                  <Spinner size="small" color={colors.primary} />
                </View>
              ) : (
                <SettingsItem
                  label="Upload OPML File"
                  variant="button"
                  leftIcon={<DocumentTextBoldIcon width={22} height={22} color={colors.black} />}
                  onPress={handleOPMLImport}
                />
              )}
            </SettingsGroup>
            <Text className="font-geist-medium text-grey dark:text-grey px-2 text-sm">
              Select a .opml or .xml file containing your exported subscriptions from another RSS
              reader to import them directly into your account.
            </Text>
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
