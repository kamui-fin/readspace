import {
  CodexSettingsBottomSheet,
  type CodexSettingsBottomSheetRef,
} from '@components/bottom-sheets/codex-settings.bottom-sheet';
import {
  DeleteAccountModal,
  type DeleteAccountModalRef,
} from '@components/bottom-sheets/delete-account';
import { Discord, Github } from '@components/icons/svg';
import { Header } from '@components/navigation/header';
import {
  type SettingsPickerOption,
  type SettingsSection,
  SettingsView,
} from '@components/screens/profile/ui/settings-view';
// import { ToastTester } from '@components/screens/profile/ui/toast-tester';
import { UserProfile } from '@components/screens/profile/ui/user-profile';
import { Chip } from '@components/ui/chip';
import { useNativeConfirm } from '@components/ui/confirm-dialog';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import { useRevenueCat } from '@contexts/revenuecat-context';
import { useIconColor } from '@hooks/useIconColor';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { CLOUD_CONFIG } from '@lib/constants/config';
import { openStoreReview } from '@lib/review';
import { exportFeedsToOPML } from '@lib/utils/opml';
import { getUserAvatarSeed, getUserDisplayName } from '@lib/utils/user';
import { useFeeds } from '@readspace/shared';
import { CloudIcon, CrownIcon, ServerIcon, ShieldCheckIcon } from '@solar-icons/react-native/bold';
import {
  ArchiveUpMinimalisticIcon,
  DownloadIcon,
  HistoryIcon,
  Logout2Icon,
  PaletteIcon,
  StarsIcon,
  TrashBinTrashIcon,
} from '@solar-icons/react-native/linear';
import { LikeIcon } from '@solar-icons/react-native/outline/like';
import { Plane3Icon } from '@solar-icons/react-native/outline/plane-3';
import { useSettingsStore } from '@stores/settings';
import { type Theme, useThemeStore } from '@stores/theme';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import { useQueryClient } from '@tanstack/react-query';

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THEME_OPTIONS: SettingsPickerOption[] = [
  { value: 'system', label: 'System', systemImage: 'circle.lefthalf.filled' },
  { value: 'light', label: 'Light', systemImage: 'sun.max' },
  { value: 'dark', label: 'Dark', systemImage: 'moon' },
];

