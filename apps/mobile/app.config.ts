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
  plugins: [
    'expo-router',
    [
      'expo-font',
      {
        // Fonts are loaded via @expo-google-fonts packages at runtime
        // See apps/mobile/src/app/_layout.tsx for font loading
        // The plugin is configured here for consistency, but fonts from
        // npm packages don't need to be listed in the plugin config
        fonts: [
          '../../node_modules/@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf',
          '../../node_modules/@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf',
          '../../node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf',
          '../../node_modules/@expo-google-fonts/geist/700Bold/Geist_700Bold.ttf',
          '../../node_modules/@expo-google-fonts/geist-mono/400Regular/GeistMono_400Regular.ttf',
          '../../node_modules/@expo-google-fonts/geist-mono/500Medium/GeistMono_500Medium.ttf',
          '../../node_modules/@expo-google-fonts/geist-mono/600SemiBold/GeistMono_600SemiBold.ttf',
          '../../node_modules/@expo-google-fonts/geist-mono/700Bold/GeistMono_700Bold.ttf',
          '../../node_modules/@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf',
          '../../node_modules/@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf',
          '../../node_modules/@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf',
          '../../node_modules/@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/400Regular/EBGaramond_400Regular.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/500Medium/EBGaramond_500Medium.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/600SemiBold/EBGaramond_600SemiBold.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/700Bold/EBGaramond_700Bold.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/400Regular_Italic/EBGaramond_400Regular_Italic.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/500Medium_Italic/EBGaramond_500Medium_Italic.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/600SemiBold_Italic/EBGaramond_600SemiBold_Italic.ttf',
          '../../node_modules/@expo-google-fonts/eb-garamond/700Bold_Italic/EBGaramond_700Bold_Italic.ttf',
        ],
      },
    ],
  ],
});
