import { Chip } from '@components/ui/chip';
import { Text } from '@components/ui/text';
import { MOBILE_CATEGORY_NAMES } from '@readspace/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';

interface CategoriesListProps {
  categories: string[];
  selectedCategory?: string | null;
  onCategoryPress: (category: string) => void;
  showHeader?: boolean;
}

interface ChipLayout {
  x: number;
  width: number;
}

const EDGE_PADDING = 16;

/**
 * Two horizontally scrolling rows of category chips.
 *
 * The selected chip keeps its position and is scrolled into view instead of
 * being hoisted to the front: reordering moved the target out from under the
 * finger and re-laid out the whole rail before results had even started
 * loading. Scrolling solves the real problem the hoist was solving — making
 * sure you can see what you just picked — without the rearrangement.
 */
export function CategoriesList({
  categories,
  selectedCategory,
  onCategoryPress,
  showHeader = true,
}: CategoriesListProps) {
  const scrollRef = useRef<ScrollView>(null);
  const chipLayouts = useRef<Record<string, ChipLayout>>({});
  const scrollOffset = useRef(0);
  const viewportWidth = useRef(0);

  const rows = useMemo(() => {
    const half = Math.ceil(categories.length / 2);
    return [categories.slice(0, half), categories.slice(half)];
  }, [categories]);

  const ensureVisible = useCallback((categoryId: string) => {
    const layout = chipLayouts.current[categoryId];
    const viewport = viewportWidth.current;
    if (!layout || !viewport) return;

    const visibleLeft = scrollOffset.current;
    const visibleRight = visibleLeft + viewport;

    if (layout.x < visibleLeft + EDGE_PADDING) {
      scrollRef.current?.scrollTo({ x: Math.max(0, layout.x - EDGE_PADDING), animated: true });
    } else if (layout.x + layout.width > visibleRight - EDGE_PADDING) {
      scrollRef.current?.scrollTo({
        x: layout.x + layout.width - viewport + EDGE_PADDING,
        animated: true,
      });
    }
  }, []);

  useEffect(() => {
    if (selectedCategory) ensureVisible(selectedCategory);
  }, [selectedCategory, ensureVisible]);

  const handleChipLayout = useCallback(
    (categoryId: string, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      chipLayouts.current[categoryId] = { x, width };
      // Rails mount after a selection is already in place (switching into the
      // results view), so the first measurement is the earliest chance to bring
      // the selected chip on screen.
      if (categoryId === selectedCategory) ensureVisible(categoryId);
    },
    [selectedCategory, ensureVisible]
  );

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.x;
  }, []);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportWidth.current = event.nativeEvent.layout.width;
  }, []);

  return (
    <View>
      {showHeader && (
        <View className="mb-4 px-6">
          <Text size="base" fontFamily="geist-semibold" className="text-black">
            Categories
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        onScroll={handleScroll}
        onLayout={handleViewportLayout}
        scrollEventThrottle={16}
        className="pl-6">
        <View className="gap-2 pr-6">
          {rows.map((row, rowIndex) => (
            <View key={row[0] ?? `category-row-${rowIndex}`} className="flex-row gap-2">
              {row.map((categoryId) => (
                <View key={categoryId} onLayout={(event) => handleChipLayout(categoryId, event)}>
                  <Chip
                    label={MOBILE_CATEGORY_NAMES[categoryId as keyof typeof MOBILE_CATEGORY_NAMES]}
                    selected={selectedCategory === categoryId}
                    onPress={() => onCategoryPress(categoryId)}
                    size="category"
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
