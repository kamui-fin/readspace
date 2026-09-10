import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { CodexDigestPhase } from '@readspace/shared';
import { CheckCircleIcon } from '@solar-icons/react-native/bold';
import { View } from 'react-native';
import { Spinner } from '@/components/ui/spinner';

/**
 * Ordered phases with display copy. `gathering` is typically sub-second and easy to miss;
 * `triaging` and `synthesizing` (the two Gemini calls) dominate wall-clock time. No minimum
 * dwell time is assumed per phase.
 */
const PHASES: { phase: CodexDigestPhase; label: string }[] = [
  { phase: CodexDigestPhase.GATHERING, label: 'Reading your feeds' },
  { phase: CodexDigestPhase.TRIAGING, label: 'Finding patterns' },
  { phase: CodexDigestPhase.READING, label: 'Reading the full stories' },
  { phase: CodexDigestPhase.SYNTHESIZING, label: 'Writing your digest' },
];

interface CodexGeneratingProps {
  /** Null before the worker picks the task up — treated as the first phase. */
  phase: CodexDigestPhase | null;
}

export function CodexGenerating({ phase }: CodexGeneratingProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const activeIndex = Math.max(
    0,
    PHASES.findIndex((p) => p.phase === phase)
  );

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Spinner size="large" color={colors.secondary} />
      <Text size="lg" fontFamily="geist-semibold" className="text-primary-foreground mt-6">
        Building your Daily Digest
      </Text>
      <Text size="sm" className="text-grey mt-1 text-center">
        This usually takes under a minute.
      </Text>

      <View className="mt-8 w-full gap-3">
        {PHASES.map((p, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <View key={p.phase} className="flex-row items-center gap-3">
              {done ? (
                <CheckCircleIcon size={18} color={colors.secondary} />
              ) : (
                <View
                  className="h-[18px] w-[18px] items-center justify-center rounded-full"
                  style={{
                    borderWidth: 1.5,
                    borderColor: active ? colors.secondary : colors.grey5,
                  }}>
                  <Text
                    size="xs"
                    fontFamily="geist-semibold"
                    className={active ? 'text-secondary' : 'text-grey'}>
                    {i + 1}
                  </Text>
                </View>
              )}
              <Text
                size="sm"
                fontFamily={active ? 'geist-medium' : 'geist'}
                className={
                  active ? 'text-primary-foreground' : done ? 'text-grey' : 'text-grey opacity-50'
                }>
                {p.label}
                {active ? '…' : ''}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
