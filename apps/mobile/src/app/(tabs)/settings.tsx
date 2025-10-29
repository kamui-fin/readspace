import { SettingsGroup, SettingsItem } from '@/components/SettingsGroup';
import { ThemePicker, type Theme } from '@/components/ThemePicker';
import { UserProfile } from '@/components/UserProfile';
import { OPMLImportSheet } from '@/components/modals/OPMLImportSheet';
import { Button } from '@/components/ui/Button';
import { DiscordIcon } from '@/components/ui/icons/DiscordIcon';
import { GitHubIcon } from '@/components/ui/icons/GitHubIcon';
import { useAuth } from '@/contexts/AuthProvider';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { exportFeedsToOPML, readFileContent, validateOPMLFile } from '@/utils/opml';
import BottomSheet, { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import {
  ActiveImportTask,
  ApiClient,
  RSS_QUERY_KEYS,
  useFeeds,
  useFolders,
} from '@readspace/shared';
import { useQuery } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const themePickerRef = useRef<BottomSheet>(null);
  const importSheetRef = useRef<BottomSheetModal>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedFile, setSelectedFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [feedCount, setFeedCount] = useState(0);
  const { settings } = useSettingsStore();

  // Hooks for OPML
  const { data: feeds } = useFeeds();
  const { data: folders } = useFolders();

  // Check for active imports
  const { data: activeImports = [] } = useQuery<ActiveImportTask[]>({
    queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
    queryFn: () => ApiClient.rss.listImportTasks(),
    refetchInterval: 5000, // Poll every 5 seconds for updates
  });

  const activeImport = activeImports.length > 0 ? activeImports[0] : null;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      toast.success('Logged out successfully');
      router.replace('/welcome');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleThemePress = () => {
    themePickerRef.current?.expand();
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    // Theme applies immediately via ThemeProvider, no toast needed
  };


  const handleOPMLImport = useCallback(async () => {
    // If there's an active import, navigate to its status page
    if (activeImport) {
      router.push(`/settings/opml-status/${activeImport.task_id}`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
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
      toast.error('Failed to select file', {
        description: 'Please try again',
      });
    }
  }, [activeImport, router]);

  const handleCancelImport = useCallback(() => {
    setSelectedFile(null);
    setFeedCount(0);
  }, []);

  const handleOPMLExport = async () => {
    try {
      const typedFolders = (folders as { id: string; name: string }[]) || [];
      await exportFeedsToOPML(feeds || [], typedFolders);
      toast.success('OPML exported successfully!');
    } catch (error) {
      console.error('OPML export error:', error);
      toast.error('Failed to export OPML');
    }
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
    <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
      <View className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-6 pt-0">
            {/* Title */}
            <Text className="mb-6 font-geist-bold text-3xl tracking-heading text-black dark:text-black-dark">
              Settings
            </Text>

            {/* User Profile */}
            <UserProfile
              name={user?.user_metadata?.full_name || 'User'}
              email={user?.email || ''}
              avatarUrl={
                user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150'
              }
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
                label={
                  activeImport ? 'Currently importing...' : 'Import Subscriptions'
                }
                variant="button"
                onPress={handleOPMLImport}
              />
              <SettingsItem
                label="Export OPML"
                variant="button"
                onPress={handleOPMLExport}
                isLast
              />
            </SettingsGroup>

            {/* Instance Information */}
            <SettingsGroup title="Instance" className="mb-8">
              <View className="rounded-2xl bg-light-grey dark:bg-light-grey-dark p-4">
                <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                  {settings.instance_type === 'cloud' ? 'Cloud' : 'Self-hosted'}
                </Text>
                {settings.instance_type === 'self-hosted' && (
                  <Text className="mt-1 font-geist-mono text-xs text-grey dark:text-grey-dark">
                    {settings.readspace_url}
                  </Text>
                )}
                <Text className="mt-3 font-geist text-sm text-grey dark:text-grey-dark">
                  To switch instances, log out and reconfigure during sign in.
                </Text>
              </View>
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
            disabled={loggingOut}
            className="flex-row gap-2 rounded-2xl bg-light-grey dark:bg-light-grey-dark py-4"
            textClassName="font-geist-semibold text-base">
            <Monicon name="solar:logout-2-linear" size={24} color="#EA4335" />
            <Text
              className="font-geist-semibold text-base"
              style={{ color: '#EA4335' }}>
              {loggingOut ? 'Logging out...' : 'Logout'}
            </Text>
          </Button>
        </View>
      </View>

      {/* Bottom Sheets */}
      <ThemePicker
        ref={themePickerRef}
        onThemeChange={handleThemeChange}
        initialTheme={theme}
      />

      <OPMLImportSheet
        ref={importSheetRef}
        file={selectedFile}
        feedCount={feedCount}
        onCancel={handleCancelImport}
      />
    </SafeAreaView>
  );
}
