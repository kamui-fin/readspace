import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { View } from 'react-native';

/**
 * Readspace-branded color palette for feed fallback icons.
 * Each entry is a [lightBg, darkBg, lightText, darkText] tuple.
 * Colors are carefully chosen to feel cohesive with the app's green/earthy palette.
 */
const FALLBACK_PALETTES: [string, string, string, string][] = [
  // [light bg, dark bg, light text, dark text]
  ['#DCF0DC', '#1E3A1E', '#2F6B2F', '#6EBF6E'], // Readspace primary green family
  ['#D4E8D4', '#1A3520', '#386641', '#7EC87E'], // Secondary green
  ['#E8F0D4', '#252E1A', '#4A6020', '#96B84A'], // Olive green
  ['#D4E8F0', '#1A2A35', '#205470', '#5AACCC'], // Teal-blue
  ['#E8E0D4', '#2E2A1A', '#6B5A30', '#C8A862'], // Warm amber
  ['#F0E0D4', '#35221A', '#7A3E24', '#D4845A'], // Terracotta
  ['#E0D4F0', '#22183A', '#4A286E', '#9A72CC'], // Muted purple
  ['#F0D4E4', '#35182A', '#6E2848', '#CC6E96'], // Dusty rose
  ['#D4F0E8', '#1A352E', '#206B56', '#5ECCAA'], // Mint green
  ['#F0ECD4', '#35301A', '#6B6020', '#CCBA52'], // Mustard
  ['#D4DCF0', '#1A2035', '#283A70', '#7088CC'], // Periwinkle
  ['#F0D4D4', '#351A1A', '#6E2828', '#CC6E6E'], // Muted red
];

/**
 * Deterministically pick a palette index from a feed name string.
 */
function stringToPaletteIndex(str: string): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % FALLBACK_PALETTES.length;
}

/**
 * Extract up to 2 initials from a feed name.
 * e.g. "The Verge" → "TV", "Hacker News" → "HN", "arxiv" → "AR"
 */
function getInitials(name: string): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    // Single word → up to 2 uppercase chars
    return words[0].slice(0, 2).toUpperCase();
  }
  // Multiple words → first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

export interface FeedFallbackIconProps {
  /** Feed name — drives both initials and color palette selection */
  feedName?: string | null;
  /** Icon size in pixels */
  size?: number;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Optional className for the outer View */
  className?: string;
}

/**
 * FeedFallbackIcon — a beautiful, Readspace-branded fallback icon for feeds
 * that don't have a favicon/image. Renders 1–2 initials on a deterministic
 * pastel background drawn from Readspace's earthy/green color family.
 *
 * - Adapts to light/dark mode automatically
 * - Scales correctly with the `size` prop (used in article cards, feed switcher, discover, etc.)
 * - Consistent: same feed name always renders the same color
 */
export function FeedFallbackIcon({
  feedName,
  size = 16,
  borderRadius = 4,
  className,
}: FeedFallbackIconProps) {
  const isDark = useIsDarkMode();

  const name = feedName?.trim() || '';
  const initials = getInitials(name || 'Feed');
  const paletteIdx = stringToPaletteIndex(name);
  const [lightBg, darkBg, lightText, darkText] = FALLBACK_PALETTES[paletteIdx];

  const bgColor = isDark ? darkBg : lightBg;
  const textColor = isDark ? darkText : lightText;

  // Font size scales with container: 40–45% of size, clamped for readability
  const fontSize = Math.max(8, Math.round(size * 0.4));

  return (
    <View
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        fontFamily="geist-semibold"
        style={{
          fontSize,
          lineHeight: fontSize * 1.2,
          color: textColor,
          letterSpacing: initials.length > 1 ? -0.5 : 0,
          includeFontPadding: false,
        }}
        numberOfLines={1}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * Create a React FC wrapper around FeedFallbackIcon that pre-binds the feedName.
 * Use this anywhere a `fallbackComponent` prop is expected.
 */
export function createFeedFallback(feedName?: string | null) {
  const Fallback = ({ size = 16, className }: { size?: number; className?: string }) => (
    <FeedFallbackIcon feedName={feedName} size={size} borderRadius={4} className={className} />
  );
  Fallback.displayName = 'FeedFallback';
  return Fallback;
}
