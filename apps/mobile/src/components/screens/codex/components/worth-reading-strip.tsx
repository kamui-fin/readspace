import { Divider } from '@components/ui/divider';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { CodexWorthReadingItem } from '@readspace/shared';
import { View } from 'react-native';
import { CodexArticleRow } from './codex-article-row';

interface WorthReadingStripProps {
  items: CodexWorthReadingItem[];
}

/**
 * The bonus strip — standalone pieces that never clustered, each with one honest line on why
 * it stands alone.
 */
export function WorthReadingStrip({ items }: WorthReadingStripProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  if (items.length === 0) return null;

  return (
    <View>
      <Text
        size="xs"
        fontFamily="geist-semibold"
        className="text-grey mb-3 uppercase tracking-wide">
        Worth reading
      </Text>
      <View className="gap-3">
        {items.map(({ article, reason }) => (
          <View
            key={article.id}
            className="rounded-2xl"
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.grey5 }}>
            <CodexArticleRow article={article} />
            <Divider />
            <Text size="xs" fontFamily="geist-italic" className="text-grey px-3 py-2.5 leading-5">
              {reason}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
