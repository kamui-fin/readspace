import DocumentTextBoldIcon from '@components/icons/solar/document-text-bold';
import InfoCircleBoldIcon from '@components/icons/solar/info-circle-bold';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { useImportOPML } from '@readspace/shared';
import type * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useState } from 'react';
import { View } from 'react-native';

export interface OPMLImportBottomSheetProps {
  file: DocumentPicker.DocumentPickerAsset | null;
  feedCount: number;
  onCancel?: () => void;
  onImportStarted?: (taskId: string) => void;
}

export const OPMLImportBottomSheet = forwardRef<BottomSheetModal, OPMLImportBottomSheetProps>(
  ({ file, feedCount, onCancel, onImportStarted }, ref) => {
    const router = useRouter();
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const importOPML = useImportOPML();

    const handleImport = useCallback(() => {
      if (!file) return;

      if (ref && typeof ref !== 'function' && ref.current) {
        ref.current.dismiss();
      }

      try {
        const formData = new FormData();
        formData.append('opml_file', {
          uri: file.uri,
          type: 'text/xml',
          name: file.name || 'feeds.opml',
        } as unknown as Blob);

        importOPML.mutate(formData, {
          onSuccess: (data) => {
            toast.success(`OPML import started! Processing ${data.estimated_feeds} feeds...`);

            if (onImportStarted) {
              onImportStarted(data.task_id);
            }
          },
          onError: (error: unknown) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to import OPML. Please try again.';
            toast.error(errorMessage);
          },
        });
      } catch (error) {
        console.error('Error importing OPML:', error);
        toast.error('Failed to import OPML. Please try again.');
      }
    }, [file, importOPML, ref, onImportStarted]);

    const handleCancel = useCallback(() => {
      if (ref && typeof ref !== 'function' && ref.current) {
        ref.current.dismiss();
      }
      onCancel?.();
    }, [ref, onCancel]);

    const cardBorderColor = isDark ? colors.grey5 : colors.grey4;
    const innerCardBg = isDark ? 'rgb(24, 24, 24)' : colors.background;

    return (
      <BottomSheet ref={ref} headerTitle="Confirm Import">
        <View>
          <Text className="font-geist-medium text-grey dark:text-grey mb-6 text-sm">
            Review the details below before importing your feeds.
          </Text>

          {/* File Info Card */}
          <View
            className="mb-5 rounded-xl border p-4"
            style={{
              backgroundColor: colors.grey6,
              borderColor: cardBorderColor,
            }}>
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: isDark ? 'rgba(106, 153, 78, 0.15)' : 'rgba(106, 153, 78, 0.1)',
                }}>
                <DocumentTextBoldIcon width={20} height={20} color={colors.secondary} />
              </View>
              <View className="flex-1">
                <Text
                  className="font-geist-semibold text-base text-black dark:text-white"
                  numberOfLines={1}>
                  {file?.name || 'Unknown file'}
                </Text>

                {/* Details Badges */}
                <View className="mt-1.5 flex-row gap-2">
                  <View
                    className="rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: isDark
                        ? 'rgba(106, 153, 78, 0.15)'
                        : 'rgba(106, 153, 78, 0.1)',
                    }}>
                    <Text size="xs" fontFamily="geist-semibold" style={{ color: colors.secondary }}>
                      {feedCount} {feedCount === 1 ? 'feed' : 'feeds'}
                    </Text>
                  </View>
                  {file?.size && file.size > 0 && (
                    <View
                      className="rounded-full px-2.5 py-0.5"
                      style={{ backgroundColor: isDark ? colors.grey5 : colors.grey5 }}>
                      <Text
                        size="xs"
                        fontFamily="geist-medium"
                        className="text-grey dark:text-grey">
                        {(file.size / 1024).toFixed(1)} KB
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Import Info */}
          <View
            className="mb-6 rounded-xl border p-4"
            style={{
              backgroundColor: innerCardBg,
              borderColor: cardBorderColor,
            }}>
            <View className="flex-row items-start gap-2.5">
              <View style={{ marginTop: 2 }}>
                <InfoCircleBoldIcon width={16} height={16} color={colors.grey} />
              </View>
              <Text className="font-geist-medium text-grey dark:text-grey flex-1 text-xs leading-5">
                The import will run in the background. You can track its progress immediately after.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              size="large"
              fullWidth={false}
              className="flex-1"
              onPress={handleCancel}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Cancel
            </Button>

            <Button
              variant="primary"
              size="large"
              fullWidth={false}
              className="flex-1"
              onPress={handleImport}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Import
            </Button>
          </View>
        </View>
      </BottomSheet>
    );
  }
);

OPMLImportBottomSheet.displayName = 'OPMLImportBottomSheet';
