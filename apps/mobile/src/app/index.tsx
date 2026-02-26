import { useSession } from '@contexts/auth-context';
import { Redirect } from 'expo-router';

export default function Index() {
  const { session, isLoading } = useSession();

  console.log('[Index Route] Rendering. isLoading:', isLoading, 'hasSession:', !!session);

  // While auth is loading, show nothing (splash screen remains visible)
  // This prevents flashing the wrong screen before auth state is determined
  if (isLoading) {
    return null;
  }

  // Once auth state is loaded, redirect directly to the appropriate route
  // Note: We redirect to the tab route directly, not to intermediate index routes
  // to avoid multiple redirects
  if (session) {
    console.log('[Index Route] Redirecting to (protected)/(tabs)');
    return <Redirect href="/(protected)/(tabs)" />;
  }

  console.log('[Index Route] Redirecting to (auth)');
  return <Redirect href="/(auth)" />;
}
