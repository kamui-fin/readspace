import { Skeleton } from '@components/ui/skeleton';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Newspaper-shaped placeholder for the finished digest — same masthead / stat-card /
 * development geometry as `CodexView`, so the swap to real content doesn't shift the page.
 * Shown while the latest digest row is still loading (`CodexScreen`'s `isLoading`), not while
 * it generates — that's `CodexGenerating`, a different, phase-aware surface. Replaces the
 * plain spinner that used to sit here with no relation to what's about to render.
 */
export function CodexSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1"
      style={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + BOTTOM_TABBAR_BASE_HEIGHT + 32,
      }}>
      {/* Masthead */}
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Skeleton variant="circle" width={13} height={13} />
        <Skeleton width={90} height={12} />
        <Skeleton width={70} height={12} />
      </View>
      <Skeleton className="mt-3" width="90%" height={26} />
      <Skeleton className="mt-2" width="60%" height={26} />
      <Skeleton className="mt-3" width="75%" height={16} />

      {/* Stat cards */}
      <View className="mt-6" style={{ gap: 12 }}>
        <View className="flex-row" style={{ gap: 12 }}>
          <Skeleton className="flex-1 rounded-2xl" height={116} />
          <Skeleton className="flex-1 rounded-2xl" height={116} />
        </View>
        <Skeleton className="rounded-2xl" width="100%" height={72} />
      </View>

      {/* Developments */}
      <Skeleton className="mt-8" width={110} height={12} />
      <View className="mt-4">
        <Skeleton className="rounded-2xl" width="100%" height={190} />
        <Skeleton className="mt-3.5" width="85%" height={22} />
        <Skeleton className="mt-2" width="100%" height={14} />
        <Skeleton className="mt-1.5" width="95%" height={14} />
        <Skeleton className="mt-1.5" width="60%" height={14} />
      </View>
    </View>
  );
}
