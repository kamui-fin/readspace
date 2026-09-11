import { Header } from '@components/navigation/header';
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
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { CodexGenerating } from './components/codex-generating';
import { CodexSkeleton } from './components/codex-skeleton';
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
 * allowance get the upgrade dialog before a request is even sent; a not-entitled 202 from the
 * server is held and rendered as its own full state.
 */
export function CodexScreen() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { data: digest, isLoading, error } = useCodexToday();
  const generate = useGenerateCodexDigest();
  const { checkAndTriggerUpgrade } = useLimitChecker();
  const [notEntitled, setNotEntitled] = useState<{ reason: string; errorCode: string } | null>(
    null
  );

  const handleGenerate = useCallback(() => {
    // Local gate — shows the Pro upsell instead of a wasted request for out-of-quota Basic.
    if (!checkAndTriggerUpgrade('codex')) return;

    generate.mutate(undefined, {
      onSuccess: (result) => {
        if (isCodexNotEntitled(result)) {
          setNotEntitled({ reason: result.reason, errorCode: result.error_code });
        }
      },
      onError: () => {
        toast.error("Couldn't start your Daily Digest. Please try again.");
      },
    });
  }, [checkAndTriggerUpgrade, generate]);

  // Once the digest is done, CodexView carries its own "Daily Digest · date" masthead
  // (mirroring the web layout) — the generic top header would just repeat that name. The
  // loading skeleton mocks up that same masthead shape (a completed digest is the common
  // case), so it's hidden then too, rather than doubling up on "Daily Digest".
  const showHeader =
    !isLoading &&
    !(digest?.status === CodexDigestStatus.COMPLETED && !!digest.payload && !notEntitled);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {showHeader && (
        <Header variant="static" title="Daily Digest" subtitle="What you missed today" />
      )}
      <Body
        isLoading={isLoading}
        hasError={!!error}
        digest={digest ?? null}
        notEntitled={notEntitled}
        isGenerating={generate.isPending}
        onGenerate={handleGenerate}
        onRegenerate={handleGenerate}
      />
    </View>
  );
}

interface BodyProps {
  isLoading: boolean;
  hasError: boolean;
  digest: CodexDigestResponse | null;
  notEntitled: { reason: string; errorCode: string } | null;
  isGenerating: boolean;
  onGenerate: () => void;
  /** Re-run generation from a COMPLETED digest — same mutation as onGenerate, just surfaced
   *  as a regenerate affordance inside CodexView instead of an empty/failed-state action. */
  onRegenerate: () => void;
}

function Body({
  isLoading,
  hasError,
  digest,
  notEntitled,
  isGenerating,
  onGenerate,
  onRegenerate,
}: BodyProps) {
  if (isLoading) {
    return <CodexSkeleton />;
  }

  // A generate/regenerate request is in flight and there's no already-completed digest to keep
  // showing (that case gets its own inline spinner from CodexView instead, via isRegenerating)
  // — jump straight to the generating state rather than waiting on the query cache to reflect
  // the new PENDING row. setQueryData + the invalidate-triggered refetch in
  // useGenerateCodexDigest are both async, so gating only on digest.status can lag a beat, or —
  // if this call raced a background refetch that hadn't landed yet — never visibly show at all.
  // Real phase takes over the instant the cache catches up.
  if (isGenerating && digest?.status !== CodexDigestStatus.COMPLETED) {
    return <CodexGenerating phase={null} />;
  }

  if (notEntitled) {
    return <CodexNotEntitledState reason={notEntitled.reason} errorCode={notEntitled.errorCode} />;
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
        <CodexView digest={digest} onRegenerate={onRegenerate} isRegenerating={isGenerating} />
      ) : (
        <CodexQuietDayState onGenerate={onGenerate} isGenerating={isGenerating} />
      );
    default:
      return <CodexNotEntitledState reason="This digest is in an unexpected state." />;
  }
}
