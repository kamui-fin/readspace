import { Header } from '@components/navigation/header';
import { Spinner } from '@components/ui/spinner';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useLimitChecker } from '@hooks/useLimitChecker';
import { COLORS } from '@lib/constants/colors';
import {
  type CodexDigestResponse,
  CodexDigestStatus,
  isCodexNotEntitled,
  useCodexToday,
  useGenerateCodexDigest,
} from '@readspace/shared';
import { useCallback } from 'react';
import { View } from 'react-native';
import { CodexGenerating } from './components/codex-generating';
import {
  CodexEmptyState,
  CodexFailedState,
  CodexNotEntitledState,
  CodexQuietDayState,
} from './components/codex-states';
import { CodexView } from './components/codex-view';

/**
 * Live Daily Digest screen. Fetches the latest digest, polls while it generates (the shared hook
 * stops on a terminal status), and renders per state. Basic users hitting their monthly
 * allowance get the upgrade dialog before a request is even sent.
 */
export function CodexScreen() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { data: digest, isLoading, error } = useCodexToday();
  const generate = useGenerateCodexDigest();
  const { checkAndTriggerUpgrade } = useLimitChecker();

  const handleGenerate = useCallback(() => {
    // Local gate — shows the Pro upsell instead of a wasted request for out-of-quota Basic.
    if (!checkAndTriggerUpgrade('codex')) return;

    generate.mutate(undefined, {
      onSuccess: (result) => {
        if (isCodexNotEntitled(result)) {
          toast.error(result.reason);
        }
      },
      onError: () => {
        toast.error("Couldn't start your Daily Digest. Please try again.");
      },
    });
  }, [checkAndTriggerUpgrade, generate]);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header variant="static" title="Daily Digest" subtitle="What you missed today" />
      <Body
        isLoading={isLoading}
        hasError={!!error}
        digest={digest ?? null}
        isGenerating={generate.isPending}
        onGenerate={handleGenerate}
      />
    </View>
  );
}

interface BodyProps {
  isLoading: boolean;
  hasError: boolean;
  digest: CodexDigestResponse | null;
  isGenerating: boolean;
  onGenerate: () => void;
}

function Body({ isLoading, hasError, digest, isGenerating, onGenerate }: BodyProps) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner size="medium" />
      </View>
    );
  }

  if (hasError) {
    return <CodexFailedState onGenerate={onGenerate} isGenerating={isGenerating} />;
  }

  if (!digest) {
    return <CodexEmptyState onGenerate={onGenerate} isGenerating={isGenerating} />;
  }

  switch (digest.status) {
    case CodexDigestStatus.PENDING:
    case CodexDigestStatus.IN_PROGRESS:
      return <CodexGenerating phase={digest.progress_phase} />;
    case CodexDigestStatus.SKIPPED:
      return <CodexQuietDayState onGenerate={onGenerate} isGenerating={isGenerating} />;
    case CodexDigestStatus.FAILED:
      return <CodexFailedState onGenerate={onGenerate} isGenerating={isGenerating} />;
    case CodexDigestStatus.COMPLETED:
      return digest.payload ? (
        <CodexView digest={digest} />
      ) : (
        <CodexQuietDayState onGenerate={onGenerate} isGenerating={isGenerating} />
      );
    default:
      return <CodexNotEntitledState reason="This digest is in an unexpected state." />;
  }
}
