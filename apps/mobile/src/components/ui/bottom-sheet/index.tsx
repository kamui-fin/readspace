import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { SUPPORTS_GLASS } from '@lib/constants/platform';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import clsx from 'clsx';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomSheetProps, SheetRef } from './types';
import { toDetents } from './utils';

export type { BottomSheetProps, SheetRef } from './types';

const HEADER_SLOT_STYLE = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
} as const;

/**
 * App-wide sheet: a native `UISheetPresentationController` (iOS, Liquid Glass on iOS 26+) /
 * Material bottom sheet (Android) via `@lodev09/react-native-true-sheet`. Keyboard avoidance,
 * drag, dimming and Android back-dismissal are handled natively — no back-handler hook, portal,
 * or footer store needed.
 *
 * The header and footer are real True Sheet `header` / `footer` slots (pinned above/below the
 * scroll content), so no manual padding math is required.
 */
export const BottomSheet = forwardRef<SheetRef, BottomSheetProps>(
  (
    {
      children,
      headerTitle,
      headerTitleAlign = 'center',
      headerTitleStyle,
      headerLeft,
      headerRight,
      headerClassName,
      secondaryAction,
      footerActions,
      footerClassName,
      contentPaddingHorizontal = 24,
      contentScrollable = true,
      snapPoints = ['90%'],
      enablePanDownToClose = true,
      onDismiss,
      onChange,
      index,
      ...props
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<TrueSheet>(null);

    useImperativeHandle(
      ref,
      () => ({
        present: (detentIndex = 0) => sheetRef.current?.present(detentIndex) ?? Promise.resolve(),
        dismiss: () => sheetRef.current?.dismiss() ?? Promise.resolve(),
        snapToIndex: (detentIndex) => sheetRef.current?.resize(detentIndex) ?? Promise.resolve(),
      }),
      []
    );

    const handleDetentChange = useCallback(
      (event: { nativeEvent: { index: number } }) => onChange?.(event.nativeEvent.index),
      [onChange]
    );

    const detents = useMemo(() => toDetents(snapPoints), [snapPoints]);
    const hasHeader = Boolean(headerTitle || headerLeft || headerRight || secondaryAction);
    const rightSlot = headerRight ?? secondaryAction;

    const header = hasHeader ? (
      <View
        className={clsx('relative flex-row items-center py-4', headerClassName)}
        style={{ minHeight: 56, paddingHorizontal: 24 }}>
        {headerLeft && <View style={[HEADER_SLOT_STYLE, { left: 24 }]}>{headerLeft}</View>}
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
        {rightSlot && <View style={[HEADER_SLOT_STYLE, { right: 24 }]}>{rightSlot}</View>}
      </View>
    ) : undefined;

    const footer = footerActions ? (
      <View
        className={clsx('px-6 pt-2', footerClassName)}
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {footerActions}
      </View>
    ) : undefined;

    const content = contentScrollable ? (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        contentContainerStyle={{
          paddingHorizontal: contentPaddingHorizontal,
          paddingTop: hasHeader ? 0 : 16,
          paddingBottom: footerActions ? 16 : 18 + insets.bottom,
        }}>
        {children}
      </ScrollView>
    ) : (
      children
    );

    return (
      <TrueSheet
        ref={sheetRef}
        detents={detents}
        dismissible={enablePanDownToClose}
        initialDetentIndex={index}
        scrollable={contentScrollable}
        // Native material (glass on iOS 26+) is kept where it exists; elsewhere we paint the
        // app background so sheets match the themed screens underneath.
        backgroundColor={Platform.OS === 'ios' && SUPPORTS_GLASS ? undefined : colors.background}
        grabberOptions={{ color: colors.grey4 }}
        header={header}
        footer={footer}
        footerOptions={{ keyboardOffset: -insets.bottom }}
        onDidDismiss={onDismiss}
        onDetentChange={handleDetentChange}
        {...props}>
        {content}
      </TrueSheet>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';
