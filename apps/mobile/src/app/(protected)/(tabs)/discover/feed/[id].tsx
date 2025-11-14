import { useLocalSearchParams } from 'expo-router';
import { FeedPreviewScreen } from '@/components/screens/discover/routes/feed-preview';

export default function FeedPreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <FeedPreviewScreen feedId={id} />;
}
