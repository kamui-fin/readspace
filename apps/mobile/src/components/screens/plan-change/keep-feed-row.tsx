import { CheckboxIndicator } from '@components/ui/checkbox';
import { createFeedFallback } from '@components/ui/feed-fallback-icon';
import { FeedIcon } from '@components/ui/feed-icon';
import { Text } from '@components/ui/text';
import clsx from 'clsx';
import * as Haptics from 'expo-haptics';
import { memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';

interface KeepFeedRowProps {
  feedId: string;
  title: string;
  folderName?: string;
  iconUrl?: string | null;
  checked: boolean;
  disabled: boolean;
  onToggle: (feedId: string) => void;
}

/**
 * One pickable feed. The whole row is the tap target (the checkbox is purely visual) and a
 * checked row picks up a faint brand-green wash so the kept set reads at a glance while scrolling.
 */
export const KeepFeedRow = memo(function KeepFeedRow({
  feedId,
  title,
  folderName,
  iconUrl,
  checked,
  disabled,
  onToggle,
}: KeepFeedRowProps) {
  const fallback = useMemo(() => createFeedFallback(title), [title]);
  const handleToggle = () => {
    if (disabled) return;
    Haptics.selectionAsync();
    onToggle(feedId);
  };

  return (
    <Pressable
      onPress={handleToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`Keep ${title}`}
      className={clsx(
        'flex-row items-center gap-3 rounded-xl px-2 py-2 active:opacity-70',
        checked && 'bg-primary-light',
        disabled && 'opacity-40'
      )}>
      <FeedIcon url={iconUrl} size={30} borderRadius={7} fallbackComponent={fallback} />
      <View className="flex-1">
        <Text
          size="base"
          fontFamily="geist-medium"
          className="text-black dark:text-white"
          numberOfLines={1}>
          {title}
        </Text>
        {folderName ? (
          <Text size="xs" fontFamily="geist" className="text-grey" numberOfLines={1}>
            {folderName}
          </Text>
        ) : null}
      </View>
      <CheckboxIndicator checked={checked} />
    </Pressable>
  );
});
