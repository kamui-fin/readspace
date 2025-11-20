import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

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
  const { scopes = ['openid', 'profile', 'email'], ...restConfig } = config;

  const [request, response, promptAsync] = Google.useAuthRequest({
    ...restConfig,
    scopes,
    // We remove responseType: ResponseType.IdToken to use the default Authorization Code Flow (PKCE).
    // The provider automatically exchanges the code for tokens, so response.authentication.idToken will be available.
  });

  return {
    request,
    response,
    promptAsync,
  };
}
