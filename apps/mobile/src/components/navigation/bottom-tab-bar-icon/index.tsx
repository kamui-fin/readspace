import type React from 'react';

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
  color?: string;
}

export function TabBarIcon({ component: SvgComponent, name, focused, ...props }: TabBarIconProps) {
  if (SvgComponent) {
    return (
      <SvgComponent
        width={props.size || 24}
        height={props.size || 24}
        color={props.color}
        filled={focused}
      />
    );
  }
  return null;
}
