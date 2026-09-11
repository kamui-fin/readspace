import type { BottomSheetModal, BottomSheetModalProps } from '@gorhom/bottom-sheet';
import { useCallback, useRef } from 'react';
import { BackHandler, type NativeEventSubscription } from 'react-native';

/**
 * Dismisses a bottom sheet on the Android hardware/gesture back press while it's open, and
 * releases the listener once it closes — otherwise the back press falls through to the screen
 * underneath and navigates away instead of just closing the sheet.
 */
export const useBottomSheetBackHandler = (
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
) => {
  const backHandlerSubscriptionRef = useRef<NativeEventSubscription | null>(null);

  const handleSheetPositionChange = useCallback<NonNullable<BottomSheetModalProps['onChange']>>(
    (index) => {
      const isBottomSheetVisible = index >= 0;
      if (isBottomSheetVisible && !backHandlerSubscriptionRef.current) {
        backHandlerSubscriptionRef.current = BackHandler.addEventListener(
          'hardwareBackPress',
          () => {
            bottomSheetRef.current?.dismiss();
            return true;
          }
        );
      } else if (!isBottomSheetVisible) {
        backHandlerSubscriptionRef.current?.remove();
        backHandlerSubscriptionRef.current = null;
      }
    },
    [bottomSheetRef]
  );

  return { handleSheetPositionChange };
};
