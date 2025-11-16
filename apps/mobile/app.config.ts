import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Readspace',
  slug: 'readspace',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/app/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/app/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
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
  plugins: ['expo-router', 'expo-font'],
});
