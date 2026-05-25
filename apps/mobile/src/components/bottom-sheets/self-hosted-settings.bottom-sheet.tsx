/** biome-ignore-all assist/source/organizeImports: false positive */
import { BottomSheetTextInput, type BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { Text } from '@components/ui/text';
import 'react-native-url-polyfill/auto';
import { z } from 'zod';

import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/spinner';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { validateSupabaseConnection } from '@lib/supabase/client';

// Helper to resolve hostname for Android emulator
const resolveHostname = (url: string) => {
  try {
    const _url = new URL(url);
    if (_url.hostname === 'localhost' && Platform.OS === 'android') {
      _url.hostname = '10.0.2.2';
    }
    // Remove trailing slash to prevent double slashes in API paths
    return _url.toString().replace(/\/$/, '');
  } catch {
    if (url.includes('localhost') && Platform.OS === 'android') {
      return url.replace('localhost', '10.0.2.2').replace(/\/$/, '');
    }
    return url.replace(/\/$/, '');
  }
};

// Helper to wrap a promise in a timeout
const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const selfHostSchema = z.object({
  apiUrl: z
    .url('Please enter a valid URL (e.g., http://localhost:8008)')
    .min(1, 'API URL is required'),
});

export interface SelfHostSettingsProps {
  onSave?: (data: {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    meilisearchUrl?: string;
    meilisearchSearchKey?: string;
  }) => void;
  onClose?: () => void;
  initialData?: {
    apiUrl?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    meilisearchUrl?: string;
    meilisearchSearchKey?: string;
  };
}

export const SelfHostSettingsBottomSheet = forwardRef<BottomSheetModal, SelfHostSettingsProps>(
  ({ onSave, onClose, initialData }, ref) => {
    const isDark = useIsDarkMode();
    const [apiUrl, setApiUrl] = useState(initialData?.apiUrl || '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isValidating, setIsValidating] = useState(false);

    // Debug: Log when bottom sheet mounts/unmounts
    useEffect(() => {
      console.log('[SelfHostSettingsBottomSheet] Component mounted');
      return () => console.log('[SelfHostSettingsBottomSheet] Component unmounted');
    }, []);

    // Validate form schema
    const isValid = useMemo(() => {
      try {
        selfHostSchema.parse({
          apiUrl,
        });
        return true;
      } catch {
        return false;
      }
    }, [apiUrl]);

    const handleSave = useCallback(async () => {
      Keyboard.dismiss();
      setIsValidating(true);
      setErrors({});

      try {
        // Validate form schema first
        const data = selfHostSchema.parse({
          apiUrl,
        });

        // Test API endpoint and retrieve configuration
        const validationPromise = (async () => {
          console.log('[SelfHostSettingsBottomSheet] Starting validation...');
          console.log('[SelfHostSettingsBottomSheet] API URL:', data.apiUrl);
          console.log('[SelfHostSettingsBottomSheet] Platform:', Platform.OS);

          const resolvedApiUrl = resolveHostname(data.apiUrl);
          console.log('[SelfHostSettingsBottomSheet] Resolved API URL:', resolvedApiUrl);

          // 1. Fetch config from server
          let configResponse: Response;
          try {
            configResponse = await fetch(`${resolvedApiUrl}/api/config`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.log('[SelfHostSettingsBottomSheet] Config fetch error:', error);
            throw new Error('Unable to connect to the Readspace server. Check the URL and try again.');
          }

          if (!configResponse.ok) {
            console.log('[SelfHostSettingsBottomSheet] Config endpoint failed:', configResponse.status);
            throw new Error(`Server returned error status ${configResponse.status}`);
          }

          let serverConfig: {
            supabase_url: string;
            supabase_anon_key: string;
            meilisearch_url: string;
            meilisearch_search_key: string;
          };

          try {
            serverConfig = await configResponse.json();
          } catch (e) {
            console.log('[SelfHostSettingsBottomSheet] Failed to parse config JSON:', e);
            throw new Error('Received invalid config response from the server.');
          }

          console.log('[SelfHostSettingsBottomSheet] Server config retrieved:', serverConfig);

          if (!serverConfig.supabase_url || !serverConfig.supabase_anon_key) {
            throw new Error('Server configuration is incomplete (missing Supabase credentials).');
          }

          // 2. Resolve internal docker networks / localhost back to entered API host
          const apiParsed = new URL(data.apiUrl);
          
          const isDockerOrLocalhost = (urlStr: string) => {
            try {
              const parsed = new URL(urlStr);
              return (
                parsed.hostname === 'localhost' ||
                parsed.hostname === '127.0.0.1' ||
                parsed.hostname === 'kong' ||
                parsed.hostname === 'meilisearch' ||
                parsed.hostname.endsWith('.local')
              );
            } catch {
              return true;
            }
          };

          let resolvedSupabaseUrl = serverConfig.supabase_url;
          if (isDockerOrLocalhost(resolvedSupabaseUrl)) {
            try {
              const supabaseParsed = new URL(resolvedSupabaseUrl);
              const port = supabaseParsed.port || '18000';
              resolvedSupabaseUrl = `${apiParsed.protocol}//${apiParsed.hostname}:${port}`;
            } catch {
              resolvedSupabaseUrl = `${apiParsed.protocol}//${apiParsed.hostname}:18000`;
            }
          }

          let resolvedMeilisearchUrl = serverConfig.meilisearch_url;
          if (isDockerOrLocalhost(resolvedMeilisearchUrl)) {
            try {
              const meiliParsed = new URL(resolvedMeilisearchUrl);
              const port = meiliParsed.port || '7700';
              resolvedMeilisearchUrl = `${apiParsed.protocol}//${apiParsed.hostname}:${port}`;
            } catch {
              resolvedMeilisearchUrl = `${apiParsed.protocol}//${apiParsed.hostname}:7700`;
            }
          }

          console.log('[SelfHostSettingsBottomSheet] Resolved Supabase URL:', resolvedSupabaseUrl);
          console.log('[SelfHostSettingsBottomSheet] Resolved Meilisearch URL:', resolvedMeilisearchUrl);

          // 3. Test Supabase connection
          console.log('[SelfHostSettingsBottomSheet] Testing Supabase connection...');
          const validationSupabaseUrl = resolveHostname(resolvedSupabaseUrl);
          const supabaseValidation = await validateSupabaseConnection(
            validationSupabaseUrl,
            serverConfig.supabase_anon_key
          );

          console.log(
            '[SelfHostSettingsBottomSheet] Supabase validation result:',
            supabaseValidation
          );

          if (!supabaseValidation.valid) {
            throw new Error(supabaseValidation.error || 'Database connection failed');
          }

          return {
            apiUrl: data.apiUrl,
            supabaseUrl: resolvedSupabaseUrl,
            supabaseAnonKey: serverConfig.supabase_anon_key,
            meilisearchUrl: resolvedMeilisearchUrl,
            meilisearchSearchKey: serverConfig.meilisearch_search_key,
          };
        })();

        // Use toast.promise for validation
        const finalConfig = await toast.promise(
          withTimeout(
            validationPromise,
            4000,
            'Connection timed out. Please check the URL or host availability.'
          ),
          {
            loading: 'Connecting to server...',
            success: 'Connected!',
            error: 'Connection failed',
          }
        );

        // Save
        onSave?.(finalConfig);

        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.dismiss();
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const newErrors: Record<string, string> = {};
          error.issues.forEach((err) => {
            if (err.path[0]) {
              newErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(newErrors);
          toast.error('Please check your input');
        } else if (error instanceof Error) {
          setErrors({ apiUrl: error.message });
        }
      } finally {
        setIsValidating(false);
      }
    }, [apiUrl, onSave, ref]);

    // Clear errors when value changes
    useEffect(() => {
      if (errors.apiUrl && apiUrl) setErrors((prev) => ({ ...prev, apiUrl: '' }));
    }, [apiUrl, errors.apiUrl]);

    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          // Sheet was dismissed
          onClose?.();
        }
      },
      [onClose]
    );

    const snapPoints = useMemo(() => ['35%', '72%'], []);

    return (
      <BottomSheet
        ref={ref}
        headerTitle="Self-hosted connection"
        headerTitleAlign="left"
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={true}
        onChange={handleSheetChange}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore">
        <View style={{ gap: 16 }}>
          <Text className="font-geist-medium text-base text-grey dark:text-grey">
            Connect to your own Readspace instance URL
          </Text>

          <View className="gap-4">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 12,
                backgroundColor: isDark ? COLORS.dark.grey6 : COLORS.light.grey6,
                borderColor: errors.apiUrl
                  ? isDark
                    ? COLORS.dark.destructive
                    : COLORS.light.destructive
                  : undefined,
                borderWidth: errors.apiUrl ? 1 : undefined,
              }}>
              <BottomSheetTextInput
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="e.g., http://192.168.1.42:18008"
                keyboardType="url"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                placeholderTextColor={isDark ? COLORS.dark.grey2 : COLORS.light.grey2}
                style={{
                  flex: 1,
                  paddingTop: 16,
                  paddingBottom: 16,
                  paddingLeft: 16,
                  paddingRight: 16,
                  color: isDark ? '#fff' : '#000',
                  fontFamily: 'GeistMono_500Medium',
                  fontSize: 15,
                }}
              />
            </View>
            {errors.apiUrl ? (
              <Text
                className="text-sm font-geist-medium"
                style={{
                  marginTop: -4,
                  color: isDark ? COLORS.dark.destructive : COLORS.light.destructive,
                }}>
                {errors.apiUrl}
              </Text>
            ) : null}
          </View>

          {/* Inline Action Button */}
          <View className="mt-4 mb-1">
            <Button
              variant="primary"
              size="large"
              fullWidth
              onPress={handleSave}
              disabled={!isValid || isValidating}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              {isValidating ? (
                <View className="flex-row items-center justify-center gap-2">
                  <Spinner size="small" color={COLORS.white} />
                  <Text className="font-geist-semibold text-base text-white">Connecting...</Text>
                </View>
              ) : (
                'Save and Connect'
              )}
            </Button>
          </View>
        </View>
      </BottomSheet>
    );
  }
);

SelfHostSettingsBottomSheet.displayName = 'SelfHostSettingsBottomSheet';
