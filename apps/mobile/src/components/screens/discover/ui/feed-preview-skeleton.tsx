import { Skeleton } from '@components/ui/skeleton';
import { Dimensions, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.7;

export function FeedPreviewSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false} className="pt-2">
        {/* Profile / Feed Info Header */}
        <View className="px-6">
          <View className="mb-6" />
          <View className="mb-4">
            <Skeleton variant="circle" width={96} height={96} />
          </View>
          <Skeleton variant="text" width="60%" height={28} className="mb-2" />
          <Skeleton variant="text" width="100%" height={20} className="mb-2" />
          <Skeleton variant="text" width="80%" height={20} className="mb-4" />
          <Skeleton variant="rectangle" width="100%" height={48} className="mb-8" />
        </View>

        {/* Recent Articles horizontal list */}
        <View className="mb-8">
          <Skeleton variant="text" width="40%" height={24} className="mx-6 mb-4" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24 }}>
            <View className="flex-row gap-4">
              {Array.from({ length: 3 }, (_, i) => `article-skeleton-${i}`).map((key) => (
                <Skeleton
                  key={key}
                  variant="rectangle"
                  width={CARD_WIDTH}
                  height={200}
                  className="rounded-2xl"
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}
