import {
  tabsContainerVariants,
  tabsGroupVariants,
  tabsRowVariants,
} from '@/components/navigation/header/constants/header-variants';
import { Tab } from '@components/navigation/tab';
import { Button } from '@components/ui/button';
import { DEVICE_CORNER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import clsx from 'clsx';
import { View } from 'react-native';

export const buttonConfigs = [
  { label: 'Today', iconName: 'solar:calendar-bold' },
  { label: 'Saved', iconName: 'solar:bookmark-bold' },
  { label: 'All', iconName: 'solar:inbox-bold' },
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
  return (
    <View className={clsx(tabsRowVariants())} onLayout={onLayout}>
      <View className={clsx(tabsContainerVariants())}>
        <View className={clsx(tabsGroupVariants())}>
          {buttonConfigs.map((btn, index) => (
            <Tab
              key={btn.label}
              label={btn.label}
              active={activeTab === index}
              onPress={() => onTabChange?.(index)}
              iconName={btn.iconName}
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
              <Monicon name="solar:sort-bold" size={16} color={colors.grey2} />
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}
