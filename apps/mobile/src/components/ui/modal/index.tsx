/** biome-ignore-all assist/source/organizeImports: false positive */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  type BottomSheetModalProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { forwardRef, useCallback } from 'react';
import { Platform, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@components/icons/close';
import { Button } from '@components/ui/button';
import { Divider } from '@components/ui/divider';
import { COLORS } from '@lib/constants/colors';

export interface ModalProps extends Omit<BottomSheetModalProps, 'children'> {
  children: ReactNode;
  headerTitle?: string;
  headerTitleAlign?: 'left' | 'center';
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  containerClassName?: string;
  headerClassName?: string;
  secondaryAction?: ReactNode; // Positioned to the left of close button
  footerActions?: ReactNode; // Fixed footer buttons outside scroll view
  footerClassName?: string;
}

export const Modal = forwardRef<BottomSheetModal, ModalProps>(
  (
    {
      children,
      headerTitle,
      headerTitleAlign = 'center',
      headerLeft,
      headerRight,
      onClose,
      showCloseButton = true,
      containerClassName,
      headerClassName,
      secondaryAction,
      footerActions,
      footerClassName,
      snapPoints = ['90%'],
      enablePanDownToClose = false,
      backdropComponent,
      ...props
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const isIOS = Platform.OS === 'ios';

    const renderBackdrop = useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...backdropProps}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const handleSheetChanges = useCallback((index: number) => {
      console.log('[Modal] Sheet index changed to:', index);
    }, []);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enablePanDownToClose={enablePanDownToClose}
        enableContentPanningGesture={false}
        enableOverDrag={false}
        backdropComponent={backdropComponent || renderBackdrop}
        backgroundStyle={{
          backgroundColor: isIOS
            ? 'transparent'
            : isDark
              ? COLORS.dark.background
              : COLORS.light.background,
        }}
        handleIndicatorStyle={{ display: 'none' }}
        animateOnMount={true}
        detached={isIOS}
        bottomInset={insets.bottom}
        android_keyboardInputMode="adjustResize"
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={handleSheetChanges}
        style={isIOS ? { marginHorizontal: 6 } : undefined}
        {...props}>
        <BottomSheetView
          className={clsx(
            'flex-1 bg-white dark:bg-screen-dark',
            isIOS && 'overflow-hidden rounded-3xl',
            containerClassName
          )}>
          {/* Header Container */}
          {(headerTitle ||
            headerLeft ||
            headerRight ||
            secondaryAction ||
            (showCloseButton && onClose)) && (
            <>
              <View
                className={clsx('relative px-4 py-2 flex-row items-center', headerClassName)}
                style={{ minHeight: 56 }}>
                {/* Header Left */}
                {headerLeft && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 16,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 10,
                    }}>
                    {headerLeft}
                  </View>
                )}

                {/* Header Content - Centered or Left Aligned */}
                <View className="flex-1" style={{ justifyContent: 'center' }}>
                  {headerTitle && (
                    <Text
                      className={clsx(
                        'font-geist-semibold text-2xl text-primary-foreground dark:text-primary-foreground-dark',
                        headerTitleAlign === 'center' ? 'text-center' : 'text-left'
                      )}
                      style={{ lineHeight: 28 }}>
                      {headerTitle}
                    </Text>
                  )}
                </View>

                {/* Secondary Action - Absolutely Positioned (to the left of close button) */}
                {secondaryAction && (
                  <View
                    style={{
                      position: 'absolute',
                      right: showCloseButton && onClose ? 56 : 16,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 10,
                    }}>
                    {secondaryAction}
                  </View>
                )}

                {/* Close Button - Absolutely Positioned */}
                {showCloseButton && onClose && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 16,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 10,
                    }}>
                    <Button
                      variant="icon"
                      size="small"
                      className="h-8 w-8"
                      fullWidth={false}
                      onPress={onClose}>
                      <CloseIcon
                        size={16}
                        strokeWidth={2.8}
                        color={isDark ? COLORS.dark.grey : COLORS.light.grey}
                      />
                    </Button>
                  </View>
                )}

                {/* Header Right */}
                {headerRight && (
                  <View
                    style={{
                      position: 'absolute',
                      right: showCloseButton && onClose ? 56 : 16,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 10,
                    }}>
                    {headerRight}
                  </View>
                )}
              </View>
            </>
          )}

          {/* Content */}
          <View className="flex-1 px-4 pb-6">{children}</View>

          {/* Footer Actions - Fixed at bottom */}
          {footerActions && (
            <View className={clsx('px-4 pb-4', footerClassName)}>{footerActions}</View>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

Modal.displayName = 'Modal';
