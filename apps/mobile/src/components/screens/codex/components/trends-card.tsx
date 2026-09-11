import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Linking, ScrollView, View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RailCard } from './codex-rail-card';

interface TrendsCardProps {
  themes: string[];
}

function TrendPill({ tag }: { tag: string }) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <PressableScale
      onPress={() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(tag)}`)}>
      <View
        className="rounded-full px-3 py-1.5"
        style={{ borderWidth: 1, borderColor: `${colors.secondary}4D` }}>
        <Text size="sm" className="text-secondary">
          {tag}
        </Text>
      </View>
    </PressableScale>
  );
}

/**
 * The day's recurring keywords as tappable pills. Each one opens a web search for the phrase —
 * deliberately the one place the digest points off-platform, so it stays a small, quiet
 * affordance rather than in-app search. Skipped entirely when Phase 1 found no recurring theme.
 * Outline only, no fill — green text and a thin green border read as an accent; a solid green
 * fill on every tag reads as loud when there can be several in a row.
 *
 * Two explicit rows in a horizontal ScrollView, same shape as the Discover categories list —
 * not a `flex-wrap` grid: on-device a plain `flex-row flex-wrap` here refused to actually
 * wrap (every pill landed on its own line despite plenty of spare width), and the column-wrap
 * fallback stretched short tags to match the widest one in their column, plus left uneven gaps
 * between rows of differing pill heights. Pre-splitting into two fixed rows sidesteps all of it
 * and gives exact, uniform gap-2 control, identical to how Discover already does this.
 */
export function TrendsCard({ themes }: TrendsCardProps) {
  const tags = themes.filter((t) => t.trim());
  if (tags.length === 0) return null;

  const half = Math.ceil(tags.length / 2);
  const row1 = tags.slice(0, half);
  const row2 = tags.slice(half);

  return (
    <RailCard title="Trends">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ gap: 8 }}>
          <View className="flex-row" style={{ gap: 8 }}>
            {row1.map((tag) => (
              <TrendPill key={tag} tag={tag} />
            ))}
          </View>
          {row2.length > 0 && (
            <View className="flex-row" style={{ gap: 8 }}>
              {row2.map((tag) => (
                <TrendPill key={tag} tag={tag} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </RailCard>
  );
}
