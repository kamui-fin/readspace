import { Text } from '@components/ui/text';
import type { CodexDigestStats } from '@readspace/shared';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { RailCard } from './codex-rail-card';

interface ReadingTimeStatProps {
  stats: CodexDigestStats | null;
  style?: StyleProp<ViewStyle>;
}

/** Same guard the card itself uses — exported so callers can decide layout (e.g. whether to
 *  give "This issue" the full row or split it two-up with this card) without duplicating it. */
export function hasReadingTimeStat(stats: CodexDigestStats | null): stats is CodexDigestStats {
  return !!stats && stats.minutes_condensed >= 1;
}

/**
 * The one number worth stating: how long the source write-ups Codex folded into Developments
 * would have taken to read, against the ~2 minutes the digest itself takes. Not a vanity
 * "hours saved" over the whole catalog — only what the synthesis genuinely replaces. Null on
 * a quiet day (nothing condensed) and on pre-stats digests, in which case the card is skipped.
 */
export function ReadingTimeStat({ stats, style }: ReadingTimeStatProps) {
  if (!hasReadingTimeStat(stats)) return null;

  const minutes = `~${stats.minutes_condensed}${stats.minutes_capped ? '+' : ''}`;
  const pieces = `${stats.articles_condensed} ${
    stats.articles_condensed === 1 ? 'write-up' : 'write-ups'
  }`;

  return (
    <RailCard title="Condensed" style={style}>
      <View className="flex-row items-baseline">
        <Text
          fontFamily="mono-semibold"
          className="text-secondary"
          style={{ fontSize: 28, lineHeight: 32 }}>
          {minutes}
        </Text>
        <Text size="sm" className="text-grey ml-1">
          min
        </Text>
      </View>
      <Text size="xs" className="text-grey mt-2" style={{ lineHeight: 18 }}>
        Reading time across {pieces}, folded into a ~2-minute digest.
      </Text>
    </RailCard>
  );
}
