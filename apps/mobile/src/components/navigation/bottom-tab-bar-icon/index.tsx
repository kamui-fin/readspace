import type React from 'react';
import type { ColorValue } from 'react-native';

interface SvgIconProps {
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
}

interface TabBarIconProps {
  component?: React.ComponentType<SvgIconProps>;
  name?: string;
  focused?: boolean;
  size?: number;
  color?: ColorValue;
}

export function TabBarIcon({ component: SvgComponent, name, focused, ...props }: TabBarIconProps) {
  if (SvgComponent) {
    return (
      <SvgComponent
        width={props.size || 24}
        height={props.size || 24}
        color={typeof props.color === 'string' ? props.color : undefined}
        filled={focused}
      />
    );
  }
  return null;
}
