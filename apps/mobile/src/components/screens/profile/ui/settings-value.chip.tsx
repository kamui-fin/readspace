import { ExpandVertical } from '@components/icons/svg';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { forwardRef } from 'react';
import { Pressable, View } from 'react-native';

interface SettingsValueChipProps {
  value: string;
}

/**
 * The trailing value + chevron of a `select` settings row, promoted into its own
 * tappable pill.
 *
 * Why it exists: iOS presents a menu by *lifting* its trigger — the real view is
 * hidden and a floating copy is shown above the dimmed backdrop. With a
 * full-width row as the trigger that reads as the row vanishing and leaving a
 * hole in the group. Scoping the trigger to this chip keeps the row in place and
 * lifts something small, exactly like the icon-button menus elsewhere in the app.
 *
 * The pill background is what makes the reduced tap target legible — without it
 * there's no affordance telling you only the right edge is interactive.
 */
export const SettingsValueChip = forwardRef<
  React.ElementRef<typeof Pressable>,
  SettingsValueChipProps & React.ComponentProps<typeof Pressable>
>(({ value, ...props }, ref) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <Pressable
      ref={ref}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      {...props}>
      <View
        className="flex-row items-center gap-1.5 rounded-lg py-1.5 pl-3 pr-2"
        style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : colors.grey5 }}>
        <Text size={15} fontFamily="geist-medium" className="text-grey dark:text-grey">
          {value}
        </Text>
        <ExpandVertical width={18} height={18} color={colors.grey} />
      </View>
    </Pressable>
  );
});

SettingsValueChip.displayName = 'SettingsValueChip';
