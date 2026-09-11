/** biome-ignore-all assist/source/organizeImports: false positive */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  type BottomSheetModalProps,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { type LayoutChangeEvent, type StyleProp, type TextStyle, View } from 'react-native';
import { Text } from '@components/ui/text';
import { useBottomSheetBackHandler } from '@hooks/useBottomSheetBackHandler';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@lib/constants/colors';

/**
 * gorhom renders `footerComponent` as an actual JSX component type — `<FooterComponent
 * animatedFooterPosition={...} />` inside a `memo()`'d container (see
 * BottomSheetFooterContainer) — not a plain function call. That component instance is also
 * rendered through `@gorhom/portal`: `<Portal>` registers its children into an external store
 * and itself renders nothing, while a separate `<PortalHost>` (mounted once, near the app
 * root via BottomSheetModalProvider) renders those registered nodes AS ITS OWN CHILDREN. So the
 * footer's actual React-tree position is wherever that host is — not wherever our own
 * `<BottomSheetModal>` was called from — which rules out React Context as a way to hand it live
 * data (tried that: it silently resolves to the default value there, since our Provider is
 * never an ancestor of the host).
 *
 * Two consequences of the JSX-component part: a changing `footerComponent` reference makes
 * React unmount/remount the whole footer subtree — resetting anything with its own mount-time
 * animation state (a spinner mid-loading: remounted = restarted, over and over = one that never
 * completes a rotation) — and it's also the ONLY thing that lets that memo() through in the
 * first place. So we need a permanently stable component reference (no remounts, and no reliance
 * on the memo'd parent ever re-rendering) whose rendered content still updates live — and since
 * Context can't reach it, the content flows through a tiny external store instead, referenced by
 * closure/props rather than by tree position, and subscribed to via useSyncExternalStore.
 */
interface FooterContentValue {
  footerActions: ReactNode;
  footerClassName?: string;
  background: string;
  bottomInset: number;
}

interface FooterStore {
  getSnapshot: () => FooterContentValue;
  subscribe: (listener: () => void) => () => void;
  /** Called by BottomSheet on every render; notifies subscribers on the next commit. */
  set: (next: FooterContentValue) => void;
}

function createFooterStore(initial: FooterContentValue): FooterStore {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

/** Module-scope (never recreated) so its identity never churns across BottomSheet renders. */
function FooterRenderer({
  store,
  onFooterLayout,
  ...footerProps
}: BottomSheetFooterProps & {
  store: FooterStore;
  onFooterLayout: (e: LayoutChangeEvent) => void;
}) {
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <BottomSheetFooter {...footerProps} bottomInset={value.bottomInset}>
      <View
        onLayout={onFooterLayout}
        className={clsx('px-6 pb-4 pt-2', value.footerClassName)}
        style={{ backgroundColor: value.background }}>
        {value.footerActions}
      </View>
    </BottomSheetFooter>
  );
}

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
      onChange,
      ...props
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();

    // Merge the forwarded ref with an internal one so the back-handler hook always has an
    // instance to dismiss, regardless of whether the consumer passed an object or callback ref.
    const sheetRef = useRef<BottomSheetModal>(null);
    const setRefs = useCallback(
      (instance: BottomSheetModal | null) => {
        sheetRef.current = instance;
        if (typeof ref === 'function') {
          ref(instance);
        } else if (ref) {
          ref.current = instance;
        }
      },
      [ref]
    );
    const { handleSheetPositionChange } = useBottomSheetBackHandler(sheetRef);

    // Measured so the scroll content can reserve exactly enough bottom padding to clear the
    // floating footer — BottomSheetFooter is an absolutely-positioned overlay (see below), not
    // a layout sibling, so nothing pushes the scroll content up for it automatically.
    const [footerHeight, setFooterHeight] = useState(0);
    const handleFooterLayout = useCallback((e: LayoutChangeEvent) => {
      setFooterHeight(e.nativeEvent.layout.height);
    }, []);

    const footerContentValue = useMemo<FooterContentValue>(
      () => ({
        footerActions,
        footerClassName,
        background: colors.background,
        bottomInset: insets.bottom,
      }),
      [footerActions, footerClassName, colors.background, insets.bottom]
    );

    // One store per BottomSheet instance, created once and never replaced — renderFooter's
    // closure over it (and FooterRenderer's subscription to it) stay valid for the component's
    // whole lifetime regardless of how many times BottomSheet itself re-renders.
    const footerStoreRef = useRef<FooterStore | null>(null);
    if (!footerStoreRef.current) {
      footerStoreRef.current = createFooterStore(footerContentValue);
    }
    // Publish after render commits, not during render — notifying subscribers (which call
    // setState) synchronously mid-render is the kind of thing React explicitly warns against.
    useEffect(() => {
      footerStoreRef.current?.set(footerContentValue);
    }, [footerContentValue]);

    const renderFooter = useCallback(
      (footerProps: BottomSheetFooterProps) => {
        // footerStoreRef.current is set on first render, before this can ever be invoked.
        const store = footerStoreRef.current as FooterStore;
        return (
          <FooterRenderer {...footerProps} store={store} onFooterLayout={handleFooterLayout} />
        );
      },
      [handleFooterLayout]
    );

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

    const handleSheetChanges = useCallback<NonNullable<BottomSheetModalProps['onChange']>>(
      (index, position, type) => {
        console.log('[BottomSheet] Sheet index changed to:', index);
        handleSheetPositionChange(index, position, type);
        onChange?.(index, position, type);
      },
      [handleSheetPositionChange, onChange]
    );

    return (
      <BottomSheetModal
        ref={setRefs}
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
        footerComponent={footerActions ? renderFooter : undefined}
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
            // Clear the floating footer (its own height, already inset-aware) plus a small
            // gap; no footer just needs the usual safe-area breathing room.
            paddingBottom: footerActions ? footerHeight + 16 : 18 + insets.bottom,
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
