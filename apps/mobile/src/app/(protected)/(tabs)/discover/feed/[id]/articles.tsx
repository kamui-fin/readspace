import { useLocalSearchParams } from 'expo-router';
import { FeedArticlesScreen } from '@/components/screens/discover/routes/feed-articles';

export default function FeedArticlesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <FeedArticlesScreen feedId={id} />;
}
