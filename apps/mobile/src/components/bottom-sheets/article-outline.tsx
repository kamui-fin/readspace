import type { OutlineItem } from '@components/screens/article-reader/index';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { AltArrowRightIcon } from '@solar-icons/react-native/linear';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildOutlineRows } from './article-outline.utils';

interface ArticleOutlineBottomSheetProps {
  outline: OutlineItem[];
  activeItemId?: string | null;
  onSelect: (item: OutlineItem) => void;
}

export const ArticleOutlineBottomSheet = forwardRef<SheetRef, ArticleOutlineBottomSheetProps>(
  ({ outline, activeItemId, onSelect }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<TrueSheet>(null);
    const scrollRef = useRef<ScrollView>(null);
    const offsets = useRef(new Map<string, number>());
    const pendingScroll = useRef<string | null>(null);
    const presented = useRef(false);
    const pendingSelection = useRef<OutlineItem | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [navigationVersion, setNavigationVersion] = useState(0);
    const rows = useMemo(() => buildOutlineRows(outline), [outline]);
    const visibleRows = useMemo(
      () => rows.filter((row) => !row.ancestors.some((id) => collapsed.has(id))),
      [rows, collapsed]
    );
    const activeRow = rows.find((row) => row.item.id === activeItemId);
    const accent = isDark ? colors.secondary_foreground : colors.primary;

    const scrollToPending = () => {
      const id = pendingScroll.current;
      if (!presented.current || !id) return;
      const y = offsets.current.get(id);
      if (y === undefined) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: false });
      pendingScroll.current = null;
    };

    useImperativeHandle(ref, () => ({
      present: async (index = 0) => {
        presented.current = false;
        setCollapsed(new Set());
        offsets.current.clear();
        setNavigationVersion((version) => version + 1);
        pendingScroll.current = activeItemId ?? null;
        await sheetRef.current?.present(index);
      },
      dismiss: async () => {
        await sheetRef.current?.dismiss();
      },
      snapToIndex: async (index) => {
        await sheetRef.current?.resize(index);
      },
    }));

    return (
      <TrueSheet
        ref={sheetRef}
        detents={[0.65, 0.92]}
        scrollable
        backgroundColor={colors.background}
        cornerRadius={28}
        grabberOptions={{ color: colors.grey3 }}
        onDidPresent={() => {
          presented.current = true;
          if (pendingScroll.current) scrollToPending();
          else scrollRef.current?.scrollTo({ y: 0, animated: false });
        }}
        onDidDismiss={() => {
          presented.current = false;
          const item = pendingSelection.current;
          pendingSelection.current = null;
          if (item) onSelect(item);
        }}
        header={
          <View
            style={{
              paddingTop: 28,
              paddingHorizontal: 20,
              paddingBottom: 18,
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
            }}>
            <Text size={22} fontFamily="geist-semibold" style={{ letterSpacing: -0.5 }}>
              Contents
            </Text>
            <Text size={12} style={{ color: colors.primary_foreground, opacity: 0.55 }}>
              {outline.length} {outline.length === 1 ? 'heading' : 'headings'}
            </Text>
          </View>
        }>
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          onContentSizeChange={scrollToPending}>
          {visibleRows.map(({ item, ancestors, hasChildren }, index) => {
            const isActive = item.id === activeItemId;
            const isCollapsed = collapsed.has(item.id);
            const containsActive = isCollapsed && activeRow?.ancestors.includes(item.id);
            const marked = isActive || containsActive;
            const isRoot = ancestors.length === 0;
            const textInset = 20 + Math.min(ancestors.length, 3) * 16;
            return (
              <View
                key={`${navigationVersion}-${item.id}`}
                onLayout={({ nativeEvent }) => {
                  offsets.current.set(item.id, nativeEvent.layout.y);
                  if (pendingScroll.current === item.id) requestAnimationFrame(scrollToPending);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  backgroundColor: marked ? colors.primary_light : 'transparent',
                }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.text}
                  accessibilityHint="Jump to this section"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => {
                    pendingSelection.current = item;
                    void sheetRef.current?.dismiss();
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 54,
                    justifyContent: 'center',
                    paddingVertical: 14,
                    paddingLeft: textInset,
                    paddingRight: 20,
                    backgroundColor: pressed ? colors.card : 'transparent',
                  })}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      size={15}
                      fontFamily={isRoot || marked ? 'geist-semibold' : 'geist'}
                      style={{ color: colors.primary_foreground, lineHeight: 22 }}>
                      {item.text}
                    </Text>
                    {marked && (
                      <Text size={11} fontFamily="geist-medium" style={{ color: accent }}>
                        {isActive ? 'Currently reading' : 'Current section inside'}
                      </Text>
                    )}
                  </View>
                </Pressable>
                {hasChildren && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${item.text}`}
                    accessibilityState={{ expanded: !isCollapsed }}
                    onPress={() => {
                      pendingScroll.current = null;
                      setCollapsed((previous) => {
                        const next = new Set(previous);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    style={({ pressed }) => ({
                      width: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.5 : 1,
                    })}>
                    <AltArrowRightIcon
                      size={16}
                      color={colors.primary_foreground}
                      style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }] }}
                    />
                  </Pressable>
                )}
                {index < visibleRows.length - 1 && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: textInset,
                      right: 20,
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: colors.grey4,
                    }}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      </TrueSheet>
    );
  }
);

ArticleOutlineBottomSheet.displayName = 'ArticleOutlineBottomSheet';
