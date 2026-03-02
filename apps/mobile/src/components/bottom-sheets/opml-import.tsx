import DocumentTextBoldIcon from '@components/icons/solar/document-text-bold';
import InfoCircleBoldIcon from '@components/icons/solar/info-circle-bold';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/spinner';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { useImportOPML } from '@readspace/shared';
import type * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useState } from 'react';
import { Text, View } from 'react-native';

export interface OPMLImportBottomSheetProps {
  file: DocumentPicker.DocumentPickerAsset | null;
  feedCount: number;
  onCancel?: () => void;
}

export const OPMLImportBottomSheet = forwardRef<BottomSheetModal, OPMLImportBottomSheetProps>(
  ({ file, feedCount, onCancel }, ref) => {
    const router = useRouter();
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const [isImporting, setIsImporting] = useState(false);

    const importOPML = useImportOPML();

    const handleImport = useCallback(async () => {
      if (!file) return;

      setIsImporting(true);

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

            if (ref && typeof ref !== 'function' && ref.current) {
              ref.current.dismiss();
            }

            router.push(`/(protected)/settings/opml-status/${data.task_id}` as never);
          },
          onError: (error: unknown) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to import OPML. Please try again.';
            toast.error(errorMessage);
            setIsImporting(false);
          },
        });
      } catch (error) {
        console.error('Error importing OPML:', error);
        toast.error('Failed to import OPML. Please try again.');
        setIsImporting(false);
      }
    }, [file, importOPML, ref, router]);

    const handleCancel = useCallback(() => {
      setIsImporting(false);
      if (ref && typeof ref !== 'function' && ref.current) {
        ref.current.dismiss();
      }
      onCancel?.();
    }, [ref, onCancel]);

    return (
      <BottomSheet ref={ref} headerTitle="Confirm Import" enablePanDownToClose={!isImporting}>
        <View>
          <Text className="mb-6 font-geist-medium text-base text-grey dark:text-grey">
            Review the details below before importing your feeds.
          </Text>

          {/* File Info Card */}
          <View className="mb-6 rounded-xl bg-grey5 p-4 dark:bg-grey5-dark">
            <View className="flex-row items-center gap-3">
              <DocumentTextBoldIcon width={24} height={24} color={colors.primary} />
              <Text className="flex-1 font-geist-semibold text-base text-black dark:text-black-dark">
                {file?.name || 'Unknown file'}
              </Text>
            </View>
          </View>

          {/* Import Info */}
          <View className="mb-6 rounded-xl bg-grey6 p-4 dark:bg-grey6-dark">
            <View className="flex-row gap-2">
              <View style={{ marginTop: 2 }}>
                <InfoCircleBoldIcon width={16} height={16} color={colors.grey} />
              </View>
              <Text className="flex-1 font-geist-medium text-sm text-grey dark:text-grey">
                The import will run in the background. You can track progress on the status page.
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
              disabled={isImporting}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Cancel
            </Button>

            <Button
              variant="primary"
              size="large"
              fullWidth={false}
              className="flex-1"
              onPress={handleImport}
              disabled={isImporting}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              {isImporting ? (
                <View className="flex-row items-center gap-2">
                  <Spinner size="small" color={COLORS.white} />
                  <Text className="font-geist-semibold text-base text-white">Importing...</Text>
                </View>
              ) : (
                `Import ${feedCount} ${feedCount === 1 ? 'feed' : 'feeds'}`
              )}
            </Button>
          </View>
        </View>
      </BottomSheet>
    );
  }
);

OPMLImportBottomSheet.displayName = 'OPMLImportBottomSheet';
