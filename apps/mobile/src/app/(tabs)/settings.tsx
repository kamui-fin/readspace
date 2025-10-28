import { SettingsGroup, SettingsItem } from '@/components/SettingsGroup';
import { ThemePicker, type Theme } from '@/components/ThemePicker';
import { UserProfile } from '@/components/UserProfile';
import { Button } from '@/components/ui/Button';
import { DiscordIcon } from '@/components/ui/icons/DiscordIcon';
import { GitHubIcon } from '@/components/ui/icons/GitHubIcon';
import { useAuth } from '@/contexts/AuthProvider';
import BottomSheet from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import {
  exportFeedsToOPML,
  useFeeds,
  useFolders,
  useImportOPML,
  useImportTaskStatus,
} from '@readspace/shared';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { useSettingsStore } from '@/stores/settings';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const themePickerRef = useRef<BottomSheet>(null);
  const [theme, setTheme] = useState<Theme>('system');
  const [loggingOut, setLoggingOut] = useState(false);
  const [importTaskId, setImportTaskId] = useState<string | null>(null);
  const { settings } = useSettingsStore();

  // Hooks for OPML
  const importOPML = useImportOPML();
  const { data: feeds } = useFeeds();
  const { data: folders } = useFolders();
  const { data: importStatus } = useImportTaskStatus(importTaskId, !!importTaskId);

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
    if (newTheme === 'system') {
      setColorScheme('system');
    } else if (newTheme === 'dark') {
      setColorScheme('dark');
    } else {
      setColorScheme('light');
    }
    toast(`Theme changed to ${newTheme}`);
  };


  const handleOPMLImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/xml',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (file) {
        toast.loading('Importing OPML...', { id: 'opml-import' });

        // Create FormData
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: 'text/xml',
          name: file.name || 'feeds.opml',
        } as any);

        importOPML.mutate(formData, {
          onSuccess: (data) => {
            setImportTaskId(data.task_id);
            toast.success('OPML import started!', {
              id: 'opml-import',
              description: `Processing ${data.estimated_feeds} feeds...`,
            });
          },
          onError: (error: any) => {
            toast.error('Failed to import OPML', {
              id: 'opml-import',
              description: error?.message || 'Please try again',
            });
          },
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      toast.error('Failed to select file', {
        description: 'Please try again',
      });
    }
  };

  const handleOPMLExport = () => {
    try {
      const typedFolders = (folders as { id: string; name: string }[]) || [];
      exportFeedsToOPML(feeds || [], typedFolders);
      toast.success('OPML exported successfully!');
    } catch (error) {
      console.error('OPML export error:', error);
      toast.error('Failed to export OPML');
    }
  };

  // Monitor import status
  useEffect(() => {
    if (importStatus?.status === 'completed') {
      toast.success('OPML import completed!', {
        description: `Imported ${importStatus.result?.imported_count || 0} feeds`,
      });
      setImportTaskId(null);
    } else if (importStatus?.status === 'failed') {
      toast.error('OPML import failed', {
        description: importStatus.error || 'Unknown error',
      });
      setImportTaskId(null);
    }
  }, [importStatus]);

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
                label="Import OPML"
                variant="button"
                onPress={handleOPMLImport}
                disabled={importOPML.isPending || !!importTaskId}
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
                <Text className="mb-1 font-geist-medium text-sm text-grey dark:text-grey-dark">
                  Current Instance
                </Text>
                <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                  {settings.instance_type === 'cloud' ? 'Cloud' : 'Self-hosted'}
                </Text>
                {settings.instance_type === 'self-hosted' && (
                  <Text className="mt-1 font-geist-mono-regular text-xs text-grey dark:text-grey-dark">
                    {settings.readspace_url}
                  </Text>
                )}
                <Text className="mt-3 font-geist text-sm text-grey dark:text-grey-dark">
                  To switch instances, log out and reconfigure during sign in.
                </Text>
              </View>
            </SettingsGroup>

            {/* OPML Import Status */}
            {importTaskId && importStatus && (
              <View className="mb-8 rounded-2xl bg-light-grey dark:bg-light-grey-dark p-4">
                <View className="mb-2 flex-row items-center gap-3">
                  {importStatus.status === 'in_progress' && (
                    <ActivityIndicator size="small" color="#6A994E" />
                  )}
                  <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                    {importStatus.status === 'in_progress'
                      ? 'Importing feeds...'
                      : importStatus.status === 'completed'
                        ? 'Import completed!'
                        : 'Import pending...'}
                  </Text>
                </View>
                <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                  {importStatus.message}
                </Text>
              </View>
            )}

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
    </SafeAreaView>
  );
}
