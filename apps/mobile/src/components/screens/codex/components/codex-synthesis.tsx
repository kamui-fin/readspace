import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface CodexSynthesisProps {
  /** Markdown from the pipeline: a tight `- ` bullet list, each with at most one `**bold**` anchor. */
  content: string;
  /** The lead card sets its synthesis a step larger. */
  featured?: boolean;
}

/**
 * The synthesised through-line, set in the reading serif (EB Garamond) to match the article
 * reader — this is the one part of a Development a person actually *reads*. Bold source anchors
 * pick up the secondary green, mirroring the shared markdown renderer on web.
 */
export function CodexSynthesis({ content, featured = false }: CodexSynthesisProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const size = featured ? 18 : 17;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          fontFamily: 'EBGaramond_400Regular',
          fontSize: size,
          lineHeight: Math.round(size * 1.6),
          color: colors.primary_foreground,
        },
        bullet_list: { marginTop: 2, marginBottom: 2 },
        ordered_list: { marginTop: 2, marginBottom: 2 },
        list_item: { marginTop: 3, marginBottom: 3 },
        paragraph: { marginTop: 0, marginBottom: 0 },
        strong: {
          fontFamily: 'EBGaramond_600SemiBold',
          fontWeight: 'normal',
          color: colors.secondary,
        },
        // No italics anywhere in the digest — emphasis renders upright, a touch heavier.
        em: { fontFamily: 'EBGaramond_500Medium', fontStyle: 'normal' },
      }),
    [colors, size]
  );

  if (!content?.trim()) return null;

  return <Markdown style={styles}>{content}</Markdown>;
}
