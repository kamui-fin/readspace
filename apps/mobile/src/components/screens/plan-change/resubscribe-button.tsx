import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { CrownIcon } from '@solar-icons/react-native/bold';
import { useUpgradeDialog } from '@stores/upgrade-dialog';

/** Secondary footer action that opens the paywall, styled like the welcome screen's secondary. */
export function ResubscribeButton() {
  const openUpgradeDialog = useUpgradeDialog((state) => state.open);
  const isDark = useIsDarkMode();
  const iconColor = isDark ? COLORS.dark.primary_foreground : COLORS.light.primary_foreground;

  return (
    <Button
      variant="secondary"
      size="large"
      leftIcon={<CrownIcon size={20} color={iconColor} />}
      onPress={() =>
        openUpgradeDialog({
          title: 'Welcome back to Pro',
          description: 'Pick up where you left off, with every feed and newsletter intact.',
        })
      }>
      Resubscribe to Pro
    </Button>
  );
}
