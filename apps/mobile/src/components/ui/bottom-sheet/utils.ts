import type { SheetDetent } from '@lodev09/react-native-true-sheet';

/** True Sheet supports at most three detents. */
const MAX_DETENTS = 3;

/** Converts our `'90%'` / `'auto'` snap points into True Sheet detents (fractions or `'auto'`). */
export function toDetents(snapPoints: string[]): SheetDetent[] {
  return snapPoints.slice(0, MAX_DETENTS).map((point) => {
    if (point === 'auto') return 'auto';
    return Math.min(Number.parseFloat(point) / 100, 1);
  });
}
