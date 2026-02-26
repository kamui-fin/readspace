import { FeedPreviewScreen } from '@components/screens/discover/routes/feed-preview';
import { useLocalSearchParams } from 'expo-router';

export default function FeedPreviewRoute() {
  const { id, title, description, image_url } = useLocalSearchParams<{
    id: string;
    title?: string;
    description?: string;
    image_url?: string;
  }>();

  if (!id) {
    return null;
  }

  return (
    <FeedPreviewScreen
      feedId={id}
      initialData={{
        title,
        description,
        image_url,
      }}
    />
  );
}
