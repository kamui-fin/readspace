import { SimilarFeedsScreen } from '@components/screens/discover/routes/similar-feeds';
import { useLocalSearchParams } from 'expo-router';

export default function SimilarFeedsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <SimilarFeedsScreen feedId={id} />;
}
