import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  isNewsletterFeedUrl,
  type OverLimitState,
  opmlExportFilename,
  type SubscriptionResponse,
  useFeeds,
  useResolveDowngrade,
} from '@readspace/shared';
import { DownloadMinimalisticIcon } from '@solar-icons/react-native/bold';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { ChangeList } from './change-list';
import { ExportCard } from './export-card';
import { KeepFeedsList } from './keep-feeds-list';
import { ResubscribeButton } from './resubscribe-button';
import { ReviewSummary } from './review-summary';
import { StepDashes } from './step-dashes';
import { StepShell } from './step-shell';
import { useOpmlExport } from './useOpmlExport';

type StepId = 'welcome' | 'export' | 'keep' | 'review';

interface PlanChangeScreenProps {
  overLimit: OverLimitState;
}

/**
 * Replaces the app when a downgraded user holds more than their plan allows:
 * what changes -> optional OPML export -> pick feeds -> review. The API refuses content
 * endpoints until this resolves, so it can't be bypassed; there's intentionally no dismiss.
 */
export function PlanChangeScreen({ overLimit }: PlanChangeScreenProps) {
  const { data, isLoading, isSuccess, isFetching, refetch } = useFeeds();
  const resolveDowngrade = useResolveDowngrade();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const [stepIndex, setStepIndex] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Newsletters are the virtual email feeds (newsletter:// URLs), the same test the server uses,
  // so every count on screen matches what resolve will actually do.
  const { regularFeeds, newsletterCount } = useMemo(() => {
    const subs = (data?.subscriptions ?? []) as SubscriptionResponse[];
    const regular = subs.filter((sub) => !isNewsletterFeedUrl(sub.feed.url));
    return { regularFeeds: regular, newsletterCount: subs.length - regular.length };
  }, [data?.subscriptions]);
  const folderCount = useMemo(
    () => new Set(regularFeeds.map((sub) => sub.folder?.id).filter(Boolean)).size,
    [regularFeeds]
  );

  const feedLimit = overLimit.subscriptions.limit;
  const savedCount = overLimit.saved_articles.usage;
  // Only ask for a pick when regular feeds alone exceed the cap (newsletters are always removed).
  const needsPick = feedLimit !== -1 && regularFeeds.length > feedLimit;
  const keepIds = needsPick ? picked : new Set(regularFeeds.map((sub) => sub.feed.id));
  const filename = opmlExportFilename();
  const {
    hasExported,
    isExporting,
    exportOpml: handleExport,
  } = useOpmlExport(regularFeeds, data?.folders ?? [], filename);

  const steps: StepId[] = needsPick
    ? ['welcome', 'export', 'keep', 'review']
    : ['welcome', 'export', 'review'];
  // The shared onboarding Stepper owns paging, the slide transition and the header back button.
  const stepperRef = useRef<StepperRef>(null);
  const next = () => stepperRef.current?.goToNext();

  // Android hardware back steps backwards through the flow instead of leaving it.
  // Rendered in place of the navigator, so a plain effect (not useFocusEffect) owns the listener.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stepperRef.current?.goToPrevious();
      return true;
    });
    return () => sub.remove();
  }, []);

  const togglePick = useCallback(
    (feedId: string) => {
      setPicked((prev) => {
        const nextPicked = new Set(prev);
        if (nextPicked.has(feedId)) nextPicked.delete(feedId);
        else if (nextPicked.size < feedLimit) nextPicked.add(feedId);
        return nextPicked;
      });
    },
    [feedLimit]
  );

  const handleConfirm = () => {
    if (!isSuccess || !data || resolveDowngrade.isPending) return;
    return toast
      .promise(resolveDowngrade.mutateAsync({ keep_feed_ids: [...keepIds] }), {
        loading: 'Updating your feeds…',
        success: "You're all set on Free",
        error: 'Something went wrong. Please try again.',
      })
      .catch((error) => console.error('[PlanChange] Resolve failed:', error));
  };

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.background }}>
        <Spinner size="medium" />
      </View>
    );
  }

  if (!isSuccess || !data) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 px-6"
        style={{ backgroundColor: colors.background }}>
        <Text accessibilityRole="alert">Couldn't load your feeds. Please retry before continuing.</Text>
        <Button variant="primary" onPress={() => refetch()} loading={isFetching}>
          Retry
        </Button>
      </View>
    );
  }

  const pages: Record<StepId, ReactElement> = {
    welcome: (
      <StepShell
        title="Your Pro plan has ended"
        subtitle="Here's what the Free plan keeps, and what it asks you to let go of. It takes about a minute."
        footer={
          <>
            <Button variant="primary" size="large" onPress={next}>
              Continue on Free
            </Button>
            <ResubscribeButton />
          </>
        }>
        <ChangeList
          feedCount={regularFeeds.length}
          feedLimit={feedLimit}
          newsletterCount={newsletterCount}
          savedCount={savedCount}
          savedLimit={overLimit.saved_articles.limit}
        />
      </StepShell>
    ),
    export: (
      <StepShell
        title="Take your feeds with you"
        subtitle="Save your full list as OPML. If you come back to Pro, import it and every feed returns to its folder."
        footer={
          <>
            {hasExported ? (
              <Button variant="primary" size="large" onPress={next}>
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size="large"
                loading={isExporting}
                leftIcon={<DownloadMinimalisticIcon size={20} color={COLORS.white} />}
                onPress={handleExport}>
                Export OPML
              </Button>
            )}
            <Button
              variant="secondary"
              size="large"
              onPress={hasExported ? handleExport : next}
              loading={hasExported && isExporting}>
              {hasExported ? 'Export again' : 'Skip export'}
            </Button>
          </>
        }>
        <ExportCard
          filename={filename}
          feedCount={regularFeeds.length}
          folderCount={folderCount}
          hasExported={hasExported}
        />
      </StepShell>
    ),
    keep: (
      <StepShell
        title={`Choose ${feedLimit} to keep`}
        subtitle={`The other ${Math.max(regularFeeds.length - feedLimit, 0)} will be unsubscribed. You can swap them later.`}
        footer={
          <>
            <Button variant="primary" size="large" onPress={next} disabled={picked.size === 0}>
              {picked.size === 0
                ? 'Pick at least one'
                : `Keep ${picked.size} ${picked.size === 1 ? 'feed' : 'feeds'}`}
            </Button>
          </>
        }>
        <KeepFeedsList
          feeds={regularFeeds}
          limit={feedLimit}
          selected={picked}
          onToggle={togglePick}
        />
      </StepShell>
    ),
    review: (
      <StepShell
        title="Ready when you are"
        subtitle={
          hasExported
            ? 'Your export is saved, so you can bring everything back later.'
            : 'You skipped the export. Go back if you want a copy first.'
        }
        footer={
          <>
            <Button
              variant="primary"
              size="large"
              loading={resolveDowngrade.isPending}
              onPress={handleConfirm}>
              Continue on Free
            </Button>
          </>
        }>
        <ReviewSummary
          feedCount={regularFeeds.length}
          keepCount={keepIds.size}
          newsletterCount={newsletterCount}
          savedCount={savedCount}
        />
      </StepShell>
    ),
  };

  return (
    <Stepper
      ref={stepperRef}
      compact
      pages={steps.map((id) => (
        <View key={id} className="flex-1">
          {pages[id]}
        </View>
      ))}
      onStepChange={setStepIndex}
      renderHeaderRight={() => <StepDashes step={stepIndex + 1} total={steps.length} />}
    />
  );
}
