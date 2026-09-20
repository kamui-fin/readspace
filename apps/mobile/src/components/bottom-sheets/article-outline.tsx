import type { OutlineItem } from '@components/screens/article-reader/index';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { forwardRef, useMemo } from 'react';
import { Pressable, View } from 'react-native';

interface ArticleOutlineBottomSheetProps {
  outline: OutlineItem[];
  /** Offset of the heading nearest the top of the viewport, for the "you are here" marker. */
  activeItemId?: string | null;
  onSelect: (item: OutlineItem) => void;
}

/**
 * The article's headings, for jumping around a long piece.
 *
 * The reader only offers this when an article actually has a usable structure
 * (see MIN_OUTLINE_ITEMS in the reader screen) — most RSS items have no
 * headings at all, and an always-present outline button that's usually empty is
 * worse than no button.
 */
export const ArticleOutlineBottomSheet = forwardRef<SheetRef, ArticleOutlineBottomSheetProps>(
  ({ outline, activeItemId, onSelect }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const snapPoints = useMemo(() => ['50%', '85%'], []);

    return (
      <BottomSheet ref={ref} headerTitle="Outline" snapPoints={snapPoints}>
        <View className="pb-8">
          {outline.map((item) => {
            const isActive = item.id === activeItemId;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  onSelect(item);
                  if (ref && typeof ref !== 'function') ref.current?.dismiss();
                }}
                className="flex-row items-stretch"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                {/* A continuous rail down the left edge, filled in at the
                    current heading — cheaper to scan than indentation alone. */}
                <View
                  style={{
                    width: 2,
                    borderRadius: 1,
                    backgroundColor: isActive ? colors.secondary : colors.grey4,
                  }}
                />
                <Text
                  size={item.level === 3 ? 14 : 15}
                  fontFamily={isActive ? 'geist-semibold' : 'geist'}
                  numberOfLines={2}
                  style={{
                    color: isActive ? colors.black : colors.grey2,
                    paddingVertical: 11,
                    paddingRight: 8,
                    paddingLeft: item.level === 3 ? 28 : 14,
                    flex: 1,
                  }}>
                  {item.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    );
  }
);

ArticleOutlineBottomSheet.displayName = 'ArticleOutlineBottomSheet';
