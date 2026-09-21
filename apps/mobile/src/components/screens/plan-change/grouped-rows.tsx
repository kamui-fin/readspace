import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { AltArrowRightIcon } from '@solar-icons/react-native/linear';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface GroupedRow {
  key: string;
  label: string;
  detail?: string;
  /** Right-aligned figure, e.g. "144 → 10". */
  value: ReactNode;
}

/**
 * Rows in one rounded card with inset dividers: the same surface and divider colors as the
 * Settings groups, so this screen reads as part of the app in both themes.
 */
export function GroupedRows({ rows }: { rows: GroupedRow[] }) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const surface = isDark ? 'rgb(32, 32, 32)' : colors.grey6;
  const divider = isDark ? 'rgb(46, 46, 46)' : colors.grey5;

  return (
    <View className="overflow-hidden rounded-xl" style={{ backgroundColor: surface }}>
      {rows.map((row, index) => (
        <View key={row.key}>
          <View className="flex-row items-center gap-4 px-5 py-4">
            <View className="flex-1 gap-0.5">
              <Text size={15} fontFamily="geist-medium" className="text-black dark:text-white">
                {row.label}
              </Text>
              {row.detail ? (
                <Text size="sm" fontFamily="geist" className="leading-5 text-grey dark:text-grey">
                  {row.detail}
                </Text>
              ) : null}
            </View>
            {row.value}
          </View>
          {index < rows.length - 1 && (
            <View className="mx-5 h-[1px]" style={{ backgroundColor: divider }} />
          )}
        </View>
      ))}
    </View>
  );
}

/** "144 → 10": the before value muted, the after value in ink. */
export function ChangeValue({ from, to }: { from: number; to: number }) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  return (
    <View className="flex-row items-center gap-1">
      <Text size="lg" fontFamily="geist-medium" className="text-grey dark:text-grey">
        {from}
      </Text>
      <AltArrowRightIcon size={14} color={colors.grey} />
      <Text
        size="lg"
        fontFamily="geist-semibold"
        className="text-primary_foreground dark:text-primary_foreground">
        {to}
      </Text>
    </View>
  );
}

export function PlainValue({ value }: { value: string | number }) {
  return (
    <Text size="lg" fontFamily="geist-medium" className="text-grey dark:text-grey">
      {value}
    </Text>
  );
}
