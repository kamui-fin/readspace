import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
    name: 'Readspace',
    slug: 'Readspace',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'readspace',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#1a1a1a',
    },
    ios: {
        supportsTablet: false,
        bundleIdentifier: 'com.readspace.app',
        associatedDomains: [],
        icon: './assets/images/ios-dark.png',
    },
    android: {
        adaptiveIcon: {
            foregroundImage: './assets/images/adaptive-icon.png',
            backgroundColor: '#1a1a1a',
        },
        edgeToEdgeEnabled: true,
        package: 'com.readspace.app',
        softwareKeyboardLayoutMode: 'pan',
    },
    plugins: [
        'expo-router',
        [
            'expo-build-properties',
            {
                android: {
                    usesCleartextTraffic: true,
                },
            },
        ],
    ],
    experiments: {
        typedRoutes: true,
        tsconfigPaths: true,
        buildCacheProvider: 'eas',
        autolinkingModuleResolution: true,
    },
    extra: {
        eas: {
            projectId: '18b6d885-5ef0-4f52-848f-b45114ad5adb',
        },
    },
};

export default config;
