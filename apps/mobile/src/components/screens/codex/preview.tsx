import { Tab } from '@components/navigation/tab';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  SAMPLE_CODEX_DIGEST,
  SAMPLE_CODEX_DIGEST_IN_PROGRESS,
  SAMPLE_CODEX_DIGEST_QUIET,
  SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED,
  SAMPLE_CODEX_NOT_ENTITLED_PRO_RATE_LIMITED,
  SAMPLE_CODEX_NOT_ENTITLED_QUOTA,
} from '@readspace/shared';
import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CodexGenerating } from './components/codex-generating';
import {
  CodexEmptyState,
  CodexFailedState,
  CodexNotEntitledState,
  CodexQuietDayState,
} from './components/codex-states';
import { CodexView } from './components/codex-view';

type PreviewKey =
  | 'busy'
  | 'quiet'
  | 'generating'
  | 'empty'
  | 'skipped'
  | 'failed'
  | 'paywall-quota'
  | 'paywall-pro-rate-limited'
  | 'paywall-ai-off';

const OPTIONS: { key: PreviewKey; label: string }[] = [
  { key: 'busy', label: 'Busy' },
  { key: 'quiet', label: 'Quiet day' },
  { key: 'generating', label: 'Generating' },
  { key: 'empty', label: 'Empty' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'failed', label: 'Failed' },
  { key: 'paywall-quota', label: 'Paywall · quota' },
  { key: 'paywall-pro-rate-limited', label: 'Paywall · Pro rate limited' },
  { key: 'paywall-ai-off', label: 'Paywall · AI off' },
];

/**
 * Static preview of every Daily Digest state — no network. Build UI against this before wiring the
 * live screen.
 */
export function CodexPreviewScreen() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const safeAreaTop = insets.top > 0 ? insets.top : Constants.statusBarHeight;
  const [key, setKey] = useState<PreviewKey>('busy');

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Just the state switcher — no Header. Production shows no header bar once a digest
          renders, so this dev tool shouldn't fake one either; the switcher clears the status
          bar/notch itself instead of borrowing that from a Header. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: safeAreaTop + 8,
          paddingBottom: 8,
          gap: 6,
        }}
        style={{ flexGrow: 0, backgroundColor: colors.card }}>
        {OPTIONS.map((o) => (
          <Tab key={o.key} label={o.label} active={key === o.key} onPress={() => setKey(o.key)} />
        ))}
      </ScrollView>
      <View className="flex-1">
        <Preview variant={key} />
      </View>
    </View>
  );
}

function Preview({ variant }: { variant: PreviewKey }) {
  switch (variant) {
    case 'busy':
      return <CodexView digest={SAMPLE_CODEX_DIGEST} />;
    case 'quiet':
      return <CodexView digest={SAMPLE_CODEX_DIGEST_QUIET} />;
    case 'generating':
      return <CodexGenerating phase={SAMPLE_CODEX_DIGEST_IN_PROGRESS.progress_phase} />;
    case 'empty':
      return <CodexEmptyState />;
    case 'skipped':
      return <CodexQuietDayState />;
    case 'failed':
      return <CodexFailedState />;
    case 'paywall-quota':
      return (
        <CodexNotEntitledState
          reason={SAMPLE_CODEX_NOT_ENTITLED_QUOTA.reason}
          errorCode={SAMPLE_CODEX_NOT_ENTITLED_QUOTA.error_code}
        />
      );
    case 'paywall-pro-rate-limited':
      return (
        <CodexNotEntitledState
          reason={SAMPLE_CODEX_NOT_ENTITLED_PRO_RATE_LIMITED.reason}
          errorCode={SAMPLE_CODEX_NOT_ENTITLED_PRO_RATE_LIMITED.error_code}
        />
      );
    case 'paywall-ai-off':
      return (
        <CodexNotEntitledState
          reason={SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED.reason}
          errorCode={SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED.error_code}
        />
      );
    default:
      return null;
  }
}
