import { Button } from '@components/ui/button';
import { View } from 'react-native';
import type { GlassIconButtonProps } from './types';

export type { GlassIconButtonProps } from './types';

/** Android / default: our own icon button. iOS uses the SwiftUI glass circle. */
export function GlassIconButton({
  children,
  accessibilityLabel,
  onPress,
  disabled,
  loading,
  style,
}: GlassIconButtonProps) {
  return (
    <View style={style}>
      <Button
        variant="icon"
        size="small"
        fullWidth={false}
        onPress={onPress}
        disabled={disabled}
        loading={loading}
        accessibilityLabel={accessibilityLabel}>
        {children}
      </Button>
    </View>
  );
}
