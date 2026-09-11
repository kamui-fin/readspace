import { BottomSheet } from '@components/ui/bottom-sheet';
import { Card } from '@components/ui/card/index';
import { Text } from '@components/ui/text';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useFavicon } from '@hooks/useFavicon';
import { type ArticleSummary, type CodexDevelopment, formatRelativeDate } from '@readspace/shared';
import { useRouter } from 'expo-router';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

export interface CodexWriteupsSheetHandle {
  open: (development: CodexDevelopment) => void;
  close: () => void;
}

/** One write-up, laid out exactly like a Following list row. */
function WriteupRow({
  article,
  showTopDivider,
  onPress,
}: {
  article: ArticleSummary;
  showTopDivider: boolean;
  onPress: () => void;
}) {
  const { iconUrl, fallbackComponent } = useFavicon({
    url: article.link || '',
    feedTitle: article.feed_title || undefined,
    feedImage: article.feed_icon || undefined,
    isClipped: false,
  });

  return (
    <Card
      variant="article"
      title={article.title || article.link}
      description={article.description || undefined}
      imageUrl={article.image_url || undefined}
      timestamp={
        article.published_at ? formatRelativeDate(new Date(article.published_at)) : undefined
      }
      feedName={article.feed_title || article.source_domain || undefined}
      faviconUrl={iconUrl}
      fallbackComponent={fallbackComponent}
      showTopDivider={showTopDivider}
      showBottomDivider={false}
      onPress={onPress}
    />
  );
}

/**
 * The full write-up list for one development, in a bottom sheet — strongest first, each row
 * the same flat article layout the Following feed uses.
 */
export const CodexWriteupsSheet = forwardRef<CodexWriteupsSheetHandle, object>((_props, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const router = useRouter();
  const [development, setDevelopment] = useState<CodexDevelopment | null>(null);

  useImperativeHandle(ref, () => ({
    open: (dev) => {
      setDevelopment(dev);
      modalRef.current?.present();
    },
    close: () => modalRef.current?.dismiss(),
  }));

  const articles = development?.articles ?? [];
  const total = development ? development.article_count || articles.length : 0;

  return (
    <BottomSheet ref={modalRef} snapPoints={['70%', '92%']} contentPaddingHorizontal={20}>
      {development ? (
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text
            fontFamily="garamond-semibold"
            className="text-primary-foreground"
            style={{ fontSize: 21, lineHeight: 27, marginTop: 2, marginBottom: 4 }}>
            {development.title}
          </Text>
          <Text size="sm" className="text-grey" style={{ marginBottom: 6 }}>
            {development.source_count} {development.source_count === 1 ? 'source' : 'sources'} ·{' '}
            {total} {total === 1 ? 'article' : 'articles'} · strongest first
          </Text>
          <View>
            {articles.map((article, i) => (
              <WriteupRow
                key={article.id}
                article={article}
                showTopDivider={i > 0}
                onPress={() => {
                  modalRef.current?.dismiss();
                  router.push(`/(protected)/articles/${article.id}`);
                }}
              />
            ))}
          </View>
        </BottomSheetScrollView>
      ) : null}
    </BottomSheet>
  );
});

CodexWriteupsSheet.displayName = 'CodexWriteupsSheet';
