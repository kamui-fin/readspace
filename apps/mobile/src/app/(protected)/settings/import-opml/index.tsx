import { OPMLImportBottomSheet } from '@components/bottom-sheets/opml-import';
import { Header } from '@components/navigation/header';
import { OPMLStatusCard } from '@components/screens/profile/ui/opml-status-card';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { NativeScreenHeader } from '@components/ui/native-screen-header';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { USES_NATIVE_HEADER } from '@lib/constants/platform';
import { readFileContent, validateOPMLFile } from '@lib/utils/opml';
import {
  ApiClient,
  RSS_QUERY_KEYS,
  useActiveImportTask,
  useImportTaskStatus,
} from '@readspace/shared';
import { DocumentTextIcon } from '@solar-icons/react-native/bold';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ImportOPMLScreen() {
  const router = useRouter();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();

  const importSheetRef = useRef<SheetRef>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [feedCount, setFeedCount] = useState(0);
  const [isPicking, setIsPicking] = useState(false);

  // Status tracking state
  const [localTaskId, setLocalTaskId] = useState<string | null>(null);
  const [shouldPoll, setShouldPoll] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // Get active task if one exists in the background
  const { data: activeTask } = useActiveImportTask();

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
  const screenTitle = hasActiveTask ? 'Import Status' : 'Import Subscriptions';

  // Shared by the idle target and the busy state so the card doesn't resize when you pick a file.
  const dropZoneStyle = {
    backgroundColor: colors.grey6,
    borderColor: isDark ? colors.grey5 : colors.grey4,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 20,
  } as const;

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
        // The native navigation bar already clears the status bar.
        paddingTop: USES_NATIVE_HEADER ? 0 : insets.top,
        paddingBottom: insets.bottom,
      }}>
      {/* No back title: "‹ Settings" alongside a two-word screen title crowds the bar and
          pushes the title off-centre. A bare chevron is what iOS does for a drill-down. */}
      <NativeScreenHeader title={screenTitle} />

      {!USES_NATIVE_HEADER && (
        <Header
          variant="static"
          title={screenTitle}
          titleFontWeight="semibold"
          transparentBackground={true}
          showBackButton={true}
          disableSafeAreaTop={true}
          onBackPress={() => router.back()}
        />
      )}

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
          <View className="gap-3 px-6 pt-2">
            {/* One target, one caption. The screen used to open with a heading that repeated the
                navigation bar and a paragraph explaining what an OPML file is — neither of which
                helps anyone who is already on an import screen holding an export from their old
                reader. */}
            {isPicking ? (
              <View style={dropZoneStyle} className="items-center justify-center gap-3">
                <Spinner size="medium" color={colors.secondary} />
                <Text size="base" fontFamily="geist-semibold" className="text-primary-foreground">
                  Reading your file…
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleOPMLImport}
                accessibilityRole="button"
                accessibilityLabel="Choose a subscriptions file"
                className="items-center justify-center gap-3"
                style={({ pressed }) => [dropZoneStyle, { opacity: pressed ? 0.85 : 1 }]}>
                <View
                  className="h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.primary_light }}>
                  <DocumentTextIcon size={28} color={colors.secondary} />
                </View>
                <View className="items-center gap-1">
                  <Text size="lg" fontFamily="geist-semibold" className="text-primary-foreground">
                    Choose a file
                  </Text>
                  <Text size="xs" fontFamily="geist-medium" className="text-grey dark:text-grey">
                    .opml or .xml
                  </Text>
                </View>
              </Pressable>
            )}

            <Text
              size="xs"
              fontFamily="geist"
              className="text-grey dark:text-grey px-2 text-center">
              Export one from Feedly, Inoreader, NetNewsWire — any reader with an OPML export.
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
