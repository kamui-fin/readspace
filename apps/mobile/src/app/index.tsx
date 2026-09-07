import { useSession } from '@contexts/auth-context';
import { useSettingsStore } from '@stores/settings';
import { Redirect } from 'expo-router';

export default function Index() {
  const { session, isLoading, isOnboarded: serverIsOnboarded } = useSession();
  const instanceType = useSettingsStore((state) => state.settings.instance_type);
  // Onboarding is a cloud-only flow — self-hosted instances are always treated as
  // already onboarded.
  const isOnboarded = instanceType === 'cloud' ? serverIsOnboarded : true;

  console.log(
    '[Index Route] Rendering. isLoading:',
    isLoading,
    'hasSession:',
    !!session,
    'isOnboarded:',
    isOnboarded
  );

  // While auth is loading, show nothing (splash screen remains visible)
  // This prevents flashing the wrong screen before auth state is determined
  if (isLoading) {
    return null;
  }

  // Once auth state is loaded, redirect directly to the appropriate route
  // Note: We redirect directly to either onboarding or tab route to avoid multiple redirects
  if (session) {
    if (!isOnboarded) {
      console.log('[Index Route] Redirecting to (protected)/onboarding');
      return <Redirect href="/(protected)/onboarding" />;
    }
    console.log('[Index Route] Redirecting to (protected)/(tabs)');
    return <Redirect href="/(protected)/(tabs)" />;
  }

  console.log('[Index Route] Redirecting to (auth)');
  return <Redirect href="/(auth)" />;
}
