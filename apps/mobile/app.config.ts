import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Readspace',
  slug: 'readspace',
  version: '1.0.0',
  assetBundlePatterns: ['**/*'],
  orientation: 'portrait',
  icon: './assets/app/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'com.readspace.rss',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.readspace.rss',
    // Google Sign In requires reverse client ID scheme
    // The scheme is constructed from your Google OAuth iOS Client ID
    // Format: com.googleusercontent.apps.{CLIENT_ID_WITHOUT_SUFFIX}
    infoPlist: {
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            // This should match your EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
            // Falls back to the default if not set
            `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.replace('.apps.googleusercontent.com', '') || '372373410684-63fg96rrnuuu22nd8qfdpm8tf5sdpfst'}`,
          ],
        },
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/app/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.readspace.rss',
    // Google Sign In intent filter for Android
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'readspace.rss',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/app/favicon.png',
  },
  developmentClient: {
    silentLaunch: true,
  },
  experiments: {
    tsconfigPaths: true,
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    [
      'expo-web-browser',
      {
        experimentalLauncherActivity: true,
      },
    ],
  ],
});
