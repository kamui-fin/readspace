import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { useUpdateFeed } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

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
    // The current value lives in a ref, not state — BottomSheetInput renders as an
    // *uncontrolled* input (defaultValue, not value). Feeding onChangeText back into a
    // `value` prop causes the cursor to jump/reset on Android: BottomSheetTextInput
    // wraps react-native-gesture-handler's TextInput, and re-rendering it with a new
    // `value` prop on every keystroke races the native widget's own cursor tracking
    // (move the cursor manually, then backspace, and it jumps again). Reading the
    // latest text from a ref on submit avoids that entirely.
    const feedNameRef = useRef('');
    const [hasText, setHasText] = useState(false);
    const [targetFeedId, setTargetFeedId] = useState<string | null>(null);
    // Bumped on every present() so <BottomSheetInput key={inputKey} .../> remounts and
    // picks up the new defaultValue — an uncontrolled input otherwise ignores prop
    // changes to defaultValue after the first mount.
    const [inputKey, setInputKey] = useState(0);

    const handleChangeText = useCallback((text: string) => {
      feedNameRef.current = text;
      setHasText(text.trim().length > 0);
    }, []);

    const handleUpdateFeed = useCallback(() => {
      const trimmed = feedNameRef.current.trim();
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
    }, [updateFeed, onSuccess, targetFeedId]);

    const handleConfirm = useCallback(() => {
      if (!feedNameRef.current.trim()) return;
      handleUpdateFeed();
      bottomSheetRef.current?.dismiss();
    }, [handleUpdateFeed]);

    useImperativeHandle(ref, () => ({
      present: (feedId: string, currentName: string) => {
        setTargetFeedId(feedId);
        feedNameRef.current = currentName;
        setHasText(currentName.trim().length > 0);
        setInputKey((prev) => prev + 1);
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
          className="font-geist-bold text-primary-foreground mb-1 text-2xl"
          style={{ letterSpacing: -0.5 }}>
          Rename feed
        </Text>
        <Text className="font-geist-regular text-grey dark:text-grey mb-5 text-base">
          Enter a new title for this feed.
        </Text>

        {/* Input */}
        <BottomSheetInput
          key={inputKey}
          defaultValue={feedNameRef.current}
          onChangeText={handleChangeText}
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
            disabled={!hasText || updateFeed.isPending}
            style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
            {updateFeed.isPending ? 'Updating...' : 'Rename'}
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

RenameFeedModal.displayName = 'RenameFeedModal';
