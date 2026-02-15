/** biome-ignore-all assist/source/organizeImports: false positive */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  type BottomSheetModalProps,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { forwardRef, useCallback } from 'react';
import { Text, useColorScheme, View } from 'react-native';

import { COLORS } from '@lib/constants/colors';

export interface BottomSheetProps extends Omit<BottomSheetModalProps, 'children'> {
  children: ReactNode;
  headerTitle?: string;
  headerTitleAlign?: 'left' | 'center';
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  containerClassName?: string;
  headerClassName?: string;
  secondaryAction?: ReactNode; // Positioned at the right
  footerActions?: ReactNode; // Fixed footer buttons outside scroll view
  footerClassName?: string;
}

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  (
    {
      children,
      headerTitle,
      headerTitleAlign = 'center',
      headerLeft,
      headerRight,
      containerClassName,
      headerClassName,
      secondaryAction,
      footerActions,
      footerClassName,
      snapPoints = ['90%'],
      enablePanDownToClose = true,
      backdropComponent,
      ...props
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

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
      console.log('[BottomSheet] Sheet index changed to:', index);
    }, []);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enablePanDownToClose={enablePanDownToClose}
        // allow inner content panning to receive gestures (crucial for inner scroll)
        enableContentPanningGesture={true}
        // allow natural over-drag behaviour if user scrolls past content
        enableOverDrag={true}
        backdropComponent={backdropComponent || renderBackdrop}
        backgroundStyle={{
          backgroundColor: isDark ? COLORS.dark.background : COLORS.light.background,
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? COLORS.dark.grey4 : COLORS.light.grey4,
          width: 40,
          height: 4,
        }}
        animateOnMount={true}
        detached={false}
        android_keyboardInputMode="adjustResize"
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={handleSheetChanges}
        {...props}>
        {/* Header Container - Absolutely positioned over scroll content */}
        {(headerTitle || headerLeft || headerRight || secondaryAction) && (
          <BottomSheetView
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              backgroundColor: isDark ? COLORS.dark.background : COLORS.light.background,
            }}>
            <View
              className={clsx('relative px-4 py-4 flex-row items-center', headerClassName)}
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

              {/* Secondary Action - Absolutely Positioned at right */}
              {secondaryAction && (
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
                  {secondaryAction}
                </View>
              )}

              {/* Header Right */}
              {headerRight && (
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
                  {headerRight}
                </View>
              )}
            </View>
          </BottomSheetView>
        )}

        {/* Scrollable Content (consumers might provide a BottomSheetFlatList instead) */}
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: headerTitle || headerLeft || headerRight || secondaryAction ? 64 : 16,
            paddingBottom: 18,
          }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled">
          {children}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';
