import { Redirect } from 'expo-router';
import { useSession } from '@contexts/auth-context';

export default function Index() {
  const { session, isLoading } = useSession();

  // Show nothing while checking auth state
  if (isLoading) {
    return null;
  }

  // Redirect based on authentication state
  if (session) {
    return <Redirect href="/(protected)" />;
  }

  return <Redirect href="/(auth)" />;
}
