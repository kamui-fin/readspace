import { Dimensions, ScrollView, View } from 'react-native';
import { ShimmerView } from './ShimmerView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.7;

export function FeedPreviewSkeleton() {
    return (
        <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="px-6 pb-4 pt-2">
                {/* Back button placeholder */}
                <View className="mb-6">
                    <ShimmerView width={40} height={40} borderRadius={20} />
                </View>

                {/* Feed Icon */}
                <View className="mb-4">
                    <ShimmerView width={96} height={96} borderRadius={24} />
                </View>

                {/* Feed Title */}
                <View className="mb-2">
                    <ShimmerView width="75%" height={28} borderRadius={4} />
                </View>

                {/* Feed Description - 3 lines */}
                <View className="mb-4 gap-1.5">
                    <ShimmerView width="100%" height={16} borderRadius={4} />
                    <ShimmerView width="100%" height={16} borderRadius={4} />
                    <ShimmerView width="66%" height={16} borderRadius={4} />
                </View>

                {/* Feed URL */}
                <View className="mb-4 flex-row items-center gap-2">
                    <ShimmerView width={20} height={20} borderRadius={4} />
                    <ShimmerView width={160} height={14} borderRadius={4} />
                </View>

                {/* Feed Tags */}
                <View className="mb-6 flex-row gap-2">
                    <ShimmerView width={80} height={28} borderRadius={14} />
                    <ShimmerView width={96} height={28} borderRadius={14} />
                    <ShimmerView width={72} height={28} borderRadius={14} />
                </View>

                {/* Follow Button */}
                <ShimmerView width="100%" height={48} borderRadius={24} />
            </View>

            {/* Recent Articles */}
            <View className="mb-8 mt-8">
                {/* Section title with arrow */}
                <View className="mb-5 flex-row items-center justify-between px-6">
                    <ShimmerView width={144} height={20} borderRadius={4} />
                    <ShimmerView width={36} height={36} borderRadius={18} />
                </View>

                {/* Article cards - horizontal scroll skeleton */}
                <View className="flex-row gap-4 px-6">
                    <View
                        className="overflow-hidden rounded-2xl border border-light-grey bg-white dark:border-light-grey-dark dark:bg-white-dark"
                        style={{ width: CARD_WIDTH }}>
                        <ShimmerView width={CARD_WIDTH} height={192} borderRadius={0} />
                        <View className="p-4">
                            <View className="mb-2 flex-row items-center gap-2">
                                <ShimmerView width={6} height={6} borderRadius={3} />
                                <ShimmerView width={64} height={12} borderRadius={4} />
                            </View>
                            <View className="gap-1.5">
                                <ShimmerView width="100%" height={16} borderRadius={4} />
                                <ShimmerView width="90%" height={16} borderRadius={4} />
                                <ShimmerView width="70%" height={16} borderRadius={4} />
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {/* Similar Feeds */}
            <View className="px-6 pb-8">
                {/* Section title with arrow */}
                <View className="mb-2 flex-row items-center justify-between">
                    <ShimmerView width={176} height={20} borderRadius={4} />
                    <ShimmerView width={36} height={36} borderRadius={18} />
                </View>

                {/* Feed items */}
                <View className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <View key={index} className="flex-row gap-3 py-3">
                            <ShimmerView width={56} height={56} borderRadius={8} />
                            <View className="flex-1 gap-2">
                                <ShimmerView width="75%" height={16} borderRadius={4} />
                                <ShimmerView width="100%" height={12} borderRadius={4} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}
