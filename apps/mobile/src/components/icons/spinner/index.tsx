import { getSpinnerSize, SpinnerProps, SpinnerView } from '@components/icons/spinner/spinner-view';
import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export const Spinner = ({ size, duration = 750, ...rest }: SpinnerProps) => {
  const transition = useSharedValue(0);

  useEffect(() => {
    transition.value = withRepeat(withTiming(360, { duration, easing: Easing.linear }), -1, false);
  }, [duration, transition]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${transition.value}deg` }],
    };
  }, []);

  return (
    <Animated.View
      style={[{ height: getSpinnerSize(size), width: getSpinnerSize(size) }, animatedStyle]}
      role="progressbar">
      <SpinnerView size={size} {...rest} />
    </Animated.View>
  );
};
