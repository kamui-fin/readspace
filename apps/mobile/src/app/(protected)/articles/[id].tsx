import { useLocalSearchParams } from 'expo-router';

import { ArticleScreen } from '@/components/screens/article-reader/view';

export default function ArticleRoute() {
  const { id, isSubscribed: isSubscribedParam } = useLocalSearchParams<{
    id: string;
    isSubscribed?: string;
  }>();

  // Parse subscription status from URL param (default to true if not provided)
  const isSubscribed = isSubscribedParam !== 'false';

  return <ArticleScreen articleId={id || ''} isSubscribed={isSubscribed} />;
}
