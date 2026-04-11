import { Skeleton } from '@components/ui/skeleton';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function FeedPreviewSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false} className="px-6 pt-2">
        <View className="mb-6" />
        <View className="mb-4">
          <Skeleton variant="circle" width={96} height={96} />
        </View>
        <Skeleton variant="text" width="60%" height={28} className="mb-2" />
        <Skeleton variant="text" width="100%" height={20} className="mb-2" />
        <Skeleton variant="text" width="80%" height={20} className="mb-4" />
        <Skeleton variant="rectangle" width="100%" height={48} className="mb-8" />

        <Skeleton variant="text" width="40%" height={24} className="mb-4" />
        <View className="gap-4 mb-8">
          {Array.from({ length: 3 }, (_, i) => `article-skeleton-${i}`).map((key) => (
            <View key={key} className="flex-row gap-3">
              <Skeleton variant="rectangle" width={280} height={200} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
