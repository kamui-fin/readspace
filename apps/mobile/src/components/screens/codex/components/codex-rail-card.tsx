import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

interface RailCardProps {
  title: string;
  children: ReactNode;
  /** Lets a caller drop this into a row (e.g. `{ flex: 1 }` for a two-up layout). */
  style?: StyleProp<ViewStyle>;
}

/**
 * The panel shared by the digest's small stat cards ("This issue", "Condensed", "Trends") —
 * web sinks these into a sidebar rail; mobile has one scrolling column, so they render as
 * plain blocks in that column instead. No border — a hairline outline read as fussy at this
 * size. Instead: a faint secondary tint for the fill, and `boxShadow` (Fabric's cross-platform
 * CSS shadow, so this actually renders on Android too, unlike `shadow*`+`elevation`) tinted
 * the same secondary green instead of black, for a soft lift rather than a hard drop shadow.
 */
export function RailCard({ title, children, style }: RailCardProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <View
      className="rounded-2xl p-4"
      style={[
        {
          backgroundColor: `${colors.secondary}${isDark ? '14' : '0A'}`,
          boxShadow: `0px 2px 12px ${colors.secondary}${isDark ? '1F' : '17'}`,
        },
        style,
      ]}>
      <Text
        size="xs"
        fontFamily="mono-medium"
        className="text-grey mb-2 uppercase"
        style={{ letterSpacing: 1 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
