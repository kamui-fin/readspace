/** biome-ignore-all lint/suspicious/noExplicitAny: false positive */
import { LegendList, type LegendListProps, type LegendListRenderItemProps } from '@legendapp/list';
import type { ReactElement } from 'react';
import { forwardRef, useCallback, useMemo } from 'react';

export interface InfiniteScrollListProps<T> extends Omit<
  LegendListProps<T>,
  'data' | 'renderItem' | 'onEndReached' | 'children'
> {
  data: T[];
  renderItem: (item: T, index: number) => ReactElement;
  keyExtractor?: (item: T, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  isLoading?: boolean;
  hasMore?: boolean;
  ListEmptyComponent?: React.ComponentType<any> | ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | ReactElement | null;
  ListHeaderComponent?: React.ComponentType<any> | ReactElement | null;
  estimatedItemSize?: number;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
  initialContainerPoolRatio?: number;
}

export const InfiniteScrollList = forwardRef<any, InfiniteScrollListProps<any>>(
  function InfiniteScrollList(
    {
      data,
      renderItem,
      keyExtractor,
      onEndReached,
      onEndReachedThreshold = 0.5,
      isLoading = false,
      hasMore = true,
      ListEmptyComponent,
      ListFooterComponent,
      ListHeaderComponent,
      estimatedItemSize = 120,
      initialContainerPoolRatio = 10,
      onScroll,
      scrollEventThrottle,
      ...props
    },
    ref
  ) {
    // Deduplicate data based on key extractor
    const deduplicatedData = useMemo(() => {
      if (!keyExtractor) return data;

      const seen = new Set<string>();
      return data.filter((item, index) => {
        const key = keyExtractor(item, index);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }, [data, keyExtractor]);

    // Handle end reached with loading and hasMore checks
    const handleEndReached = useCallback(
      (_info: { distanceFromEnd: number }) => {
        if (!isLoading && hasMore && onEndReached) {
          onEndReached();
        }
      },
      [isLoading, hasMore, onEndReached]
    );

    // Render item wrapper to match LegendList's expected signature
    const renderItemWrapper = useCallback(
      (itemProps: LegendListRenderItemProps<any>) => {
        return renderItem(itemProps.item, itemProps.index);
      },
      [renderItem]
    );

    return (
      <LegendList
        ref={ref}
        data={deduplicatedData}
        renderItem={renderItemWrapper}
        keyExtractor={keyExtractor}
        onEndReached={handleEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        estimatedItemSize={estimatedItemSize}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        ListHeaderComponent={ListHeaderComponent}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        initialContainerPoolRatio={initialContainerPoolRatio}
        style={{
          // List content should be below header (zIndex: 10)
          // The native scrollbar will naturally appear above due to platform rendering
          zIndex: 9,
        }}
        {...props}
      />
    );
  }
);
