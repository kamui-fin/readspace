import { View } from 'react-native';
import { ShimmerView } from './ShimmerView';

interface ArticleListSkeletonProps {
    count?: number;
    className?: string;
}

export function ArticleListSkeleton({ count = 8, className }: ArticleListSkeletonProps) {
    return (
        <View className={className}>
            {Array.from({ length: count }).map((_, index) => (
                <View key={index} className="px-4">
                    <View className="flex-row gap-3 py-4">
                        {/* Content - takes flex-1 */}
                        <View className="flex-1">
                            {/* Header with favicon and metadata */}
                            <View className="mb-2 flex-row items-center gap-2">
                                <ShimmerView width={16} height={16} borderRadius={2} />
                                <ShimmerView width={96} height={12} />
                            </View>

                            {/* Title - 2 lines */}
                            <View className="mb-2 gap-1">
                                <ShimmerView width="100%" height={16} />
                                <ShimmerView width="75%" height={16} />
                            </View>

                            {/* Description - 2 lines */}
                            <View className="gap-1">
                                <ShimmerView width="100%" height={14} />
                                <ShimmerView width="80%" height={14} />
                            </View>
                        </View>

                        {/* Thumbnail - 96x96 on the right */}
                        <ShimmerView width={96} height={96} borderRadius={12} />
                    </View>

                    {/* Divider */}
                    {index < count - 1 && (
                        <View className="h-[0.5px] bg-light-grey dark:bg-light-grey-dark" />
                    )}
                </View>
            ))}
        </View>
    );
}
