import { OPMLImportBottomSheet } from '@components/bottom-sheets/opml-import';
import { DiscordIcon } from '@components/icons/discord';
import { ExpandVerticalIcon } from '@components/icons/expand-vertical';
import { GitHubIcon } from '@components/icons/github';
import { Header } from '@components/navigation/header';
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
import { Monicon } from '@monicon/native';
import { useFeeds, useFolders } from '@readspace/shared';
import { useSettingsStore } from '@stores/settings';
import { type Theme, useThemeStore } from '@stores/theme';
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
  const { data: feeds } = useFeeds();
  const { data: folders } = useFolders();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
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
      await exportFeedsToOPML(feeds || [], typedFolders);
      toast.success('OPML exported successfully!');
    } catch (error) {
      console.error('OPML export error:', error);
      toast.error('Failed to export OPML');
    }
  }, [feeds, folders]);

  // Lighter shade colors for buttons
  const githubBackground = isDark ? 'rgba(22, 22, 20, 0.15)' : 'rgba(22, 22, 20, 0.1)';
  const discordBackground = isDark ? 'rgba(88, 101, 242, 0.15)' : 'rgba(88, 101, 242, 0.1)';
  const redBackground = isDark ? 'rgba(234, 67, 53, 0.15)' : 'rgba(234, 67, 53, 0.1)';

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
          <View className="mb-8 gap-2">
            <Text size="md" fontFamily="geist-semibold" className="text-grey dark:text-grey">
              Preferences
            </Text>
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text size="lg" fontFamily="geist" className="text-black dark:text-black-dark">
                  Theme
                </Text>
                <DropdownMenuRoot>
                  <DropdownMenuTrigger>
                    <Button
                      variant="secondary"
                      size="medium"
                      fullWidth={false}
                      rightIcon={<ExpandVerticalIcon size={16} color={colors.black} />}
                      textClassName="font-geist-medium text-lg">
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </Button>
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
              </View>

              {/* Import OPML Button */}
              <Button
                variant="secondary"
                size="large"
                fullWidth
                onPress={handleOPMLImport}
                leftIcon={
                  <Monicon
                    name="solar:download-linear"
                    size={20}
                    strokeWidth={2.4}
                    color={colors.black}
                  />
                }>
                <Text
                  size="base"
                  fontFamily="geist-semibold"
                  className="text-black dark:text-black-dark">
                  Import Subscriptions
                </Text>
              </Button>

              {/* Export OPML Button */}
              <Button
                variant="secondary"
                size="large"
                fullWidth
                onPress={handleOPMLExport}
                leftIcon={
                  <Monicon
                    name="solar:archive-up-minimlistic-linear"
                    size={20}
                    strokeWidth={2.4}
                    color={colors.black}
                  />
                }>
                <Text
                  size="base"
                  fontFamily="geist-semibold"
                  className="text-black dark:text-black-dark">
                  Export OPML
                </Text>
              </Button>

              {/* Reading History Button */}
              <Button
                variant="secondary"
                size="large"
                fullWidth
                onPress={() => router.push('/(protected)/recents')}
                leftIcon={
                  <Monicon
                    name="solar:history-bold-duotone"
                    size={20}
                    strokeWidth={2.4}
                    color={colors.black}
                  />
                }>
                <Text
                  size="base"
                  fontFamily="geist-semibold"
                  className="text-black dark:text-black-dark">
                  Reading History
                </Text>
              </Button>
            </View>
          </View>

          {/* Other Section */}
          <View className="mb-10 gap-2">
            <Text size="md" fontFamily="geist-semibold" className="text-grey dark:text-grey">
              Other
            </Text>
            <View className="gap-3">
              {/* GitHub Button */}
              <Button
                variant="secondary"
                size="large"
                fullWidth
                onPress={handleGithubPress}
                leftIcon={<GitHubIcon size={20} color={githubColor} />}
                style={{
                  backgroundColor: githubBackground,
                }}>
                <Text size="lg" fontFamily="geist-semibold" style={{ color: githubColor }}>
                  GitHub
                </Text>
              </Button>

              {/* Discord Button */}
              <Button
                variant="secondary"
                size="large"
                fullWidth
                onPress={handleDiscordPress}
                leftIcon={<DiscordIcon size={20} color={discordColor} />}
                style={{
                  backgroundColor: discordBackground,
                }}>
                <Text size="lg" fontFamily="geist-semibold" style={{ color: discordColor }}>
                  Join the Discord
                </Text>
              </Button>
            </View>
          </View>

          {/* Logout Button */}
          <View>
            <Button
              variant="secondary"
              size="large"
              fullWidth
              onPress={handleLogout}
              disabled={isLoggingOut}
              loading={isLoggingOut}
              leftIcon={<Monicon name="solar:logout-2-bold" size={20} color={colors.red} />}
              style={{
                backgroundColor: redBackground,
              }}>
              <Text size="lg" fontFamily="geist-semibold" style={{ color: colors.red }}>
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Text>
            </Button>
          </View>
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
