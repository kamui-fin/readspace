import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Readspace',
  slug: 'readspace',
  scheme: 'readspace',
  version: '1.0.0',
  assetBundlePatterns: ['**/*'],
  orientation: 'portrait',
  icon: './assets/app/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.readspace.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/app/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.readspace.app',
  },
  web: {
    favicon: './assets/app/favicon.png',
  },
  experiments: {
    tsconfigPaths: true,
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-web-browser',
      {
        experimentalLauncherActivity: true,
      },
    ],
  ],
});
