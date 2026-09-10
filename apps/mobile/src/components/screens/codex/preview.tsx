import { Header } from '@components/navigation/header';
import { Tab } from '@components/navigation/tab';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  SAMPLE_CODEX_DIGEST,
  SAMPLE_CODEX_DIGEST_IN_PROGRESS,
  SAMPLE_CODEX_DIGEST_QUIET,
  SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED,
  SAMPLE_CODEX_NOT_ENTITLED_QUOTA,
} from '@readspace/shared';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
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
  | 'paywall-ai-off';

const OPTIONS: { key: PreviewKey; label: string }[] = [
  { key: 'busy', label: 'Busy' },
  { key: 'quiet', label: 'Quiet day' },
  { key: 'generating', label: 'Generating' },
  { key: 'empty', label: 'Empty' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'failed', label: 'Failed' },
  { key: 'paywall-quota', label: 'Paywall · quota' },
  { key: 'paywall-ai-off', label: 'Paywall · AI off' },
];

/**
 * Static preview of every Daily Digest state — no network. Build UI against this before wiring the
 * live screen.
 */
export function CodexPreviewScreen() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const [key, setKey] = useState<PreviewKey>('busy');

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header variant="static" title="Daily Digest preview" subtitle="Mock states, no network" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
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
      return <CodexNotEntitledState reason={SAMPLE_CODEX_NOT_ENTITLED_QUOTA.reason} />;
    case 'paywall-ai-off':
      return <CodexNotEntitledState reason={SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED.reason} />;
    default:
      return null;
  }
}
