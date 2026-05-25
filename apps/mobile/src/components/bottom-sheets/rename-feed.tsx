import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { useUpdateFeed } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@components/ui/text';

export interface RenameFeedModalRef {
  present: (feedId: string, currentName: string) => void;
  dismiss: () => void;
}

export interface RenameFeedModalProps {
  onSuccess?: () => void;
}

export const RenameFeedModal = forwardRef<RenameFeedModalRef, RenameFeedModalProps>(
  ({ onSuccess }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const updateFeed = useUpdateFeed();
    const [feedName, setFeedName] = useState('');
    const [targetFeedId, setTargetFeedId] = useState<string | null>(null);

    const handleUpdateFeed = useCallback(() => {
      const trimmed = feedName.trim();
      if (trimmed && targetFeedId) {
        updateFeed.mutate(
          {
            feedId: targetFeedId,
            data: { custom_title: trimmed },
          },
          {
            onSuccess: () => {
              toast.success('Feed renamed successfully');
              onSuccess?.();
            },
            onError: () => {
              toast.error('Failed to rename feed');
            },
          }
        );
      }
    }, [updateFeed, onSuccess, feedName, targetFeedId]);

    const handleConfirm = useCallback(() => {
      if (!feedName.trim()) return;
      handleUpdateFeed();
      bottomSheetRef.current?.dismiss();
    }, [feedName, handleUpdateFeed]);

    useImperativeHandle(ref, () => ({
      present: (feedId: string, currentName: string) => {
        setTargetFeedId(feedId);
        setFeedName(currentName);
        bottomSheetRef.current?.present();
      },
      dismiss: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    return (
      <BottomSheet
        ref={bottomSheetRef}
        enablePanDownToClose={true}
        snapPoints={['25%']}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore">
        {/* Heading */}
        <Text
          className="font-geist-bold text-2xl text-primary-foreground mb-1"
          style={{ letterSpacing: -0.5 }}>
          Rename feed
        </Text>
        <Text className="font-geist-regular text-base text-grey dark:text-grey mb-5">
          Enter a new title for this feed.
        </Text>

        {/* Input */}
        <BottomSheetInput
          value={feedName}
          onChangeText={setFeedName}
          placeholder="Feed title"
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
          borderRadius={14}
        />

        {/* Update Button */}
        <View className="mt-5">
          <Button
            variant="primary"
            size="large"
            fullWidth
            onPress={handleConfirm}
            disabled={!feedName.trim() || updateFeed.isPending}
            style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
            {updateFeed.isPending ? 'Updating...' : 'Rename'}
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

RenameFeedModal.displayName = 'RenameFeedModal';
