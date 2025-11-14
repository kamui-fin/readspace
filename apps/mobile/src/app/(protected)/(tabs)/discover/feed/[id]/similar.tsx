import { useLocalSearchParams } from 'expo-router';
import { SimilarFeedsScreen } from '@/components/screens/discover/routes/similar-feeds';

export default function SimilarFeedsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <SimilarFeedsScreen feedId={id} />;
}
