import type { SharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';

interface UseScrollResetParams {
  listRef: React.RefObject<{
    scrollToOffset: (params: { offset: number; animated: boolean }) => void;
  } | null>;
  scrollY: SharedValue<number>;
  isResettingRef: React.MutableRefObject<boolean>;
  dependencies: unknown[];
}

/**
 * Custom hook to handle scroll reset logic
 * Resets scroll position when dependencies change
 */
export function useScrollReset({
  listRef,
  scrollY,
  isResettingRef,
  dependencies,
}: UseScrollResetParams) {
  useEffect(() => {
    // Set reset flag to prevent scroll handler from interfering
    isResettingRef.current = true;

    // Reset scroll position immediately
    scrollY.value = 0;

    // Scroll list to top - use multiple attempts to ensure it works
    const scrollToTop = () => {
      if (listRef.current) {
        try {
          listRef.current.scrollToOffset({ offset: 0, animated: false });
        } catch {
          // Ignore errors if list isn't ready
        }
      }
    };

    // Try immediately
    scrollToTop();

    // Also try after a short delay to ensure list is ready
    const timeoutId = setTimeout(() => {
      scrollToTop();
      // Clear reset flag after scroll operations complete
      setTimeout(() => {
        isResettingRef.current = false;
      }, 100);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      isResettingRef.current = false;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY is a stable SharedValue, dependencies should trigger reset
  }, dependencies);
}
