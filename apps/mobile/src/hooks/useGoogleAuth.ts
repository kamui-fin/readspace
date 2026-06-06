import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Required for web-based authentication to close the browser modal properly
WebBrowser.maybeCompleteAuthSession();

interface UseGoogleAuthConfig {
  clientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
  scopes?: string[];
}

export function useGoogleAuth(config: UseGoogleAuthConfig) {
  const {
    scopes = ['openid', 'profile', 'email'],
    iosClientId,
    androidClientId,
    ...restConfig
  } = config;

  // For iOS, we need to construct the reverse client ID for the redirect URI
  // Format: com.googleusercontent.apps.{CLIENT_ID_NUMBER}:/oauth2redirect/google
  const iosRedirectUri = iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}:/oauth2redirect/google`
    : undefined;

  // Use placeholders to prevent expo-auth-session from throwing an error at render/hook-mount time.
  // This ensures the app doesn't crash on launch if environment variables are not set.
  const [request, response, promptAsync] = Google.useAuthRequest({
    ...restConfig,
    iosClientId: iosClientId || 'missing-ios-client-id',
    androidClientId: androidClientId || 'missing-android-client-id',
    scopes,
    // Use native authentication flow for better iOS/Android device support
    // This will use ASWebAuthenticationSession on iOS and Custom Tabs on Android
    usePKCE: true,
    // For iOS physical devices, we need to use the reverse client ID scheme
    // This is automatically constructed from the iosClientId
    redirectUri: Platform.OS === 'ios' ? iosRedirectUri : undefined,
  });

  const customPromptAsync = async (options?: Parameters<typeof promptAsync>[0]) => {
    const isMissingClientId = Platform.OS === 'ios' ? !iosClientId : !androidClientId;

    if (isMissingClientId) {
      const errorMsg = `Google OAuth Client ID is not configured for ${Platform.OS}. Please check your environment variables.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    return promptAsync(options);
  };

  return {
    request,
    response,
    promptAsync: customPromptAsync,
  };
}
