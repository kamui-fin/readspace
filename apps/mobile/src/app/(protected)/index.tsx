import { Redirect } from 'expo-router';

export default function ProtectedIndex() {
  return <Redirect href="/(protected)/(tabs)" />;
}
