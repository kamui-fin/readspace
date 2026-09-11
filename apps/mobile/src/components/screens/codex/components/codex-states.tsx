import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  ClockCircleIcon,
  DangerTriangleIcon,
  LockKeyholeIcon,
  MoonSleepIcon,
  StarsIcon,
} from '@solar-icons/react-native/bold';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import type React from 'react';
import { View } from 'react-native';

interface ActionProps {
  onGenerate?: () => void;
  isGenerating?: boolean;
}

type Tone = 'brand' | 'neutral' | 'danger';

/** Icon ring + glyph color per tone. Mirrors the web digest state shell (secondary-tinted
 *  ring for brand, a neutral grey for informational, the red wash for a true failure). */
function toneColors(tone: Tone, colors: typeof COLORS.light | typeof COLORS.dark) {
  switch (tone) {
    case 'brand':
      return { ring: `${colors.secondary}1A`, icon: colors.secondary };
    case 'danger':
      return { ring: colors.icon_bg_red, icon: colors.red };
    default:
      return { ring: colors.grey5, icon: colors.grey };
  }
}

interface ShellProps {
  tone: Tone;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}

/**
 * The shared frame for every non-content digest state: a small tinted icon ring, a tight
 * title, one short line, and an optional action — centered in the space below the header.
 * Deliberately lean; this screen is a place you pass through, not one you sit in.
 */
function Shell({ tone, icon: Icon, title, body, children }: ShellProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const t = toneColors(tone, colors);

  return (
    <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 72 }}>
      <View className="w-full items-center" style={{ maxWidth: 300 }}>
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 44, height: 44, backgroundColor: t.ring }}>
          <Icon size={22} color={t.icon} />
        </View>

        <Text
          size="lg"
          fontFamily="geist-bold"
          className="text-primary-foreground mt-4 text-center tracking-tight">
          {title}
        </Text>

        <Text size="sm" className="text-grey mt-2 text-center" style={{ lineHeight: 20 }}>
          {body}
        </Text>

        {children ? <View className="mt-7 w-full">{children}</View> : null}
      </View>
    </View>
  );
}

/** No digest has ever been requested. */
export function CodexEmptyState({ onGenerate, isGenerating }: ActionProps) {
  return (
    <Shell
      tone="brand"
      icon={StarsIcon}
      title="Your Daily Digest is ready to build"
      body="The day's developments worth knowing, in one read.">
      {onGenerate ? (
        <Button variant="primary" size="medium" onPress={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Starting…' : "Build today's Digest"}
        </Button>
      ) : undefined}
    </Shell>
  );
}

/** SKIPPED — zero candidate articles in the window. */
export function CodexQuietDayState({ onGenerate, isGenerating }: ActionProps) {
  return (
    <Shell
      tone="neutral"
      icon={MoonSleepIcon}
      title="A quiet 24 hours"
      body="Nothing new came through your sources today.">
      {onGenerate ? (
        <Button variant="secondary" size="medium" onPress={onGenerate} disabled={isGenerating}>
          Check again
        </Button>
      ) : undefined}
    </Shell>
  );
}

/** FAILED — generation errored. The allowance was not consumed. */
export function CodexFailedState({ onGenerate, isGenerating }: ActionProps) {
  return (
    <Shell
      tone="danger"
      icon={DangerTriangleIcon}
      title="That didn't come together"
      body="Something broke mid-build — it didn't use any of your allowance.">
      {onGenerate ? (
        <Button variant="primary" size="medium" onPress={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Starting…' : 'Try again'}
        </Button>
      ) : undefined}
    </Shell>
  );
}

/**
 * Not-entitled 202 — branches on `errorCode`: an exhausted allowance names the tier and opens
 * the upgrade dialog; `CODEX_PRO_RATE_LIMITED` (Pro past its window pace, nothing to upgrade
 * to) and `AI_DISABLED` (a self-hosted instance with no model provider) are plain informational
 * stops with no action.
 */
export function CodexNotEntitledState({
  reason,
  errorCode,
}: {
  reason: string;
  errorCode?: string;
}) {
  const { open: openUpgrade } = useUpgradeDialog();

  if (errorCode === 'AI_DISABLED') {
    return (
      <Shell
        tone="neutral"
        icon={LockKeyholeIcon}
        title="This Readspace runs without AI"
        body="The Daily Digest needs a model provider, and this instance has AI features turned off."
      />
    );
  }

  if (errorCode === 'CODEX_PRO_RATE_LIMITED') {
    return (
      <Shell
        tone="neutral"
        icon={ClockCircleIcon}
        title="More Digests soon"
        body={reason || "You've reached your Daily Digest pace. Check back in a bit."}
      />
    );
  }

  return (
    <Shell
      tone="neutral"
      icon={LockKeyholeIcon}
      title="You're out of Daily Digests"
      body={reason || 'Your monthly allowance is used up. It resets at the start of next month.'}>
      <Button
        variant="primary"
        size="medium"
        onPress={() =>
          openUpgrade({
            title: 'Upgrade to Readspace Pro',
            description: 'Pro gives you a Daily Digest every day, plus unlimited AI.',
          })
        }>
        Upgrade to Pro
      </Button>
    </Shell>
  );
}
