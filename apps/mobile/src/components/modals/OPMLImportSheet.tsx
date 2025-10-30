import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/Colors';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { useImportOPML } from '@readspace/shared';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { toast } from 'sonner-native';

export interface OPMLImportSheetProps {
  file: DocumentPicker.DocumentPickerAsset | null;
  feedCount: number;
  onCancel?: () => void;
}

export const OPMLImportSheet = forwardRef<BottomSheetModal, OPMLImportSheetProps>(
  ({ file, feedCount, onCancel }, ref) => {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const colors = COLORS[colorScheme ?? 'light'];
    const [isImporting, setIsImporting] = useState(false);

    const importOPML = useImportOPML();
    const snapPoints = useMemo(() => ['50%'], []);

    const handleImport = useCallback(async () => {
      if (!file) return;

      setIsImporting(true);
      toast.loading('Starting OPML import...', { id: 'opml-import' });

      try {
        // Create FormData
        const formData = new FormData();
        formData.append('opml_file', {
          uri: file.uri,
          type: 'text/xml',
          name: file.name || 'feeds.opml',
        } as any);

        importOPML.mutate(formData, {
          onSuccess: (data) => {
            toast.success('OPML import started!', {
              id: 'opml-import',
              description: `Processing ${data.estimated_feeds} feeds...`,
            });

            // Dismiss the sheet
            if (ref && typeof ref !== 'function' && ref.current) {
              ref.current.dismiss();
            }

            // Navigate to status page
            router.push(`/settings/opml-status/${data.task_id}`);
          },
          onError: (error: any) => {
            toast.error('Failed to import OPML', {
              id: 'opml-import',
              description: error?.message || 'Please try again',
            });
            setIsImporting(false);
          },
        });
      } catch (error) {
        console.error('Error importing OPML:', error);
        toast.error('Failed to import OPML', {
          id: 'opml-import',
          description: 'Please try again',
        });
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

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enablePanDownToClose={!isImporting}
        enableDismissOnClose={true}
        stackBehavior="push"
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colors.white,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.green_grey,
        }}
        onDismiss={() => {
          setIsImporting(false);
          if (!isImporting) {
            onCancel?.();
          }
        }}>
        <BottomSheetView className="flex-1 px-6 py-4">
          <Text className="mb-2 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
            Confirm Import
          </Text>
          <Text className="mb-6 font-geist text-base text-grey dark:text-grey-dark">
            Review the details below before importing your feeds.
          </Text>

          {/* File Info Card */}
          <View className="mb-6 rounded-2xl bg-light-grey dark:bg-light-grey-dark p-4">
            <View className="flex-row items-center gap-3">
              <Monicon
                name="lucide:file-text"
                size={24}
                color={colors.primary_foreground}
              />
              <Text className="flex-1 font-geist-semibold text-base text-black dark:text-black-dark">
                {file?.name || 'Unknown file'}
              </Text>
            </View>
          </View>

          {/* Import Info */}
          <View className="mb-6 rounded-xl bg-mid-grey dark:bg-mid-grey-dark p-4">
            <View className="flex-row gap-2">
              <View style={{ marginTop: 2 }}>
                <Monicon
                  name="lucide:info"
                  size={16}
                  color={colors.grey}
                />
              </View>
              <Text className="flex-1 font-geist text-sm text-grey dark:text-grey-dark">
                The import will run in the background. You can track progress on the
                status page.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <Button
              variant="neutral"
              onPress={handleCancel}
              disabled={isImporting}
              className="flex-1">
              Cancel
            </Button>

            <Button
              variant="primary"
              onPress={handleImport}
              disabled={isImporting}
              className="flex-1">
              {isImporting ? (
                <View className="flex-row items-center gap-2 px-4">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="font-geist-semibold text-base text-white">
                    Importing...
                  </Text>
                </View>
              ) : (
                <Text className="font-geist-semibold text-base text-white" numberOfLines={1}>
                  Import {feedCount} {feedCount === 1 ? 'feed' : 'feeds'}
                </Text>
              )}
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

OPMLImportSheet.displayName = 'OPMLImportSheet';
