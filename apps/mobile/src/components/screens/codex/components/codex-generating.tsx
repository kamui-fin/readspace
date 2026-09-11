import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { CodexDigestPhase } from '@readspace/shared';
import { CheckCircleIcon, StarsIcon } from '@solar-icons/react-native/bold';
import { MotiView } from 'moti';
import { View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import ShimmerText from 'react-native-shimmer-text';

/**
 * Ordered phases with display copy. `gathering` is typically sub-second; `triaging` and
 * `synthesizing` (the two model calls) dominate wall-clock time. No minimum dwell per phase.
 *
 * `labelWidth` is sized to that label's own text (not a shared max) so a short label like
 * "Writing your digest" isn't padded out to the width of the longest one — that padding was
 * what made the checklist read as left-anchored instead of centered under the heading above
 * it. It only has to match closely enough that swapping the row into ShimmerText (which needs
 * an explicit width/height for its mask) doesn't visibly jitter.
 */
const PHASES: { phase: CodexDigestPhase; label: string; labelWidth: number }[] = [
  { phase: CodexDigestPhase.GATHERING, label: 'Reading your feeds', labelWidth: 132 },
  { phase: CodexDigestPhase.TRIAGING, label: 'Finding the patterns', labelWidth: 142 },
  { phase: CodexDigestPhase.READING, label: 'Reading the full stories', labelWidth: 162 },
  { phase: CodexDigestPhase.SYNTHESIZING, label: 'Writing your digest', labelWidth: 138 },
];

const DOT = 22;

interface CodexGeneratingProps {
  /** Null before the worker picks the task up — treated as the first phase. */
  phase: CodexDigestPhase | null;
}

/**
 * The build-in-progress screen. No spinner: the mark breathes, and the active phase label
 * carries a real shimmer sweep — the "something is thinking" signal, in the plain greyscale
 * identity. Everything is centered as one block.
 */
export function CodexGenerating({ phase }: CodexGeneratingProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const activeIndex = Math.max(
    0,
    PHASES.findIndex((p) => p.phase === phase)
  );

  // Resolve to the app's actual theme regardless of how ShimmerText reads the scheme: dim
  // grey text with a foreground-bright band sweeping across it (mirrors the web treatment).
  const shimmer = {
    text: colors.grey,
    shimmer: { start: colors.grey, middle: colors.primary_foreground, end: colors.grey },
  };

  return (
    <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 72 }}>
      <MotiView
        from={{ opacity: 0.7, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: 'timing',
          duration: 1500,
          loop: true,
          repeatReverse: true,
          easing: Easing.inOut(Easing.ease),
        }}
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${colors.secondary}1A`,
        }}>
        <StarsIcon size={24} color={colors.secondary} />
      </MotiView>

      <Text
        size="lg"
        fontFamily="geist-bold"
        className="text-primary-foreground mt-5 text-center tracking-tight">
        Building your Daily Digest
      </Text>
      <Text size="sm" className="text-grey mt-1.5 text-center">
        This usually takes under a minute
      </Text>

      <View className="mt-8" style={{ alignSelf: 'center' }}>
        {/* alignItems: 'center' lets each row size to its own (now per-label) width and
            center itself, instead of every row stretching to match the widest one. */}
        <View style={{ gap: 16, alignItems: 'center' }}>
          {PHASES.map((p, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <View key={p.phase} className="flex-row items-center" style={{ gap: 12 }}>
                <View
                  style={{
                    width: DOT,
                    height: DOT,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {done ? (
                    <CheckCircleIcon size={DOT} color={colors.secondary} />
                  ) : (
                    <View
                      style={{
                        width: DOT,
                        height: DOT,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: active ? colors.secondary : colors.grey4,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Text
                        fontFamily="geist-semibold"
                        className={active ? 'text-secondary' : 'text-grey'}
                        style={{
                          fontSize: 11,
                          lineHeight: 12,
                          textAlign: 'center',
                          textAlignVertical: 'center',
                          includeFontPadding: false,
                        }}>
                        {i + 1}
                      </Text>
                    </View>
                  )}
                </View>

                {active ? (
                  // ShimmerText centers its label in an over-wide mask box; force it
                  // left-aligned into a fixed slot and give the mask real height so
                  // descenders ("g", "y") don't clip.
                  <ShimmerText
                    duration={1.8}
                    bold={false}
                    size="sm"
                    width={p.labelWidth}
                    height={20}
                    direction="ltr"
                    style={{
                      fontFamily: 'Geist_500Medium',
                      fontSize: 14,
                      lineHeight: 20,
                      textAlign: 'left',
                      includeFontPadding: false,
                    }}
                    containerStyle={{
                      height: DOT,
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                    }}
                    colors={{ light: shimmer, dark: shimmer }}>
                    {p.label}
                  </ShimmerText>
                ) : (
                  <Text
                    size="sm"
                    className="text-grey"
                    style={{ width: p.labelWidth, ...(done ? {} : { opacity: 0.45 }) }}>
                    {p.label}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
