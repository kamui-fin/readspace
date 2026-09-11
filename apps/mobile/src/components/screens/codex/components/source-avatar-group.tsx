import { FeedIcon } from '@components/ui/feed-icon';
import { Text } from '@components/ui/text';
import { useFavicon } from '@hooks/useFavicon';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { ArticleSummary } from '@readspace/shared';
import { View } from 'react-native';

interface Source {
  title: string | null;
  icon: string | null;
  link: string;
}

interface SourceAvatarGroupProps {
  /** Articles to pull feed icons from — de-duplicated by feed. */
  articles: ArticleSummary[];
  /** Trailing label, e.g. "8 sources". */
  label?: string;
  /** Visible avatars before a "+N" chip. */
  max?: number;
}

/** One favicon, resolved through the same fallback chain the article rows use. */
function SourceAvatar({ source, ring }: { source: Source; ring: string }) {
  const { iconUrl, fallbackComponent } = useFavicon({
    url: source.link || '',
    feedTitle: source.title || undefined,
    feedImage: source.icon || undefined,
    isClipped: false,
  });
  return (
    <View style={{ borderRadius: 999, borderWidth: 2, borderColor: ring }}>
      <FeedIcon
        url={iconUrl}
        fallbackComponent={fallbackComponent}
        feedName={source.title || undefined}
        size={20}
        borderRadius={10}
      />
    </View>
  );
}

/**
 * An overlapping row of feed icons — the "who covered this" glance. De-dupes by feed so two
 * articles from one source count once, and collapses the overflow into a "+N" chip.
 */
export function SourceAvatarGroup({ articles, label, max = 4 }: SourceAvatarGroupProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const a of articles) {
    const key = (a.feed_title || a.source_domain || a.link || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sources.push({ title: a.feed_title ?? null, icon: a.feed_icon ?? null, link: a.link || '' });
  }
  if (sources.length === 0) return null;

  const visible = sources.slice(0, max);
  const hidden = sources.length - visible.length;
  // The block is flat on the page now, so the overlap gap reads against the page ground.
  const ring = colors.background;

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-row items-center">
        {visible.map((s, i) => (
          <View key={`${s.title ?? 'src'}-${i}`} style={{ marginLeft: i === 0 ? 0 : -6 }}>
            <SourceAvatar source={s} ring={ring} />
          </View>
        ))}
        {hidden > 0 ? (
          <View
            className="items-center justify-center"
            style={{
              marginLeft: -6,
              height: 20,
              minWidth: 20,
              paddingHorizontal: 4,
              borderRadius: 999,
              backgroundColor: colors.grey5,
            }}>
            <Text
              fontFamily="geist-semibold"
              className="text-grey"
              style={{
                fontSize: 11,
                lineHeight: 12,
                textAlign: 'center',
                textAlignVertical: 'center',
                includeFontPadding: false,
              }}>
              +{hidden}
            </Text>
          </View>
        ) : null}
      </View>
      {label ? (
        <Text size="sm" className="text-grey">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
