import { Divider } from '@components/ui/divider';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { CodexDevelopment } from '@readspace/shared';
import { AltArrowDownIcon } from '@solar-icons/react-native/bold';
import { useState } from 'react';
import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CodexArticleRow } from './codex-article-row';

interface DevelopmentCardProps {
  development: CodexDevelopment;
  /** Expanded on first render for the top development. */
  defaultExpanded?: boolean;
}

/**
 * A synthesised development: the through-line across sources, its provenance
 * (`12 articles · 8 sources`), and an expandable list of the best write-ups, strongest first.
 */
export function DevelopmentCard({ development, defaultExpanded = false }: DevelopmentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const articleCount = development.article_count || development.articles.length;

  return (
    <View
      className="rounded-2xl"
      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.grey5 }}>
      <View className="p-4">
        <Text size="md" fontFamily="geist-semibold" className="text-primary-foreground">
          {development.title}
        </Text>
        <Text size="sm" className="text-grey mt-2 leading-5">
          {development.synthesis}
        </Text>
        <View className="mt-3 flex-row items-center gap-1.5">
          <Text size="xs" fontFamily="geist-medium" className="text-grey">
            {articleCount} {articleCount === 1 ? 'article' : 'articles'}
          </Text>
          <Text size="xs" className="text-grey">
            ·
          </Text>
          <Text size="xs" fontFamily="geist-medium" className="text-grey">
            {development.source_count} {development.source_count === 1 ? 'source' : 'sources'}
          </Text>
        </View>
      </View>

      {development.articles.length > 0 && (
        <>
          <Divider />
          <PressableScale
            onPress={() => setExpanded((v) => !v)}
            className="flex-row items-center justify-between px-4 py-3">
            <Text size="xs" fontFamily="geist-medium" className="text-grey">
              {expanded ? 'Hide' : 'Show'} {development.articles.length}{' '}
              {development.articles.length === 1 ? 'write-up' : 'write-ups'}
            </Text>
            <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
              <AltArrowDownIcon size={16} color={colors.grey} />
            </View>
          </PressableScale>
          {expanded && (
            <View className="px-1 pb-2">
              {development.articles.map((article, i) => (
                <CodexArticleRow key={article.id} article={article} rank={i} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
