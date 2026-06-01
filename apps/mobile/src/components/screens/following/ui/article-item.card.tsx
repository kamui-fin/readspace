import { Card, type CardProps } from '@components/ui/card/index';
import { Divider } from '@components/ui/divider';
import type { Article } from '@readspace/shared';
import { useArticleActionsStore } from '@stores/article-actions';
import { forwardRef, useEffect } from 'react';
import { Pressable, View } from 'react-native';

export interface SwipeAction {
  id: string;
  icon: React.ComponentType<{
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  color: string;
  onPress: () => void;
}

export interface ArticleItemProps extends Omit<CardProps, 'variant'> {
  article?: Article;
  fallbackComponent?: React.FC<{ size?: number; className?: string }>;
  leftActions?: SwipeAction[]; // Actions revealed when swiping right
  rightActions?: SwipeAction[]; // Actions revealed when swiping left
  // Legacy props for backward compatibility
  onMarkAsRead?: (article: Article) => void;
  onMarkAsUnread?: (article: Article) => void;
  onSaveArticle?: (article: Article) => void;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
}

/**
 * ArticleItemCard wraps Card for list display.
 * Swipe gestures are removed for now.
 */
export const ArticleItemCard = forwardRef<React.ComponentRef<typeof Pressable>, ArticleItemProps>(
  (
    {
      article,
      leftActions: leftActionsProp,
      rightActions: rightActionsProp,
      onMarkAsRead,
      onMarkAsUnread,
      onSaveArticle,
      showTopDivider = false,
      showBottomDivider = true,
      className,
      fallbackComponent,
      ...cardProps
    },
    ref
  ) => {
    // Get store actions for registering callbacks
    const registerCallbacks = useArticleActionsStore((state) => state.registerCallbacks);
    const unregisterCallbacks = useArticleActionsStore((state) => state.unregisterCallbacks);

    // Register callbacks in store when article changes
    useEffect(() => {
      if (!article?.id) return;

      const articleId = article.id;
      const articleRef = article; // Capture article reference

      registerCallbacks(articleId, {
        onMarkAsRead: onMarkAsRead
          ? () => {
              onMarkAsRead(articleRef);
            }
          : undefined,
        onMarkAsUnread: onMarkAsUnread
          ? () => {
              onMarkAsUnread(articleRef);
            }
          : undefined,
        onSaveArticle: onSaveArticle
          ? () => {
              onSaveArticle(articleRef);
            }
          : undefined,
      });

      return () => {
        unregisterCallbacks(articleId);
      };
    }, [
      article,
      onMarkAsRead,
      onMarkAsUnread,
      onSaveArticle,
      registerCallbacks,
      unregisterCallbacks,
    ]);

    return (
      <View className="relative overflow-hidden">
        {/* Top divider */}
        {showTopDivider && <Divider />}

        {/* Main card */}
        <Card
          ref={ref}
          variant="article"
          {...cardProps}
          className={className}
          fallbackComponent={fallbackComponent}
        />

        {/* Bottom divider */}
        {showBottomDivider && <Divider />}
      </View>
    );
  }
);

ArticleItemCard.displayName = 'ArticleItemCard';
