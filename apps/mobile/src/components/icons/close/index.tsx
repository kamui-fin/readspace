import type { SvgProps } from 'react-native-svg';
import Svg, { G, Path } from 'react-native-svg';

export interface CloseIconProps extends Omit<SvgProps, 'width' | 'height'> {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const CloseIcon = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  ...props
}: CloseIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...props}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
    </G>
  </Svg>
);
