import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(ExpoImage);

interface ZoomableImageProps {
  uri: string;
}

export function ZoomableImage({ uri }: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // Don't pinch zoom out below 0.8 to keep layout clean
      scale.value = Math.max(0.8, savedScale.value * e.scale);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only pan if we are zoomed in
      if (scale.value > 1) {
        translationX.value = savedTranslationX.value + e.translationX;
        translationY.value = savedTranslationY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else {
        savedTranslationX.value = translationX.value;
        savedTranslationY.value = translationY.value;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translationX.value },
        { translateY: translationY.value },
        { scale: scale.value },
      ],
    };
  });

  const gestures = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  return (
    <GestureDetector gesture={gestures}>
      <AnimatedImage
        source={{ uri }}
        style={[{ width: '100%', height: '100%' }, animatedStyle]}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    </GestureDetector>
  );
}
