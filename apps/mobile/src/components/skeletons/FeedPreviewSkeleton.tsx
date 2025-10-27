import { ScrollView, View } from 'react-native';
import { ShimmerView } from './ShimmerView';

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

                {/* Feed Title - 2 lines */}
                <View className="mb-2 gap-2">
                    <ShimmerView width="75%" height={24} />
                    <ShimmerView width="50%" height={24} />
                </View>

                {/* Feed Description - 3 lines */}
                <View className="mb-4 gap-1.5">
                    <ShimmerView width="100%" height={16} />
                    <ShimmerView width="100%" height={16} />
                    <ShimmerView width="66%" height={16} />
                </View>

                {/* Feed URL */}
                <View className="mb-4">
                    <ShimmerView width={192} height={14} />
                </View>

                {/* Feed Stats */}
                <View className="mb-6">
                    <ShimmerView width={128} height={14} />
                </View>

                {/* Follow Button */}
                <ShimmerView width="100%" height={48} borderRadius={24} />
            </View>

            {/* Divider */}
            <View className="mb-6 h-2 bg-light-grey" />

            {/* Recent Articles */}
            <View className="mb-6 px-6">
                {/* Section title */}
                <View className="mb-5">
                    <ShimmerView width={144} height={18} />
                </View>

                {/* Article card skeleton */}
                <ShimmerView width={320} height={256} borderRadius={16} />
            </View>

            {/* Divider */}
            <View className="mb-6 h-2 bg-light-grey" />

            {/* Similar Feeds */}
            <View className="px-6 pb-8">
                {/* Section title */}
                <View className="mb-5">
                    <ShimmerView width={176} height={18} />
                </View>

                {/* Feed items */}
                <View className="gap-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <View key={index} className="flex-row items-center gap-3 py-3">
                            <ShimmerView width={56} height={56} borderRadius={8} />
                            <View className="flex-1 gap-2">
                                <ShimmerView width="75%" height={16} />
                                <ShimmerView width="100%" height={12} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}
