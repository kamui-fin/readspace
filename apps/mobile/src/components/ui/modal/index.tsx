import { CloseCircle } from '@components/icons/svg';
import { BottomSheet, type BottomSheetProps, type SheetRef } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
import { forwardRef } from 'react';
import { View } from 'react-native';

export interface ModalProps extends Omit<BottomSheetProps, 'contentScrollable'> {
  onClose?: () => void;
  showCloseButton?: boolean;
  containerClassName?: string;
}

/**
 * A non-draggable sheet with a close button: same native True Sheet as `BottomSheet`, but the
 * content is laid out as a plain flex column (no pinned ScrollView) and drag-to-dismiss is off,
 * so it only closes via the close button, backdrop tap, or Android back.
 */
export const Modal = forwardRef<SheetRef, ModalProps>(
  (
    {
      children,
      onClose,
      showCloseButton = true,
      containerClassName,
      headerRight,
      secondaryAction,
      footerActions,
      footerClassName,
      contentPaddingHorizontal = 16,
      ...props
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const closeButton =
      showCloseButton && onClose ? (
        <Button variant="icon" size="small" className="h-8 w-8" fullWidth={false} onPress={onClose}>
          <CloseCircle
            width={16}
            height={16}
            color={isDark ? COLORS.dark.grey : COLORS.light.grey}
          />
        </Button>
      ) : null;

    const trailing = headerRight ?? secondaryAction;

    return (
      <BottomSheet
        ref={ref}
        draggable={false}
        contentScrollable={false}
        headerRight={
          trailing || closeButton ? (
            <View className="flex-row items-center gap-2">
              {trailing}
              {closeButton}
            </View>
          ) : undefined
        }
        footerActions={footerActions}
        footerClassName={clsx('px-4', footerClassName)}
        {...props}>
        <View
          className={clsx('flex-1 pb-6', containerClassName)}
          style={{ paddingHorizontal: contentPaddingHorizontal }}>
          {children}
        </View>
      </BottomSheet>
    );
  }
);

Modal.displayName = 'Modal';
