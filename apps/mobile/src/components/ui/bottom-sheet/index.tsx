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
import { type StyleProp, type TextStyle, View } from 'react-native';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@lib/constants/colors';

export interface BottomSheetProps extends Omit<BottomSheetModalProps, 'children'> {
  children: ReactNode;
  headerTitle?: string;
  headerTitleAlign?: 'left' | 'center';
  headerTitleStyle?: StyleProp<TextStyle>;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  containerClassName?: string;
  headerClassName?: string;
  secondaryAction?: ReactNode; // Positioned at the right
  footerActions?: ReactNode; // Fixed footer buttons outside scroll view
  footerClassName?: string;
  /** Override the horizontal padding on the scroll content (default 24). Pass 0 for full-bleed content. */
  contentPaddingHorizontal?: number;
}

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  (
    {
      children,
      headerTitle,
      headerTitleAlign = 'center',
      headerTitleStyle,
      headerLeft,
      headerRight,
      containerClassName,
      headerClassName,
      secondaryAction,
      footerActions,
      footerClassName,
      contentPaddingHorizontal = 24,
      snapPoints = ['90%'],
      enablePanDownToClose = true,
      backdropComponent,
      ...props
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();

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
        topInset={insets.top}
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
              className={clsx('relative flex-row items-center py-4', headerClassName)}
              style={{ minHeight: 56, paddingHorizontal: 24 }}>
              {/* Header Left */}
              {headerLeft && (
                <View
                  style={{
                    position: 'absolute',
                    left: 24,
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
                      'font-geist-semibold text-primary-foreground text-2xl',
                      headerTitleAlign === 'center' ? 'text-center' : 'text-left'
                    )}
                    style={[{ lineHeight: 28, letterSpacing: -0.5 }, headerTitleStyle]}>
                    {headerTitle}
                  </Text>
                )}
              </View>

              {/* Secondary Action - Absolutely Positioned at right */}
              {secondaryAction && (
                <View
                  style={{
                    position: 'absolute',
                    right: 24,
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
                    right: 24,
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
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{
            paddingHorizontal: contentPaddingHorizontal,
            paddingTop: headerTitle || headerLeft || headerRight || secondaryAction ? 64 : 16,
            paddingBottom: footerActions ? 12 : 18 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled">
          {children}
        </BottomSheetScrollView>

        {/* Fixed Footer */}
        {footerActions && (
          <View
            className={clsx('px-6 pb-4 pt-2', footerClassName)}
            style={{
              backgroundColor: colors.background,
              paddingBottom: 12 + insets.bottom,
            }}>
            {footerActions}
          </View>
        )}
      </BottomSheetModal>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';
