import { Tab } from '@components/navigation/tab';
import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { DEVICE_CORNER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { FOLLOWING_TAB } from '@lib/constants/tabs';
import { BookmarkIcon, CalendarIcon, InboxIcon, SortIcon } from '@solar-icons/react-native/bold';
import clsx from 'clsx';
import { View } from 'react-native';
import {
  tabsContainerVariants,
  tabsGroupVariants,
  tabsRowVariants,
} from '@/components/navigation/header/constants/header-variants';

/**
 * Rendered left-to-right; the array index IS the tab index, so this order must
 * stay in lockstep with `FOLLOWING_TAB` in `@lib/constants/tabs`.
 */
export const buttonConfigs = [
  { label: 'Today', icon: CalendarIcon, index: FOLLOWING_TAB.TODAY },
  { label: 'All', icon: InboxIcon, index: FOLLOWING_TAB.ALL },
  { label: 'Saved', icon: BookmarkIcon, index: FOLLOWING_TAB.SAVED },
];

interface HeaderTabsProps {
  activeTab: number;
  onTabChange?: (index: number) => void;
  showSort?: boolean;
  onSortPress?: () => void;
  actionButton?: React.ReactNode;
  colors: typeof COLORS.light | typeof COLORS.dark;
  onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
}

export function HeaderTabs({
  activeTab,
  onTabChange,
  showSort,
  onSortPress,
  actionButton,
  colors,
  onLayout,
}: HeaderTabsProps) {
  const tabRowBgColor = colors.card;

  return (
    <View
      className={clsx(tabsRowVariants())}
      onLayout={onLayout}
      style={{ backgroundColor: tabRowBgColor }}>
      <View className={clsx(tabsContainerVariants())}>
        <View className={clsx(tabsGroupVariants())}>
          {buttonConfigs.map((btn) => (
            <Tab
              key={btn.label}
              label={btn.label}
              active={activeTab === btn.index}
              onPress={() => onTabChange?.(btn.index)}
              icon={btn.icon}
            />
          ))}
        </View>

        <View className="flex-row items-center gap-2">
          {/* Action button - generic, reusable component */}
          {actionButton}

          {showSort && (
            <Button
              onPress={onSortPress}
              variant="secondary"
              size="small"
              fullWidth={false}
              className="min-h-9 px-3 py-2"
              style={{
                backgroundColor: colors.grey5,
                borderRadius: DEVICE_CORNER_RADIUS - 2,
              }}>
              <SortIcon size={16} color={colors.grey2} />
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}
