import { Header } from '@components/navigation/header';
import { SettingsGroup } from '@components/screens/profile/ui/settings-group';
import { Switch } from '@components/ui/switch';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { usePreferencesStore } from '@stores/preferences';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GeneralSettingsScreen() {
  const router = useRouter();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const openInBrowser = usePreferencesStore((state) => state.openInBrowser);
  const setOpenInBrowser = usePreferencesStore((state) => state.setOpenInBrowser);

  const rowBg = isDark ? 'rgb(32, 32, 32)' : colors.grey6;

  return (
    <View
      className="bg-background flex-1"
      style={{
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <Header
        variant="static"
        title=""
        transparentBackground={true}
        showBackButton={true}
        disableSafeAreaTop={true}
        onBackPress={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}>
        <View className="px-6">
          <View className="mb-6">
            <Text size="2xl" fontFamily="geist-bold" className="text-black dark:text-white mb-2">
              General
            </Text>
            <Text size="sm" fontFamily="geist-medium" className="text-grey dark:text-grey leading-relaxed">
              Manage your general app preferences and link behaviors
            </Text>
          </View>

          <SettingsGroup title="Reading Preferences">
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{ backgroundColor: rowBg }}>
            <View className="flex-1 pr-4">
              <Text size={15} fontFamily="geist-medium" className="text-black dark:text-white">
                Open Links In Browser
              </Text>
              <Text
                size="sm"
                fontFamily="geist"
                className="text-grey dark:text-grey mt-0.5 leading-relaxed">
                Automatically open articles in your default web browser instead of the app reader
              </Text>
            </View>
            <Switch
              checked={openInBrowser}
              onChange={setOpenInBrowser}
              size="regular"
            />
          </View>
        </SettingsGroup>
        </View>
      </ScrollView>
    </View>
  );
}
