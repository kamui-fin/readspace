import { Monicon, type MoniconProps } from '@monicon/native';
import type React from 'react';

interface SvgIconProps {
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
}

interface TabBarIconProps extends Partial<MoniconProps> {
  component?: React.ComponentType<SvgIconProps>;
  name?: string;
  focused?: boolean;
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

  if (name) {
    return <Monicon name={name} {...props} />;
  }

  return null;
}
