import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface ShimmerViewProps {
    width: number | string;
    height: number | string;
    borderRadius?: number;
}

export function ShimmerView({ width, height, borderRadius = 4 }: ShimmerViewProps) {
    const shimmerTranslate = useSharedValue(-1);

    useEffect(() => {
        shimmerTranslate.value = withRepeat(
            withTiming(1, { duration: 1500 }),
            -1,
            false
        );
    }, [shimmerTranslate]);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            shimmerTranslate.value,
            [-1, 1],
            [-300, 300],
            Extrapolate.CLAMP
        );

        return {
            transform: [{ translateX }],
        };
    });

    return (
        <View
            style={{
                width,
                height,
                borderRadius,
                backgroundColor: '#F3F3F3',
                overflow: 'hidden',
            }}>
            <Animated.View
                style={[
                    {
                        width: '100%',
                        height: '100%',
                    },
                    animatedStyle,
                ]}>
                <LinearGradient
                    colors={['#F3F3F3', '#FFFFFF', '#F3F3F3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        width: 300,
                        height: '100%',
                    }}
                />
            </Animated.View>
        </View>
    );
}
