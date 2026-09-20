import { useTabDoubleTap } from '@components/navigation/bottom-tabs/use-tab-double-tap';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

/**
 * iOS tab bar: a real `UITabBarController` via Expo Router's `NativeTabs` — Liquid Glass on
 * iOS 26, system blur below, native haptics/animation and SF Symbols. Android keeps the custom
 * floating bar in `_layout.tsx`.
 *
 * The feed switcher has no tab-bar entry point here (native tab items can't act as buttons). It
 * opens from a button in the Following header, which replaces the unread count on iOS.
 */
export default function TabsLayout() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const emitDoubleTap = useTabDoubleTap();
  const contentStyle = { backgroundColor: colors.background };

  return (
    <NativeTabs
      tintColor={isDark ? colors.secondary : colors.primary}
      screenListeners={({ route }) => ({
        tabPress: () => emitDoubleTap(route.name),
      })}>
      <NativeTabs.Trigger name="index" contentStyle={contentStyle}>
        <NativeTabs.Trigger.Label>Following</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="codex" contentStyle={contentStyle}>
        <NativeTabs.Trigger.Label>Digest</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sparkles', selected: 'sparkles' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover" contentStyle={contentStyle}>
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" contentStyle={contentStyle}>
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
