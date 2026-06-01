import { View } from 'react-native';
import { Text } from '@components/ui/text';

const PINNED_YELLOW = '#EAB308';

export interface SectionLabelProps {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  /** Use yellow for icon and text (Pinned section) */
  accentYellow?: boolean;
}

/**
 * Section label matching the FEEDS style - uppercase, tracking, muted.
 * Used for "Pinned" and "Feeds" headers in the feed switcher.
 */
export function SectionLabel({
  label,
  icon,
  className = '',
  accentYellow = false,
}: SectionLabelProps) {
  return (
    <View className={`mb-3 flex-row items-center gap-2 px-1 ${className}`.trim()}>
      {icon}
      <Text
        className={
          accentYellow
            ? 'font-geist-bold text-[11px] uppercase tracking-widest'
            : 'font-geist-bold text-grey2 text-[11px]  uppercase tracking-widest opacity-60'
        }
        style={accentYellow ? { color: PINNED_YELLOW } : undefined}>
        {label}
      </Text>
    </View>
  );
}
