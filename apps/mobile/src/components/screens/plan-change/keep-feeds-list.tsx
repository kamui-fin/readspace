import { Text } from '@components/ui/text';
import { LegendList } from '@legendapp/list';
import type { SubscriptionResponse } from '@readspace/shared';
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { KeepFeedRow } from './keep-feed-row';

interface KeepFeedsListProps {
  feeds: SubscriptionResponse[];
  limit: number;
  selected: Set<string>;
  onToggle: (feedId: string) => void;
}

const titleOf = (sub: SubscriptionResponse) => sub.custom_title || sub.feed.title || sub.feed.url;

const RowGap = () => <View className="h-0.5" />;

/** Alphabetical, virtualized checklist capped at the plan's feed limit. */
export function KeepFeedsList({ feeds, limit, selected, onToggle }: KeepFeedsListProps) {
  const atLimit = selected.size >= limit;

  const sorted = useMemo(
    () => [...feeds].sort((a, b) => titleOf(a).localeCompare(titleOf(b))),
    [feeds]
  );

  const renderItem = useCallback(
    ({ item }: { item: SubscriptionResponse }) => {
      const checked = selected.has(item.feed.id);
      return (
        <KeepFeedRow
          feedId={item.feed.id}
          title={titleOf(item)}
          folderName={item.folder?.name}
          iconUrl={item.feed.image_url}
          checked={checked}
          disabled={!checked && atLimit}
          onToggle={onToggle}
        />
      );
    },
    [selected, atLimit, onToggle]
  );

  return (
    <View className="flex-1">
      <View className="mb-2 flex-row items-center justify-between">
        <Text size="sm" fontFamily="geist-medium" className="text-grey">
          {atLimit ? 'Limit reached, untick one to swap' : 'Tap a feed to keep it'}
        </Text>
        <View
          className={clsx(
            'min-w-14 items-center rounded-full px-3 py-1.5',
            atLimit ? 'bg-secondary' : 'bg-grey6 dark:bg-grey5'
          )}>
          <Text
            size="sm"
            fontFamily="geist-semibold"
            className={clsx('tabular-nums', atLimit ? 'text-white dark:text-black' : 'text-grey')}
            accessibilityLiveRegion="polite">
            {selected.size}/{limit}
          </Text>
        </View>
      </View>
      <View className="-mx-2 flex-1">
        <LegendList
          data={sorted}
          extraData={selected}
          keyExtractor={(item) => item.feed.id}
          renderItem={renderItem}
          estimatedItemSize={52}
          ItemSeparatorComponent={RowGap}
          recycleItems
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}
