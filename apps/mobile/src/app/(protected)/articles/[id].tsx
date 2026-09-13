import { ArticleScreen } from '@components/screens/article-reader/view';
import { READ_LATER_READER_MODE } from '@lib/constants/app';
import { useLocalSearchParams } from 'expo-router';

export default function ArticleRoute() {
  const {
    id,
    isSubscribed: isSubscribedParam,
    type,
    mode,
  } = useLocalSearchParams<{
    id: string;
    isSubscribed?: string;
    // 'feed' | 'clipped' — clipped articles live in user_entries and need ?clipped=true to fetch
    type?: string;
    mode?: string;
  }>();

  // Parse subscription status from URL param (default to true if not provided)
  const isSubscribed = isSubscribedParam !== 'false';

  return (
    <ArticleScreen
      articleId={id || ''}
      articleType={type}
      isSubscribed={isSubscribed}
      isReadLaterMode={mode === READ_LATER_READER_MODE}
    />
  );
}
