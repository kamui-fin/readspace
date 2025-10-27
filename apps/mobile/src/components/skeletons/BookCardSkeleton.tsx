import { View } from 'react-native';
import { ShimmerView } from './ShimmerView';

export function BookCardSkeleton() {
    return (
        <View className="w-full">
            {/* Book cover - aspect ratio 2:3 */}
            <View className="mb-3 aspect-[2/3] w-full">
                <ShimmerView width="100%" height="100%" borderRadius={16} />
            </View>

            {/* Title */}
            <View className="mb-1">
                <ShimmerView width="85%" height={16} />
            </View>

            {/* Pages left or status */}
            <ShimmerView width="50%" height={14} />
        </View>
    );
}
