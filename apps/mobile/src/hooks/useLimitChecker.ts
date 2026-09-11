import { useRevenueCat } from '@contexts/revenuecat-context';
import { isCodexUnlimited, useUserLimits } from '@readspace/shared';
import { useUpgradeDialog } from '@stores/upgrade-dialog';

// Upsell here is ALWAYS `useUpgradeDialog` — never the RevenueCat paywall UI
// (`presentPaywall` / `presentPaywallIfNeeded`). Owner-locked decision.
export function useLimitChecker() {
  const { data: limitData, isLoading, refetch } = useUserLimits();
  const { open } = useUpgradeDialog();
  const { isPro } = useRevenueCat();

  const canAddFeed = () => {
    // Pro subscribers bypass limit checks locally
    if (isPro) return true;
    if (!limitData) return true;

    const { limits, usage } = limitData;
    // -1 signifies unlimited
    if (limits.max_subscriptions === -1) return true;
    return usage.subscriptions < limits.max_subscriptions;
  };

  const canUseAI = () => {
    // Pro subscribers bypass limit checks locally
    if (isPro) return true;
    if (!limitData) return true;

    const { limits, usage } = limitData;
    // -1 signifies unlimited
    if (limits.max_daily_ai_calls === -1) return true;
    return usage.daily_ai_calls < limits.max_daily_ai_calls;
  };

  const canUseCodex = () => {
    // Pro subscribers bypass limit checks locally
    if (isPro) return true;
    if (!limitData) return true;

    const usage = limitData.usage.codex;
    if (!usage) return true;
    if (isCodexUnlimited(usage)) return true;
    // isPro already returned above, so this only ever runs for Basic: `used` is the monthly
    // COMPLETED count against `limit`, and `used_in_window` (0 or 1) additionally gates the
    // one-per-rolling-window allowance.
    return usage.used < usage.limit && (usage.used_in_window ?? 0) < 1;
  };

  const checkAndTriggerUpgrade = (type: 'feed' | 'ai' | 'codex') => {
    if (type === 'feed' && !canAddFeed()) {
      open({
        title: 'Subscription Limit Reached',
        description: `You have subscribed to ${limitData?.usage.subscriptions} of your ${limitData?.limits.max_subscriptions} maximum feeds. Upgrade to Pro for up to 1000 feeds!`,
      });
      return false;
    }

    if (type === 'ai' && !canUseAI()) {
      open({
        title: 'Daily AI Limit Reached',
        description: `You have used all ${limitData?.limits.max_daily_ai_calls} of your basic daily AI summaries. Upgrade to Pro for 100 daily summaries & translations!`,
      });
      return false;
    }

    if (type === 'codex' && !canUseCodex()) {
      const usage = limitData?.usage.codex;
      const metered = usage && !isCodexUnlimited(usage) ? usage : undefined;
      const monthlyExhausted = metered ? metered.used >= metered.limit : false;
      open({
        title: monthlyExhausted ? 'Monthly Daily Digest Limit Reached' : "Today's Digest Is Done",
        description: monthlyExhausted
          ? `You have used all ${metered?.limit} of your Daily Digests this month. Upgrade to Pro for two every day!`
          : 'You have generated today’s Daily Digest. Upgrade to Pro for a second one each day.',
      });
      return false;
    }

    return true;
  };

  return {
    limitData,
    isLoading,
    canAddFeed,
    canUseAI,
    canUseCodex,
    checkAndTriggerUpgrade,
    refetch,
  };
}
