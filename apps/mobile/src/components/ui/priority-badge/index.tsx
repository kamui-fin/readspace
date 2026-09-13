import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { ArticlePriority } from '@readspace/shared';
import { PaperclipIcon } from '@solar-icons/react-native/linear';
import { StyleSheet, View } from 'react-native';

type BadgeTone = 'low' | 'medium' | 'high' | 'clipped';

interface ToneColors {
  fg: string;
  bg: string;
  border: string;
}

// Mirrors the web clipped-article badge (Tailwind 700/100/300 light, 400/950/800 dark).
const TONE_COLORS: Record<BadgeTone, { light: ToneColors; dark: ToneColors }> = {
  high: {
    light: { fg: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' },
    dark: { fg: '#F87171', bg: '#450A0A', border: '#991B1B' },
  },
  medium: {
    light: { fg: '#C2410C', bg: '#FFEDD5', border: '#FDBA74' },
    dark: { fg: '#FB923C', bg: '#431407', border: '#9A3412' },
  },
  low: {
    light: { fg: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
    dark: { fg: '#4ADE80', bg: '#052E16', border: '#166534' },
  },
  clipped: {
    light: { fg: '#1D4ED8', bg: '#DBEAFE', border: '#93C5FD' },
    dark: { fg: '#60A5FA', bg: '#172554', border: '#1E40AF' },
  },
};

const TONE_LABELS: Record<BadgeTone, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  clipped: 'Clipped',
};

function toTone(priority?: string | null): BadgeTone {
  switch (priority?.toUpperCase()) {
    case ArticlePriority.HIGH:
      return 'high';
    case ArticlePriority.MEDIUM:
      return 'medium';
    case ArticlePriority.LOW:
      return 'low';
    default:
      return 'clipped';
  }
}

interface PriorityBadgeProps {
  priority?: string | null;
}

/**
 * Paperclip pill marking a clipped article, tinted by its priority.
 */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const isDark = useIsDarkMode();
  const tone = toTone(priority);
  const colors = TONE_COLORS[tone][isDark ? 'dark' : 'light'];

  return (
    <View
      className="flex-row items-center gap-0.5 rounded px-1"
      style={{
        height: 16,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      }}>
      <PaperclipIcon size={9} color={colors.fg} />
      {/* Explicit lineHeight keeps the font's ascender/descender from inflating the chip */}
      <Text
        size={9}
        fontFamily="mono-medium"
        style={{ color: colors.fg, lineHeight: 11, letterSpacing: 0.4 }}>
        {TONE_LABELS[tone].toUpperCase()}
      </Text>
    </View>
  );
}
