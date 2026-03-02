import { OPMLImportBottomSheet } from '@components/bottom-sheets/opml-import';
import DiscordIcon from '@components/icons/local/discord';
import ExpandVerticalIcon from '@components/icons/local/expand-vertical';
import GitHubIcon from '@components/icons/local/github';
import ArchiveUpMinimlisticLinearIcon from '@components/icons/solar/archive-up-minimlistic-linear';
import DownloadLinearIcon from '@components/icons/solar/download-linear';
import HistoryLinearIcon from '@components/icons/solar/history-linear';
import Logout2LinearIcon from '@components/icons/solar/logout-2-linear';
import PaletteLinearIcon from '@components/icons/solar/palette-linear';
import { Header } from '@components/navigation/header';
import { SettingsGroup } from '@components/screens/profile/ui/settings-group';
import { SettingsItem } from '@components/screens/profile/ui/settings-item';
import { ToastTester } from '@components/screens/profile/ui/toast-tester';
import { UserProfile } from '@components/screens/profile/ui/user-profile';
import { Button } from '@components/ui/button';
import { Chip } from '@components/ui/chip';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIcon,
  DropdownMenuItemIndicator,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { exportFeedsToOPML, readFileContent, validateOPMLFile } from '@lib/utils/opml';
import { useFeeds } from '@readspace/shared';
import { useSettingsStore } from '@stores/settings';
import { type Theme, useThemeStore } from '@stores/theme';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ProfileScreen() {
  const router = useRouter(); // Still needed for Reading History button
  const { signOut, user } = useSession();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const insets = useSafeAreaInsets();
  const importSheetRef = useRef<BottomSheetModal>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [feedCount, setFeedCount] = useState(0);

  const { theme, setTheme } = useThemeStore();
  const { settings } = useSettingsStore();

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

  const handleOPMLImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: 'text/xml',
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (!file) return;

      // Read and validate the file
      const content = await readFileContent(file.uri);
      const validation = await validateOPMLFile(content);

      if (!validation.isValid) {
        toast.error(validation.error || 'Invalid OPML file');
        return;
      }

      if (validation.hasNestedCategories) {
        toast.error(
          'OPML files with nested categories are not supported. Please flatten your categories before importing.'
        );
        return;
      }

      // Store file and feed count, then show confirmation sheet
      setSelectedFile(file);
      setFeedCount(validation.feedCount);
      importSheetRef.current?.present();
    } catch (error) {
      console.error('Error picking document:', error);
      toast.error('Failed to select file. Please try again.');
    }
  }, []);

  const handleCancelImport = useCallback(() => {
    setSelectedFile(null);
    setFeedCount(0);
  }, []);

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

  const githubColor = '#161614';
  const discordColor = '#5865F2';

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + BOTTOM_TABBAR_BASE_HEIGHT + 20,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Header with safe area padding - scrolls with content */}
        <View style={{ paddingTop: insets.top }}>
          <Header variant="static" title="Profile" subtitle="Your account settings" />
        </View>
        <View className="px-6">
          {/* User Profile */}
          {user && (
            <View className="mb-8 flex-row items-center justify-between">
              <UserProfile
                name={user.user_metadata?.full_name || 'User'}
                email={user.email || ''}
                avatarUrl={user.user_metadata?.avatar_url}
                className="flex-1"
              />
              <Chip
                label={settings.instance_type === 'cloud' ? 'Cloud' : 'Self-hosted'}
                variant="filled"
                size="small"
                selected={false}
              />
            </View>
          )}

          {/* Preferences Section */}
          <SettingsGroup title="Preferences" className="mb-6">
            <DropdownMenuRoot>
              <DropdownMenuTrigger>
                <SettingsItem
                  label="Theme"
                  variant="select"
                  value={theme.charAt(0).toUpperCase() + theme.slice(1)}
                  leftIcon={<PaletteLinearIcon width={22} height={22} color={colors.black} />}
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
                    androidIconName="palette"
                  />
                  <DropdownMenuItemTitle size="lg" fontFamily="geist">
                    System
                  </DropdownMenuItemTitle>
                  <DropdownMenuItemIndicator />
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
                    androidIconName="light_mode"
                  />
                  <DropdownMenuItemTitle size="lg" fontFamily="geist">
                    Light
                  </DropdownMenuItemTitle>
                  <DropdownMenuItemIndicator />
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
                    androidIconName="dark_mode"
                  />
                  <DropdownMenuItemTitle size="lg" fontFamily="geist">
                    Dark
                  </DropdownMenuItemTitle>
                  <DropdownMenuItemIndicator />
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenuRoot>

            <SettingsItem
              label="Reading History"
              variant="button"
              leftIcon={<HistoryLinearIcon width={22} height={22} color={colors.black} />}
              onPress={() => router.push('/(protected)/recents')}
            />

            <SettingsItem
              label="Import Subscriptions"
              variant="button"
              leftIcon={<DownloadLinearIcon width={22} height={22} color={colors.black} />}
              onPress={handleOPMLImport}
            />

            <SettingsItem
              label="Export OPML"
              variant="button"
              leftIcon={
                <ArchiveUpMinimlisticLinearIcon width={22} height={22} color={colors.black} />
              }
              onPress={handleOPMLExport}
              isLast={true}
            />
          </SettingsGroup>

          {/* Other Section */}
          <SettingsGroup title="Other" className="mb-6">
            <SettingsItem
              label="GitHub"
              variant="link"
              leftIcon={<GitHubIcon width={22} height={22} fill={githubColor} />}
              onPress={handleGithubPress}
            />

            <SettingsItem
              label="Join the Discord"
              variant="link"
              leftIcon={<DiscordIcon width={22} height={22} fill={discordColor} />}
              onPress={handleDiscordPress}
              isLast={true}
            />
          </SettingsGroup>

          {/* Developer Tools */}
          <ToastTester />

          {/* Account Section */}
          <SettingsGroup title="Account" className="mb-8">
            <SettingsItem
              label={isLoggingOut ? 'Logging out...' : 'Logout'}
              variant="link"
              leftIcon={<Logout2LinearIcon width={22} height={22} color={colors.red} />}
              onPress={handleLogout}
              disabled={isLoggingOut}
              danger={true}
              isLast={true}
            />
          </SettingsGroup>
        </View>
      </ScrollView>

      {/* OPML Import Bottom Sheet */}
      <OPMLImportBottomSheet
        ref={importSheetRef}
        file={selectedFile}
        feedCount={feedCount}
        onCancel={handleCancelImport}
      />
    </View>
  );
}
