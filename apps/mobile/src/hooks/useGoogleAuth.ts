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

  const [request, response, promptAsync] = Google.useAuthRequest({
    ...restConfig,
    iosClientId,
    androidClientId,
    scopes,
    // Use native authentication flow for better iOS/Android device support
    // This will use ASWebAuthenticationSession on iOS and Custom Tabs on Android
    usePKCE: true,
    // For iOS physical devices, we need to use the reverse client ID scheme
    // This is automatically constructed from the iosClientId
    redirectUri: Platform.OS === 'ios' ? iosRedirectUri : undefined,
  });

  return {
    request,
    response,
    promptAsync,
  };
}