export function ProfileScreen() {
  const router = useRouter(); // Still needed for Reading History button
  const { signOut, user } = useSession();
  const { isPro, isRcPro, presentCustomerCenter } = useRevenueCat();
  const { confirm, dialog: confirmDialog } = useNativeConfirm();
  const { open: openUpgrade } = useUpgradeDialog();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const iconColor = useIconColor();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const insets = useSafeAreaInsets();
  const codexSettingsSheetRef = useRef<CodexSettingsBottomSheetRef>(null);
  const deleteAccountSheetRef = useRef<DeleteAccountModalRef>(null);

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

  const handleWebsitePress = () => {
    const url = 'https://readspace.ai/contact';
    Linking.openURL(url).catch(() => {
      toast.error('Cannot open website link');
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

  const handleManageSubscription = () => {
    if (isRcPro) {
      presentCustomerCenter();
      return;
    }
    confirm({
      title: 'Manage Subscription',
      message:
        'This subscription was purchased on the web. Please manage your billing via the web version of Readspace.',
      confirmLabel: 'Open Web',
      onConfirm: () => Linking.openURL(CLOUD_CONFIG.READSPACE_APP_URL),
    });
  };

  const githubColor = isDark ? '#ffffff' : '#161614';
  const discordColor = '#5865F2';

  const sections: SettingsSection[] = [
    {
      key: 'subscription',
      rows: [
        isPro
          ? {
              type: 'action',
              kind: 'button',
              key: 'manage-subscription',
              label: 'Manage Subscription',
              icon: <ShieldCheckIcon size={22} color={colors.secondary} />,
              systemImage: 'checkmark.shield',
              onPress: handleManageSubscription,
            }
          : {
              type: 'action',
              kind: 'button',
              key: 'upgrade',
              label: 'Upgrade to Pro',
              icon: <CrownIcon size={22} color="#D4AF37" />,
              systemImage: 'crown',
              onPress: () => openUpgrade(),
            },
      ],
    },
    {
      key: 'preferences',
      title: 'Preferences',
      rows: [
        {
          type: 'picker',
          key: 'theme',
          label: 'Theme',
          icon: <PaletteIcon size={22} color={colors.black} />,
          systemImage: 'paintpalette',
          value: theme,
          options: THEME_OPTIONS,
          onChange: (value) => handleThemeChange(value as Theme),
        },
        {
          type: 'action',
          kind: 'button',
          key: 'digest',
          label: 'Daily Digest Settings',
          icon: <StarsIcon size={22} color={colors.black} />,
          systemImage: 'sparkles',
          onPress: () => codexSettingsSheetRef.current?.present(),
        },
        {
          type: 'action',
          kind: 'button',
          key: 'history',
          label: 'Reading History',
          icon: <HistoryIcon size={22} color={colors.black} />,
          systemImage: 'clock.arrow.circlepath',
          onPress: () => router.push('/(protected)/settings/recents'),
        },
        {
          type: 'action',
          kind: 'button',
          key: 'import',
          label: 'Import Subscriptions',
          icon: <DownloadIcon size={22} color={colors.black} />,
          systemImage: 'square.and.arrow.down',
          onPress: () => router.push('/(protected)/settings/import-opml'),
        },
        {
          type: 'action',
          kind: 'button',
          key: 'export',
          label: 'Export OPML',
          icon: <ArchiveUpMinimalisticIcon size={22} color={colors.black} />,
          systemImage: 'square.and.arrow.up',
          onPress: handleOPMLExport,
        },
      ],
    },
    {
      key: 'other',
      title: 'Other',
      rows: [
        {
          type: 'action',
          kind: 'link',
          key: 'review',
          label: 'Leave a Review',
          icon: <LikeIcon size={22} color={colors.black} />,
          systemImage: 'heart',
          onPress: () => {
            void openStoreReview().catch(() => toast.error('Cannot open the store review page'));
          },
        },
        {
          type: 'action',
          kind: 'link',
          key: 'contact',
          label: 'Contact & Feedback',
          icon: <Plane3Icon size={22} color={colors.black} />,
          systemImage: 'paperplane',
          onPress: handleWebsitePress,
        },
        {
          type: 'action',
          kind: 'link',
          key: 'github',
          label: 'GitHub',
          icon: <Github width={20} height={20} color={iconColor} />,
          systemImage: 'chevron.left.forwardslash.chevron.right',
          onPress: handleGithubPress,
        },
        {
          type: 'action',
          kind: 'link',
          key: 'discord',
          label: 'Join the Discord',
          icon: <Discord width={20} height={20} color={discordColor} />,
          systemImage: 'bubble.left.and.bubble.right',
          onPress: handleDiscordPress,
        },
      ],
    },
    {
      key: 'account',
      title: 'Account',
      rows: [
        {
          type: 'action',
          kind: 'link',
          key: 'logout',
          label: isLoggingOut ? 'Logging out...' : 'Logout',
          icon: <Logout2Icon size={22} color={colors.red} />,
          systemImage: 'rectangle.portrait.and.arrow.right',
          onPress: handleLogout,
          disabled: isLoggingOut,
          danger: true,
        },
        {
          type: 'action',
          kind: 'link',
          key: 'delete-account',
          label: 'Delete Account',
          icon: <TrashBinTrashIcon size={22} color={colors.red} />,
          systemImage: 'trash',
          onPress: () => deleteAccountSheetRef.current?.present(),
          danger: true,
        },
      ],
    },
  ];

  return (
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      <SettingsView
        bottomInset={insets.bottom + BOTTOM_TABBAR_BASE_HEIGHT + 20}
        header={
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
        }
        intro={
          displayUser ? (
            <View className="mb-8 flex-row items-center justify-between">
              <UserProfile
                name={getUserDisplayName(displayUser)}
                email={displayUser.email || ''}
                avatarUrl={displayUser.user_metadata?.avatar_url}
                avatarSeed={getUserAvatarSeed(displayUser)}
                className="mr-3 flex-1"
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
          ) : null
        }
        sections={sections}
      />

      <CodexSettingsBottomSheet ref={codexSettingsSheetRef} />
      <DeleteAccountModal ref={deleteAccountSheetRef} />
      {confirmDialog}
    </View>
  );
}
