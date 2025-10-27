import { InstancePicker, type Instance } from '@/components/InstancePicker';
import { SelfHostSettings } from '@/components/SelfHostSettings';
import { SettingsGroup, SettingsItem } from '@/components/SettingsGroup';
import { ThemePicker, type Theme } from '@/components/ThemePicker';
import { UserProfile } from '@/components/UserProfile';
import { Button } from '@/components/ui/Button';
import { DiscordIcon } from '@/components/ui/icons/DiscordIcon';
import { GitHubIcon } from '@/components/ui/icons/GitHubIcon';
import BottomSheet, { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { colorScheme, setColorScheme } = useColorScheme();
  const themePickerRef = useRef<BottomSheet>(null);
  const instancePickerRef = useRef<BottomSheet>(null);
  const selfHostSettingsRef = useRef<BottomSheetModal>(null);
  const [theme, setTheme] = useState<Theme>('system');
  const [instance, setInstance] = useState<Instance>('custom');

  // Initialize theme from colorScheme
  useEffect(() => {
    if (colorScheme === 'dark') {
      setTheme('dark');
    } else if (colorScheme === 'light') {
      setTheme('light');
    } else {
      setTheme('system');
    }
  }, [colorScheme]);

  const handleLogout = () => {
    router.push('/welcome');
  };

  const handleThemePress = () => {
    themePickerRef.current?.expand();
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    if (newTheme === 'system') {
      setColorScheme('system');
    } else if (newTheme === 'dark') {
      setColorScheme('dark');
    } else {
      setColorScheme('light');
    }
    toast(`Theme changed to ${newTheme}`);
  };

  const handleInstancePress = () => {
    instancePickerRef.current?.expand();
  };

  const handleInstanceChange = (newInstance: Instance) => {
    setInstance(newInstance);
    toast(`Instance changed to ${newInstance}`);
  };

  const handleSelfHostingPress = () => {
    selfHostSettingsRef.current?.present();
  };

  const handleSelfHostSave = (data: {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }) => {
    // TODO: Save self-hosting configuration
    console.log('Self-hosting configuration saved:', data);
  };

  const handleOPMLPress = () => {
    router.push('/settings/opml');
  };

  const handleGithubPress = () => {
    const url = 'https://github.com/kamui-fin/readspace';
    Linking.openURL(url).catch(() => {
      toast.error('Cannot open GitHub link');
    });
  };

  const handleDiscordPress = () => {
    const url = 'https://discord.com/invite/2Q5PtYwUQZ';
    Linking.openURL(url).catch(() => {
      toast.error('Cannot open Discord link');
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-6 pt-0">
            {/* Title */}
            <Text className="mb-6 font-geist-bold text-3xl tracking-heading text-black">
              Settings
            </Text>

            {/* User Profile */}
            <UserProfile
              name="John Doe"
              email="johndoe@gmail.com"
              avatarUrl="https://i.pravatar.cc/150"
              className="mb-8"
            />

            {/* Preferences Section */}
            <SettingsGroup title="Preferences" className="mb-8">
              <SettingsItem
                label="Theme"
                variant="select"
                value={theme.charAt(0).toUpperCase() + theme.slice(1)}
                onPress={handleThemePress}
              />
              <SettingsItem
                label="Instance"
                variant="select"
                value={instance.charAt(0).toUpperCase() + instance.slice(1)}
                onPress={handleInstancePress}
              />
              <SettingsItem
                label="Self-hosting"
                variant="button"
                onPress={handleSelfHostingPress}
              />
              <SettingsItem label="OPML" variant="button" onPress={handleOPMLPress} isLast />
            </SettingsGroup>

            {/* Other Section */}
            <SettingsGroup title="Other" className="mb-6">
              <SettingsItem
                label="Github"
                variant="link"
                icon={<GitHubIcon size={24} />}
                onPress={handleGithubPress}
              />
              <SettingsItem
                label="Join the Discord"
                variant="link"
                icon={<DiscordIcon size={24} />}
                onPress={handleDiscordPress}
                isLast
              />
            </SettingsGroup>
          </View>
        </ScrollView>

        {/* Logout Button - Fixed at bottom */}
        <View className="px-6 pb-6">
          <Button
            variant="neutral"
            fullWidth
            onPress={handleLogout}
            className="flex-row gap-2 rounded-2xl bg-light-grey py-4"
            textClassName="font-geist-semibold text-base"
          >
            <Monicon name="solar:logout-2-linear" size={24} color="#EA4335" />
            <Text className="font-geist-semibold text-base" style={{ color: '#EA4335' }}>
              Logout
            </Text>
          </Button>
        </View>
      </View>

      {/* Bottom Sheets */}
      <ThemePicker ref={themePickerRef} onThemeChange={handleThemeChange} initialTheme={theme} />
      <InstancePicker
        ref={instancePickerRef}
        onInstanceChange={handleInstanceChange}
        initialInstance={instance}
      />
      <SelfHostSettings ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
    </SafeAreaView>
  );
}
