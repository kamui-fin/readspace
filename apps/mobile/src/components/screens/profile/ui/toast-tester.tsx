import CheckCircleLinearIcon from '@components/icons/solar/check-circle-linear';
import ClockCircleLinearIcon from '@components/icons/solar/clock-circle-linear';
import CloseCircleLinearIcon from '@components/icons/solar/close-circle-linear';
import InfoCircleLinearIcon from '@components/icons/solar/info-circle-linear';
import PaletteLinearIcon from '@components/icons/solar/palette-linear';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { SettingsGroup } from './settings-group';
import { SettingsItem } from './settings-item';

export function ToastTester() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const handlePromiseToast = () => {
    const minWait = new Promise((resolve) => setTimeout(resolve, 2000));
    toast.promise(minWait, {
      loading: 'Loading data...',
      success: 'Data loaded successfully!',
      error: 'Failed to load data',
    });
  };

  return (
    <SettingsGroup title="Developer Tools" className="mb-6">
      <SettingsItem
        label="Test Success Toast"
        variant="button"
        leftIcon={<CheckCircleLinearIcon width={22} height={22} color={colors.secondary} />}
        onPress={() => toast.success('Operation completed successfully!')}
      />
      <SettingsItem
        label="Test Error Toast"
        variant="button"
        leftIcon={<CloseCircleLinearIcon width={22} height={22} color={colors.red} />}
        onPress={() => toast.error('An error occurred during the operation.')}
      />
      <SettingsItem
        label="Test Info Toast"
        variant="button"
        leftIcon={<InfoCircleLinearIcon width={22} height={22} color={colors.orange} />}
        onPress={() => toast.info('This is some information you should know.')}
      />
      <SettingsItem
        label="Test Promise Toast"
        variant="button"
        leftIcon={<ClockCircleLinearIcon width={22} height={22} color={colors.blue} />}
        onPress={handlePromiseToast}
      />
      <SettingsItem
        label="Test Custom Toast"
        variant="button"
        isLast
        leftIcon={<PaletteLinearIcon width={22} height={22} color={colors.black} />}
        onPress={() =>
          toast.custom('Custom styled toast message', {
            backgroundColor: isDark ? '#3b0764' : '#f3e8ff',
            textColor: isDark ? '#d8b4fe' : '#7e22ce',
          })
        }
      />
    </SettingsGroup>
  );
}
