import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { CodexDevelopment } from '@readspace/shared';
import { AltArrowRightIcon } from '@solar-icons/react-native/linear';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CodexSynthesis } from './codex-synthesis';
import { SourceAvatarGroup } from './source-avatar-group';

interface DevelopmentCardProps {
  development: CodexDevelopment;
  /** The lead development renders larger. */
  featured?: boolean;
  /** Opens the write-ups bottom sheet for this development. */
  onOpen: () => void;
}

/**
 * A synthesised development as a flat block in the digest feed — no box, no outline: a
 * rounded hero, a large serif headline, the serif synthesis, and a quiet source row. The
 * whole block is the tap target; it opens the write-ups in a bottom sheet.
 */
export function DevelopmentCard({ development, featured = false, onOpen }: DevelopmentCardProps) {
  const [heroBroken, setHeroBroken] = useState(false);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const articleCount = development.article_count || development.articles.length;
  const heroUrl = development.hero_image_url && !heroBroken ? development.hero_image_url : null;
  const hasWriteups = development.articles.length > 0;

  return (
    <PressableScale onPress={hasWriteups ? onOpen : undefined}>
      {heroUrl ? (
        <ExpoImage
          source={{ uri: heroUrl }}
          onError={() => setHeroBroken(true)}
          contentFit="cover"
          transition={200}
          style={{
            width: '100%',
            aspectRatio: featured ? 3 / 2 : 16 / 9,
            borderRadius: 14,
            marginBottom: 14,
            backgroundColor: isDark ? colors.grey5 : colors.grey6,
          }}
        />
      ) : null}

      <Text
        fontFamily={featured ? 'garamond-bold' : 'garamond-semibold'}
        className="text-primary-foreground"
        style={{ fontSize: featured ? 26 : 22, lineHeight: featured ? 32 : 28 }}>
        {development.title}
      </Text>

      <View style={{ marginTop: 6 }}>
        <CodexSynthesis content={development.synthesis} featured={featured} />
      </View>

      <View
        style={{
          marginTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <SourceAvatarGroup
          articles={development.articles}
          label={`${development.source_count} ${
            development.source_count === 1 ? 'source' : 'sources'
          } · ${articleCount} ${articleCount === 1 ? 'article' : 'articles'}`}
        />
        {hasWriteups ? <AltArrowRightIcon size={18} color={colors.grey} /> : null}
      </View>
    </PressableScale>
  );
}
