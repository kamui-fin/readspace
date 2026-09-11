import { RefreshAI } from '@components/icons/svg';
import { Button } from '@components/ui/button';
import { Divider } from '@components/ui/divider';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { type CodexDigestResponse, formatAbsoluteDate } from '@readspace/shared';
import { StarsIcon } from '@solar-icons/react-native/bold';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtAGlanceCard } from './at-a-glance-card';
import { CodexWriteupsSheet, type CodexWriteupsSheetHandle } from './codex-writeups-sheet';
import { DevelopmentCard } from './development-card';
import { hasReadingTimeStat, ReadingTimeStat } from './reading-time-stat';
import { TrendsCard } from './trends-card';
import { WorthReadingStrip } from './worth-reading-strip';

interface CodexViewProps {
  /** A COMPLETED digest with a payload — callers handle the other states. */
  digest: CodexDigestResponse;
  /** Re-run generation for a fresh edition. Omitted → no regenerate affordance rendered. */
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

/**
 * The finished digest as a single scrolling column: a dated serif masthead, the developments
 * as flat blocks (each opens its write-ups in a bottom sheet), the Worth Reading list, and a
 * closing line. Finite by construction — no infinite scroll, a visible end.
 */
export function CodexView({ digest, onRegenerate, isRegenerating }: CodexViewProps) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const sheetRef = useRef<CodexWriteupsSheetHandle>(null);
  const [isStandfirstExpanded, setIsStandfirstExpanded] = useState(false);
  const { payload } = digest;
  if (!payload) return null;

  const hasDevelopments = payload.developments.length > 0;
  const headline = payload.headline?.trim() || payload.gist || payload.scale_setter;
  const standfirst =
    payload.headline?.trim() &&
    payload.gist?.trim() &&
    payload.gist.trim() !== payload.headline.trim()
      ? payload.gist
      : null;

  return (
    <>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          // No header above this anymore, so the masthead has to clear the status bar/notch
          // itself instead of inheriting that safe area from a Header.
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + BOTTOM_TABBAR_BASE_HEIGHT + 32,
        }}>
        {/* Masthead — the top header is hidden once a digest is showing, so this line carries
            the "Daily Digest" identity itself, mono/uppercase like the web masthead. Regenerate
            sits at the far right — the one action web anchors over the masthead as a settings
            gear; mobile only needs the regenerate half here since folder settings live in
            Profile instead. */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <StarsIcon size={13} color={colors.secondary} />
            <Text
              size="xs"
              fontFamily="mono-medium"
              className="text-secondary uppercase"
              style={{ letterSpacing: 1 }}>
              Daily Digest
            </Text>
            <Text size="xs" fontFamily="mono-medium" className="text-grey">
              ·
            </Text>
            <Text
              size="xs"
              fontFamily="mono-medium"
              className="text-grey uppercase"
              style={{ letterSpacing: 1 }}>
              {formatAbsoluteDate(digest.digest_date)}
            </Text>
          </View>
          {onRegenerate ? (
            <Button
              variant="icon"
              size="small"
              fullWidth={false}
              onPress={onRegenerate}
              disabled={isRegenerating}
              loading={isRegenerating}
              accessibilityLabel="Regenerate Daily Digest">
              <RefreshAI width={16} height={16} color={colors.grey} />
            </Button>
          ) : null}
        </View>
        <Text
          fontFamily="geist-bold"
          className="text-primary-foreground mt-2"
          style={{ letterSpacing: -1.2, fontSize: 30, lineHeight: 38 }}>
          {headline}
        </Text>
        {/* Long-form standfirsts collapse to a "more" toggle, same pattern the feed info
            header uses for a feed's own description — the digest is meant to be skimmed, not
            read as its own article. */}
        {standfirst ? (
          <Text className="text-grey mt-2" style={{ fontSize: 16, lineHeight: 24 }}>
            {standfirst.length > 120 && !isStandfirstExpanded
              ? `${standfirst.slice(0, 120)}... `
              : standfirst}
            {standfirst.length > 120 ? (
              <Text
                fontFamily="geist-medium"
                onPress={() => setIsStandfirstExpanded((v) => !v)}
                className="text-primary-foreground"
                style={{ fontSize: 16, lineHeight: 24 }}>
                {isStandfirstExpanded ? ' less' : 'more'}
              </Text>
            ) : null}
          </Text>
        ) : null}

        {/* Stat cards, up top under the masthead — web sinks these into a sidebar rail; here
            they're two-up (plus Trends full-width below) in the one scrolling column. "This
            issue" is skipped on a quiet day: the gist above already says nothing converged,
            and a "Developments: 0" stat would just repeat that a third time. */}
        <View className="mt-6" style={{ gap: 12 }}>
          {hasDevelopments &&
            (hasReadingTimeStat(payload.stats) ? (
              <View className="flex-row" style={{ gap: 12 }}>
                <AtAGlanceCard digest={digest} style={{ flex: 1 }} />
                <ReadingTimeStat stats={payload.stats} style={{ flex: 1 }} />
              </View>
            ) : (
              <AtAGlanceCard digest={digest} />
            ))}
          <TrendsCard themes={payload.themes} />
        </View>

        <Divider className="mt-8" />

        {/* No developments → no fallback line here either: the gist above already covers a
            quiet day, and repeating it right below would be the same sentence twice. */}
        {hasDevelopments ? (
          <>
            <SectionHead>Developments</SectionHead>
            <View style={{ gap: 34 }}>
              {payload.developments.map((d, i) => (
                <DevelopmentCard
                  key={`${d.title}-${i}`}
                  development={d}
                  featured={i === 0}
                  onOpen={() => sheetRef.current?.open(d)}
                />
              ))}
            </View>
          </>
        ) : null}

        {payload.worth_reading.length > 0 ? (
          <View className="mt-10">
            <WorthReadingStrip items={payload.worth_reading} />
          </View>
        ) : null}
      </ScrollView>

      <CodexWriteupsSheet ref={sheetRef} />
    </>
  );
}

function SectionHead({ children }: { children: string }) {
  return (
    <Text
      size="xs"
      fontFamily="mono-medium"
      className="text-grey mb-4 mt-8 uppercase"
      style={{ letterSpacing: 1 }}>
      {children}
    </Text>
  );
}
