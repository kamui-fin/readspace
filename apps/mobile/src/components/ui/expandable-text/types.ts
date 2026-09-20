import type { TextProps, TextSize } from '@components/ui/text';
import type { StyleProp, TextStyle } from 'react-native';

export interface ExpandableTextProps {
  text?: string | null;
  /** Lines shown before the fade. Below 2 there is nothing for a gradient to work with. */
  collapsedLines?: number;
  expandLabel?: string;
  collapseLabel?: string;
  /** Typography for the body, forwarded to `Text` — the measuring copy gets the same. */
  size?: TextSize;
  fontFamily?: TextProps['fontFamily'];
  className?: string;
  style?: StyleProp<TextStyle>;
  /** Typography for the More / Less toggle. Defaults to the foreground colour, one weight up. */
  actionClassName?: string;
  actionFontFamily?: TextProps['fontFamily'];
}
