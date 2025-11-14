import { useCallback, useEffect } from 'react';
import { Share, Text, View, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useSharedValue } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

import { ArticleReader } from './index';
import { ArticleReaderSkeleton } from './ui/article-reader.skeleton';
import { ArticleActionBar } from './ui/article-actions.bar';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemTitle,
  DropdownMenuItemIcon,
  DropdownMenuSeparator,
} from '@components/ui/dropdown-menu';
import { Button } from '@components/ui/button';
import { Monicon } from '@monicon/native';
import { toast } from '@components/ui/toast';
import { useArticle, useUpdateArticle } from '@readspace/shared';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

interface ArticleScreenProps {
  articleId: string;
  isSubscribed?: boolean;
}

export function ArticleScreen({ articleId, isSubscribed = true }: ArticleScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const scrollDirection = useSharedValue<'up' | 'down'>('down');
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  // Fetch article data
  const { data: article, isLoading: isArticleLoading } = useArticle(articleId || '', {
    enabled: !!articleId,
  });

  // Check if this is a clipped article
  const isClipped = article?.article_type === 'clipped';

  const updateArticle = useUpdateArticle();

  // Mark as read on mount (only if subscribed to the feed)
  useEffect(() => {
    if (article && !article.is_read && isSubscribed) {
      updateArticle.mutate(
        {
          articleId: article.id,
          data: { is_read: true },
          articleType: article.article_type || 'feed',
        },
        {
          // Silently mark as read - optimistic update handles UI
          onError: () => {
            // Rollback already handled by the hook
          },
        }
      );
    }
  }, [article, isSubscribed, updateArticle]);

  // Refetch article list when navigating back to ensure updated state
  useFocusEffect(
    useCallback(() => {
      return () => {
        // When losing focus (navigating away), invalidate article lists
        queryClient.invalidateQueries({
          queryKey: ['rss-articles', 'infinite'],
        });
      };
    }, [queryClient])
  );

  // Handlers
  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleBookmark = useCallback(() => {
    if (!article) return;

    const newValue = !article.is_read_later;
    updateArticle.mutate(
      {
        articleId: article.id,
        data: { is_read_later: newValue },
        articleType: article.article_type || 'feed',
      },
      {
        onSuccess: () => {
          if (newValue) {
            toast.success('Article saved');
          } else {
            toast.success('Article removed from read later');
          }
        },
        onError: () => {
          toast.error(
            newValue ? 'Failed to save article' : 'Failed to remove article from read later'
          );
        },
      }
    );
  }, [article, updateArticle]);

  const handleMarkAsDone = useCallback(() => {
    if (!article) return;

    // Show immediate feedback
    toast.success('Marked as done');

    updateArticle.mutate(
      {
        articleId: article.id,
        data: { is_read_later: false },
        articleType: article.article_type || 'feed',
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: () => {
          toast.error('Failed to mark as done');
        },
      }
    );
  }, [article, updateArticle, router]);

  const handleShare = useCallback(async () => {
    if (!article) return;
    try {
      await Share.share({
        message: `${article.title}\n\n${article.link}`,
        url: article.link,
        title: article.title,
      });
    } catch {
      toast.error('Failed to share article');
    }
  }, [article]);

  const handleCopyLink = useCallback(async () => {
    if (!article) return;
    try {
      await Clipboard.setStringAsync(article.link);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  }, [article]);

  const handleOpenInBrowser = useCallback(async () => {
    if (!article) return;
    try {
      const supported = await Linking.canOpenURL(article.link);
      if (supported) {
        await Linking.openURL(article.link);
      } else {
        toast.error('Cannot open this URL');
      }
    } catch {
      toast.error('Failed to open in browser');
    }
  }, [article]);

  const handleMenuPress = useCallback(() => {
    // The dropdown menu will handle opening/closing
    // This is just a placeholder for the action bar
  }, []);

  if (isArticleLoading) {
    // Action bar offset matches the actual content offset
    // Action bar: safe area top + button height + small buffer = insets.top + 8
    const actionBarOffset = insets.top + 8;

    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <ArticleActionBar
          onClose={handleClose}
          onShare={handleShare}
          onBookmark={handleBookmark}
          onMenuPress={() => {}}
          isBookmarked={false}
          isClipped={false}
        />
        <View style={{ paddingTop: actionBarOffset }}>
          <ArticleReaderSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (!article) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <ArticleActionBar
          onClose={handleClose}
          onShare={handleShare}
          onBookmark={handleBookmark}
          onMenuPress={() => {}}
          isBookmarked={false}
          isClipped={false}
        />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-grey dark:text-grey-dark">
            Article not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <ArticleActionBar
        scrollY={scrollY}
        scrollDirection={scrollDirection}
        onClose={handleClose}
        onShare={handleShare}
        onBookmark={isClipped ? handleMarkAsDone : handleBookmark}
        onMenuPress={handleMenuPress}
        isBookmarked={article.is_read_later || false}
        isClipped={isClipped}
        menuTrigger={
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <Button variant="icon" size="small" fullWidth={false} className="h-11 w-11">
                <View style={{ transform: [{ rotate: '90deg' }] }}>
                  <Monicon
                    name="solar:menu-dots-bold"
                    size={18}
                    strokeWidth={2.4}
                    color={colors.grey}
                  />
                </View>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem key="copy-link" onSelect={handleCopyLink}>
                <DropdownMenuItemIcon ios={{ name: 'link' }} androidIconName="link" />
                <DropdownMenuItemTitle>Copy Link</DropdownMenuItemTitle>
              </DropdownMenuItem>
              <DropdownMenuItem key="open-browser" onSelect={handleOpenInBrowser}>
                <DropdownMenuItemIcon ios={{ name: 'safari' }} androidIconName="open_in_browser" />
                <DropdownMenuItemTitle>Open in Browser</DropdownMenuItemTitle>
              </DropdownMenuItem>
              {isClipped && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem key="mark-done" onSelect={handleMarkAsDone}>
                    <DropdownMenuItemIcon
                      ios={{ name: 'checkmark.circle.fill' }}
                      androidIconName="check_circle"
                    />
                    <DropdownMenuItemTitle>Mark as Done</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                </>
              )}
              {isSubscribed && !isClipped && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    key="summarize"
                    onSelect={() => {
                      toast.info('Summarize feature coming soon');
                    }}>
                    <DropdownMenuItemIcon
                      ios={{ name: 'note.text' }}
                      androidIconName="description"
                    />
                    <DropdownMenuItemTitle>Generate Summary</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    key="translate"
                    onSelect={() => {
                      toast.info('Translate feature coming soon');
                    }}>
                    <DropdownMenuItemIcon ios={{ name: 'globe' }} androidIconName="translate" />
                    <DropdownMenuItemTitle>Translate</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenuRoot>
        }
      />
      <ArticleReader
        article={article}
        scrollY={scrollY}
        lastScrollY={lastScrollY}
        scrollDirection={scrollDirection}
      />
    </SafeAreaView>
  );
}
