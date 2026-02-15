import { FeedPreviewScreen } from '@components/screens/discover/routes/feed-preview';
import { useLocalSearchParams } from 'expo-router';

export default function FeedPreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <FeedPreviewScreen feedId={id} />;
}
