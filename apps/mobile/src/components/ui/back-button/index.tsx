import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { ArrowLeftIcon } from '@solar-icons/react-native/linear';
import type { BackButtonProps } from './types';

export type { BackButtonProps } from './types';

/** Android / default back button: our own chevron. iOS uses the SwiftUI glass circle button. */
export function BackButton({ onPress, color, className }: BackButtonProps) {
  const isDark = useIsDarkMode();
  const iconColor = color ?? COLORS[isDark ? 'dark' : 'light'].grey;
  return (
    <Button
      variant="icon"
      size="small"
      fullWidth={false}
      className={className}
      onPress={onPress}
      accessibilityLabel="Back">
      <ArrowLeftIcon size={18} strokeWidth={2.4} color={iconColor} />
    </Button>
  );
}
