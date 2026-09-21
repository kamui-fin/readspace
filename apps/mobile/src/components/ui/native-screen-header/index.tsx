import type { NativeScreenHeaderProps } from './types';

export type { NativeScreenHeaderProps } from './types';

/**
 * Android / default: no native navigation bar. Screens keep the JS header they already render,
 * gated on `USES_NATIVE_HEADER`, so this is deliberately inert — it still takes the same props so
 * callers share one contract across platforms.
 */
export function NativeScreenHeader(_props: NativeScreenHeaderProps) {
  return null;
}
