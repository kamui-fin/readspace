import { View } from 'react-native';
import { ShimmerView } from './ShimmerView';

interface FeedListSkeletonProps {
    count?: number;
}

export function FeedListSkeleton({ count = 5 }: FeedListSkeletonProps) {
    return (
        <View>
            {Array.from({ length: count }).map((_, index) => (
                <View key={index}>
                    <View className="flex-row items-center gap-4 py-4">
                        {/* Icon - 48x48 */}
                        <ShimmerView width={48} height={48} borderRadius={8} />

                        {/* Content - takes flex-1 */}
                        <View className="flex-1 gap-1">
                            {/* Title */}
                            <ShimmerView width="60%" height={16} />
                            {/* Description - 2 lines */}
                            <ShimmerView width="100%" height={14} />
                            <ShimmerView width="80%" height={14} />
                        </View>

                        {/* Follow Button */}
                        <ShimmerView width={80} height={32} borderRadius={16} />
                    </View>

                    {/* Divider */}
                    {index < count - 1 && <View className="h-[0.5px] bg-green-grey dark:bg-light-grey-dark" />}
                </View>
            ))}
        </View>
    );
}
