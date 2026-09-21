import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { View } from 'react-native';

interface StepDashesProps {
  step: number;
  total: number;
}

/** Compact progress for the Stepper's header row: one short dash per step, filled so far. */
export function StepDashes({ step, total }: StepDashesProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const active = isDark ? colors.secondary : colors.primary;
  const inactive = isDark ? 'rgb(46, 46, 46)' : colors.grey5;

  return (
    <View
      className="flex-row gap-1.5"
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          className="h-1 w-5 rounded-full"
          style={{ backgroundColor: index < step ? active : inactive }}
        />
      ))}
    </View>
  );
}
