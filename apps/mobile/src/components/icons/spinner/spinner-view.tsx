import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@lib/constants/colors';

export type SpinnerSize = 'small' | 'medium' | 'large';

export interface SpinnerProps {
  size?: SpinnerSize;
  duration?: number;
  color?: string;
}

export const getSpinnerSize = (size?: SpinnerSize): number => {
  switch (size) {
    case 'small':
      return 16;
    case 'large':
      return 32;
    default:
      return 24;
  }
};

export const SpinnerView = ({ size, color = COLORS.light.secondary }: SpinnerProps) => {
  const spinnerSize = getSpinnerSize(size);

  return (
    <View style={{ width: spinnerSize, height: spinnerSize }}>
      <Svg width={spinnerSize} height={spinnerSize} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 9.27455 20.9097 6.80375 19.1414 5"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};
