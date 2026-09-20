import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { SUPPORTS_GLASS } from '@lib/constants/platform';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import clsx from 'clsx';
import type { ReactElement } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomSheetProps, SheetRef } from './types';
import { toDetents } from './utils';

export type { BottomSheetProps, SheetRef } from './types';

/** Clears the native grabber, which UIKit draws over the sheet's first ~20px. */
const HEADER_PADDING_TOP = 30;
const HEADER_PADDING_BOTTOM = 14;

/**
 * The side slots are absolutely positioned, so they sit on top of the title rather than pushing
 * it along. The title reserves this much room per occupied side so a long one truncates before
 * it reaches the buttons instead of running underneath them.
 */
const HEADER_SLOT_RESERVE = 44;

/**
 * Minimum height for the title row when a side slot is present. Absolutely-positioned children
 * contribute nothing to their parent's height, so without this a 40pt button in a slot is sized
 * against the title's line box alone and hangs out of the header.
 */
const HEADER_SLOT_MIN_HEIGHT = 36;

/** Matches the header's own vertical padding so side slots centre on the title, not the padding. */
const HEADER_SLOT_STYLE = {
  position: 'absolute',
  top: HEADER_PADDING_TOP,
  bottom: HEADER_PADDING_BOTTOM,
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
 * True Sheet v3 overlays its footer on the scroll content. Measure that slot so the last row
 * can scroll above the actions, and give opaque sheets an opaque footer surface.
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
      footerBottomPadding: footerBottomPaddingOverride,
      contentPaddingHorizontal = 24,
      contentScrollable = true,
      glass = false,
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
    // True Sheet v3 recommends only the bottom safe-area inset, and none on iPad.
    const footerBottomPadding =
      footerBottomPaddingOverride ?? (Platform.OS === 'ios' && Platform.isPad ? 0 : insets.bottom);
    const sheetRef = useRef<TrueSheet>(null);
    const [footerHeight, setFooterHeight] = useState(0);

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

    const headerPadding = {
      minHeight: 56,
      paddingHorizontal: 24,
      paddingTop: HEADER_PADDING_TOP,
      paddingBottom: HEADER_PADDING_BOTTOM,
    } as const;

    // No title: the slots *are* the header, so they lay out in normal flow and the row takes its
    // height from them. Overlaying them here (the titled branch below) would leave the header
    // sized against an empty title, which is what used to clip sheets whose whole header is a
    // `headerLeft` — an icon and a heading, cut off along the bottom edge.
    let header: ReactElement | undefined;
    if (hasHeader && !headerTitle) {
      header = (
        <View
          className={clsx('flex-row items-center justify-between', headerClassName)}
          style={headerPadding}>
          <View className="flex-shrink">{headerLeft}</View>
          {rightSlot}
        </View>
      );
    } else if (hasHeader) {
      header = (
        <View
          className={clsx('relative flex-row items-center', headerClassName)}
          style={headerPadding}>
          {headerLeft && <View style={[HEADER_SLOT_STYLE, { left: 24 }]}>{headerLeft}</View>}
          <View
            className="flex-1"
            style={{
              justifyContent: 'center',
              minHeight: headerLeft || rightSlot ? HEADER_SLOT_MIN_HEIGHT : undefined,
              paddingLeft: headerLeft ? HEADER_SLOT_RESERVE : 0,
              paddingRight: rightSlot ? HEADER_SLOT_RESERVE : 0,
            }}>
            <Text
              numberOfLines={1}
              className={clsx(
                'font-geist-semibold text-primary-foreground text-2xl',
                headerTitleAlign === 'center' ? 'text-center' : 'text-left'
              )}
              style={[{ lineHeight: 28, letterSpacing: -0.5 }, headerTitleStyle]}>
              {headerTitle}
            </Text>
          </View>
          {rightSlot && <View style={[HEADER_SLOT_STYLE, { right: 24 }]}>{rightSlot}</View>}
        </View>
      );
    }

    const footer = footerActions ? (
      <View
        className={clsx('px-6 pt-2', footerClassName)}
        onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)}
        style={{
          paddingBottom: footerBottomPadding,
          backgroundColor: glass ? undefined : colors.background,
        }}>
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
          paddingBottom: footerActions ? footerHeight + 16 : 18 + insets.bottom,
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
        // Sheets are opaque by default: content behind them (article text, feed rows) shows
        // through the iOS 26 glass material and makes lists hard to read. Sheets that genuinely
        // want the material opt in with `glass`.
        backgroundColor={
          glass && Platform.OS === 'ios' && SUPPORTS_GLASS ? undefined : colors.background
        }
        grabberOptions={{ color: colors.grey4 }}
        header={header}
        footer={footer}
        footerOptions={{ keyboardOffset: -footerBottomPadding }}
        onDidDismiss={onDismiss}
        onDetentChange={handleDetentChange}
        {...props}>
        {content}
      </TrueSheet>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';
