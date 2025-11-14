import { BlurView as RNBlurView, type BlurViewProps as RNBlurViewProps } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export type BlurViewProps = Omit<RNBlurViewProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * BlurView component wrapper for expo-blur.
 *
 * Note: This component avoids using className to prevent NativeWind's CSS interop
 * from processing it, which can cause "Invalid hook call" errors with third-party
 * native components. We only use the style prop.
 */
export const BlurView = ({
  children,
  style,
  experimentalBlurMethod = 'dimezisBlurView',
  intensity = 100,
  ...rest
}: BlurViewProps) => {
  // Use provided style or fallback to absoluteFillObject
  const combinedStyle = style ?? StyleSheet.absoluteFillObject;

  // Render with JSX but ensure no className is passed to avoid NativeWind processing
  // The key is that we never pass className, so NativeWind shouldn't try to process it
  return (
    <RNBlurView
      experimentalBlurMethod={experimentalBlurMethod}
      style={combinedStyle}
      intensity={intensity}
      {...rest}>
      {children}
    </RNBlurView>
  );
};
