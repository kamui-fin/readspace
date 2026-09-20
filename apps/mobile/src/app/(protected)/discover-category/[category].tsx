import { CategoryScreen } from '@components/screens/discover/routes/category';
import { useLocalSearchParams } from 'expo-router';

/**
 * Lives outside `(tabs)` on purpose: a category is a full-screen drill-down with its own
 * navigation bar and search field, and pushing it here means no tab bar competes for the
 * bottom edge or for the search controller's chrome.
 */
export default function DiscoverCategoryRoute() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return <CategoryScreen category={category} />;
}
