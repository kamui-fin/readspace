import { Monicon } from '@monicon/native';
import { Pressable, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated';

export interface ArticleActionBarProps {
    onClose?: () => void;
    onBookmark?: () => void;
    onShare?: () => void;
    onMenuPress?: () => void;
    isBookmarked?: boolean;
    animatedIndex?: SharedValue<number>;
}

export function ArticleActionBar({
    onClose,
    onBookmark,
    onShare,
    onMenuPress,
    isBookmarked = false,
    animatedIndex,
}: ArticleActionBarProps) {
    // Animate the action bar background when the sheet expands
    const animatedContainerStyle = useAnimatedStyle(() => {
        if (!animatedIndex) return {};

        const opacity = interpolate(animatedIndex.value, [0, 1], [0, 1]);

        return {
            backgroundColor: `rgba(255, 255, 255, ${opacity})`,
        };
    });

    return (
        <Animated.View
            style={[animatedContainerStyle]}
            className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-4 py-3 pt-12">
            {/* Close Button */}
            <Pressable
                onPress={onClose}
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                }}>
                <Monicon name="lucide:x" size={20} color="#232222" />
            </Pressable>

            {/* Right Actions */}
            <View className="flex-row items-center gap-3">
                {/* Share Button */}
                <Pressable
                    onPress={onShare}
                    className="h-11 w-11 items-center justify-center rounded-full bg-white"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 3,
                    }}>
                    <Monicon name="solar:share-outline" size={20} color="#232222" />
                </Pressable>

                {/* Bookmark Button */}
                <Pressable
                    onPress={onBookmark}
                    className="h-11 w-11 items-center justify-center rounded-full bg-white"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 3,
                    }}>
                    <Monicon
                        name={isBookmarked ? 'solar:bookmark-bold' : 'solar:bookmark-linear'}
                        size={20}
                        color={isBookmarked ? '#FBBC04' : '#232222'}
                    />
                </Pressable>

                {/* Menu Button */}
                <Pressable
                    onPress={onMenuPress}
                    className="h-11 w-11 items-center justify-center rounded-full bg-white"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 3,
                    }}>
                    <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <Monicon name="solar:menu-dots-bold" size={20} color="#232222" />
                    </View>
                </Pressable>
            </View>
        </Animated.View>
    );
}

