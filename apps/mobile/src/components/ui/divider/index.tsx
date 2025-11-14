import React from 'react';
import { StyleSheet, ViewProps, StyleProp, ViewStyle, View, DimensionValue } from 'react-native';

export interface DividerProps extends ViewProps {
  /**  Applies style to the divider. */
  style?: StyleProp<ViewStyle>;

  /**  Apply orientation to the divider. */
  orientation?: 'horizontal' | 'vertical';

  /**  divider horizontal width to the divider, not support vertical mode  */
  width?: DimensionValue;

  /**  divider vertical height to the divider, not support horizontal mode */
  height?: DimensionValue;

  /**  Custom className for NativeWind styling */
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  style,
  className,
  width = '100%',
  height = 'auto',
  ...rest
}) => (
  <View
    className={`bg-grey4 dark:bg-grey4-dark ${className || ''}`}
    style={[
      orientation === 'horizontal'
        ? { width: width as DimensionValue, height: StyleSheet.hairlineWidth }
        : { width: StyleSheet.hairlineWidth, height: height as DimensionValue },
      style,
    ]}
    {...rest}
  />
);

Divider.displayName = 'Divider';
