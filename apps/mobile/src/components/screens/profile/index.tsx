import DiscordIcon from '@components/icons/local/discord';
import GitHubIcon from '@components/icons/local/github';
import { Header } from '@components/navigation/header';
import { SettingsGroup } from '@components/screens/profile/ui/settings-group';
import { SettingsItem } from '@components/screens/profile/ui/settings-item';
// import { ToastTester } from '@components/screens/profile/ui/toast-tester';
import { UserProfile } from '@components/screens/profile/ui/user-profile';
import { Chip } from '@components/ui/chip';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIcon,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import { useRevenueCat } from '@contexts/revenuecat-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { CLOUD_CONFIG } from '@lib/constants/config';
import { exportFeedsToOPML } from '@lib/utils/opml';
import { useFeeds } from '@readspace/shared';
import { CloudIcon, CrownIcon, ServerIcon, ShieldCheckIcon } from '@solar-icons/react-native/bold';
import {
  ArchiveUpMinimalisticIcon,
  DownloadIcon,
  HistoryIcon,
  Logout2Icon,
  PaletteIcon,
} from '@solar-icons/react-native/linear';
import { useSettingsStore } from '@stores/settings';
import { type Theme, useThemeStore } from '@stores/theme';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import { useQueryClient } from '@tanstack/react-query';

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ProfileScreen() {
  const router = useRouter(); // Still needed for Reading History button
  const { signOut, user } = useSession();
  const { isPro, isRcPro, presentCustomerCenter } = useRevenueCat();
  const { open: openUpgrade } = useUpgradeDialog();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const insets = useSafeAreaInsets();

  const { theme, setTheme } = useThemeStore();
  const { settings } = useSettingsStore();

  const previousUserRef = useRef(user);
  useEffect(() => {
    if (user) {
      previousUserRef.current = user;
    }
  }, [user]);

  const displayUser = user || previousUserRef.current;

  // Fetch feeds and folders for OPML export
  const { data: feedsData } = useFeeds();
  const feeds = feedsData?.subscriptions || [];
  const folders = feedsData?.folders || [];

  const queryClient = useQueryClient();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      queryClient.clear();
      toast.success('Logged out successfully');
      // Navigation is handled automatically by auth context
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
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

  const handleOPMLExport = useCallback(async () => {
    try {
      if (!feeds || feeds.length === 0) {
        toast.error('No feeds to export. Subscribe to at least one feed before exporting.');
        return;
      }

      const typedFolders = (folders as { id: string; name: string }[]) || [];
      const feedsDataForExport = feeds.map((sub) => ({
        ...sub.feed,
        folder_id: sub.folder?.id,
      })) as any[];
      await exportFeedsToOPML(feedsDataForExport, typedFolders);
      toast.success('OPML exported successfully!');
    } catch (error) {
      console.error('OPML export error:', error);
      toast.error('Failed to export OPML');
    }
  }, [feeds, folders]);

  const githubColor = isDark ? '#ffffff' : '#161614';
  const discordColor = '#5865F2';

  return (
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + BOTTOM_TABBAR_BASE_HEIGHT + 20,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Header - scrolls with content */}
        <Header
          variant="static"
          title="Profile"
          titleFontWeight="semibold"
          subtitle="Your account settings"
          rightElement={
            <Chip
              label={settings.instance_type === 'cloud' ? 'Cloud' : 'Self-hosted'}
              variant="filled"
              size="medium"
              selected={false}
              icon={
                settings.instance_type === 'cloud' ? (
                  <CloudIcon size={14} color={isDark ? colors.grey2 : colors.grey} />
                ) : (
                  <ServerIcon size={14} color={isDark ? colors.grey2 : colors.grey} />
                )
              }
            />
          }
        />
        <View className="mt-4 px-6">
          {/* User Profile */}
          {displayUser && (
            <View className="mb-8 flex-row items-center justify-between">
              <UserProfile
                name={displayUser.user_metadata?.full_name || 'User'}
                email={displayUser.email || ''}
                avatarUrl={displayUser.user_metadata?.avatar_url}
                className="flex-1"
              />
              {isPro ? (
                <View
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: '#F59E0B' }}>
                  <CrownIcon size={14} color="#FFFFFF" />
                  <Text size="sm" fontFamily="geist-bold" className="text-white">
                    Pro
                  </Text>
                </View>
              ) : (
                <View
                  className="rounded-full px-3 py-1.5"
                  style={{ backgroundColor: isDark ? 'rgb(46, 46, 46)' : colors.grey6 }}>
                  <Text
                    size="sm"
                    fontFamily="geist-medium"
                    style={{ color: isDark ? colors.grey2 : colors.grey }}>
                    Basic
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Subscription Section */}
          <SettingsGroup className="mb-6">
            {!isPro ? (
              <SettingsItem
                label="Upgrade to Pro"
                variant="button"
                leftIcon={<CrownIcon size={22} color="#D4AF37" />}
                onPress={() => openUpgrade()}
                isLast={true}
              />
            ) : (
              <SettingsItem
                label="Manage Subscription"
                variant="button"
                leftIcon={<ShieldCheckIcon size={22} color={colors.secondary} />}
                onPress={() => {
                  if (isRcPro) {
                    presentCustomerCenter();
                  } else {
                    Alert.alert(
                      'Manage Subscription',
                      'This subscription was purchased on the web. Please manage your billing via the web version of Readspace.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Open Web',
                          onPress: () => Linking.openURL(CLOUD_CONFIG.READSPACE_APP_URL),
                        },
                      ]
                    );
                  }
                }}
                isLast={true}
              />
            )}
          </SettingsGroup>

          {/* Preferences Section */}
          <SettingsGroup title="Preferences" className="mb-6">
            <DropdownMenuRoot>
              <DropdownMenuTrigger>
                <SettingsItem
                  label="Theme"
                  variant="select"
                  value={theme.charAt(0).toUpperCase() + theme.slice(1)}
                  leftIcon={<PaletteIcon size={22} color={colors.black} />}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuCheckboxItem
                  key="system"
                  value={theme === 'system' ? 'on' : 'off'}
                  onValueChange={() => handleThemeChange('system')}
                  className="px-4 py-3">
                  <DropdownMenuItemIcon
                    ios={{
                      name: 'paintbrush.pointed',
                    }}
                  />
                  <DropdownMenuItemTitle size="lg" fontFamily="geist">
                    System
                  </DropdownMenuItemTitle>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  key="light"
                  value={theme === 'light' ? 'on' : 'off'}
                  onValueChange={() => handleThemeChange('light')}
                  className="px-4 py-3">
                  <DropdownMenuItemIcon
                    ios={{
                      name: 'sun.max',
                    }}
                  />
                  <DropdownMenuItemTitle size="lg" fontFamily="geist">
                    Light
                  </DropdownMenuItemTitle>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  key="dark"
                  value={theme === 'dark' ? 'on' : 'off'}
                  onValueChange={() => handleThemeChange('dark')}
                  className="px-4 py-3">
                  <DropdownMenuItemIcon
                    ios={{
                      name: 'moon',
                    }}
                  />
                  <DropdownMenuItemTitle size="lg" fontFamily="geist">
                    Dark
                  </DropdownMenuItemTitle>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenuRoot>

            <SettingsItem
              label="Reading History"
              variant="button"
              leftIcon={<HistoryIcon size={22} color={colors.black} />}
              onPress={() => router.push('/(protected)/(tabs)/recents')}
            />

            <SettingsItem
              label="Import Subscriptions"
              variant="button"
              leftIcon={<DownloadIcon size={22} color={colors.black} />}
              onPress={() => router.push('/(protected)/settings/import-opml')}
            />

            <SettingsItem
              label="Export OPML"
              variant="button"
              leftIcon={<ArchiveUpMinimalisticIcon size={22} color={colors.black} />}
              onPress={handleOPMLExport}
              isLast={true}
            />
          </SettingsGroup>

          {/* Other Section */}
          <SettingsGroup title="Other" className="mb-6">
            <SettingsItem
              label="GitHub"
              variant="link"
              leftIcon={<GitHubIcon size={20} />}
              onPress={handleGithubPress}
            />

            <SettingsItem
              label="Join the Discord"
              variant="link"
              leftIcon={<DiscordIcon size={20} />}
              onPress={handleDiscordPress}
              isLast={true}
            />
          </SettingsGroup>

          {/* Developer Tools */}
          {/* <ToastTester /> */}

          {/* Account Section */}
          <SettingsGroup title="Account" className="mb-8">
            <SettingsItem
              label={isLoggingOut ? 'Logging out...' : 'Logout'}
              variant="link"
              leftIcon={<Logout2Icon size={22} color={colors.red} />}
              onPress={handleLogout}
              disabled={isLoggingOut}
              danger={true}
              isLast={true}
            />
          </SettingsGroup>
        </View>
      </ScrollView>
    </View>
  );
}
