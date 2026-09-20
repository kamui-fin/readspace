import { recordReviewActivity, requestReviewAfterReading } from '@lib/review';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Only request after returning to Following. Any touch cancels this opportunity. */
export function useReviewPrompt() {
  const pathname = usePathname();
  const cancelled = useRef(0);

  useEffect(() => {
    recordReviewActivity();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') recordReviewActivity();
      else cancelled.current += 1;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const opportunity = ++cancelled.current;
    recordReviewActivity();
    const timer =
      pathname === '/'
        ? setTimeout(() => {
            void requestReviewAfterReading(
              () =>
                cancelled.current === opportunity &&
                AppState.currentState === 'active' &&
                !useUpgradeDialog.getState().isOpen
            );
          }, 1500)
        : undefined;
    return () => {
      cancelled.current += 1;
      clearTimeout(timer);
    };
  }, [pathname]);

  return () => {
    cancelled.current += 1;
  };
}
