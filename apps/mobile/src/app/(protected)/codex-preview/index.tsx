import { CodexPreviewScreen } from '@components/screens/codex/preview';
import { Redirect } from 'expo-router';

/** Dev-only mock surface — never reachable in a release build. */
export default function CodexPreviewRoute() {
  if (!__DEV__) return <Redirect href="/codex" />;
  return <CodexPreviewScreen />;
}
