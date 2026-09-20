import { Languages, Plus } from '@components/icons/svg';
import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { SettingsMinimalisticIcon } from '@solar-icons/react-native/linear';
import { View } from 'react-native';
import type { SearchActionsProps } from './types';

export type { SearchActionsProps } from './types';

const ICON_SIZE = 20;

/**
 * Android / default: the three controls as a row of icon buttons, for a title row rather than a
 * navigation bar. iOS renders them as a native `headerRight` glass cluster.
 */
export function SearchActions({
  onOpenOptions,
  onOpenLanguage,
  onOpenAddFeed,
}: SearchActionsProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <View className="flex-row items-center gap-2">
      <Button
        variant="icon"
        size="small"
        className="bg-grey6"
        fullWidth={false}
        onPress={onOpenOptions}
        accessibilityLabel="Search options">
        <SettingsMinimalisticIcon size={ICON_SIZE} strokeWidth={2} color={colors.grey} />
      </Button>
      <Button
        variant="icon"
        size="small"
        className="bg-grey6"
        fullWidth={false}
        onPress={onOpenLanguage}
        accessibilityLabel="Search language">
        <Languages width={ICON_SIZE} height={ICON_SIZE} color={colors.grey} />
      </Button>
      <Button
        variant="icon"
        size="small"
        className="bg-grey6"
        fullWidth={false}
        onPress={onOpenAddFeed}
        accessibilityLabel="Add feed">
        <Plus width={ICON_SIZE} height={ICON_SIZE} color={colors.grey} />
      </Button>
    </View>
  );
}
