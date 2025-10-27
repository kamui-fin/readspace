import { ScrollView, View } from 'react-native';
import { ShimmerView } from './ShimmerView';

export function ArticleReaderSkeleton() {
    return (
        <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 80 }}>
            {/* Featured Image */}
            <ShimmerView width="100%" height={240} borderRadius={0} />

            {/* Article Header */}
            <View className="mx-6 mb-6 mt-6 border-b border-light-grey pb-6">
                {/* Source */}
                <View className="mb-2 flex-row items-center gap-2">
                    <ShimmerView width={16} height={16} borderRadius={2} />
                    <ShimmerView width={128} height={12} />
                </View>

                {/* Title - 2 lines */}
                <View className="mb-3 gap-2">
                    <ShimmerView width="100%" height={28} />
                    <ShimmerView width="80%" height={28} />
                </View>

                {/* Metadata */}
                <ShimmerView width={192} height={14} />
            </View>

            {/* Article Content - paragraphs */}
            <View className="px-6 gap-5">
                {/* Paragraph 1 */}
                <View className="gap-1.5">
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="75%" height={18} />
                </View>

                {/* Paragraph 2 */}
                <View className="gap-1.5">
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="80%" height={18} />
                </View>

                {/* Paragraph 3 */}
                <View className="gap-1.5">
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="100%" height={18} />
                    <ShimmerView width="66%" height={18} />
                </View>
            </View>
        </ScrollView>
    );
}
