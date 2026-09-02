/** biome-ignore-all assist/source/organizeImports: false positive */
import { type BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { Text } from '@components/ui/text';
import 'react-native-url-polyfill/auto';
import { z } from 'zod';

import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { Spinner } from '@components/ui/spinner';
import { toast } from '@components/ui/toast';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { validateSupabaseConnection } from '@lib/supabase/client';
import { useSettingsStore } from '@stores/settings';
import { resolveHostname } from '@lib/utils/network';

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
  }) => void | Promise<void>;
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
    const { settings } = useSettingsStore();
    const [resetCounter, setResetCounter] = useState(0);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isValidating, setIsValidating] = useState(false);

    // Compute the stable saved URL from settings or initialData
    const savedUrl = useMemo(() => {
      return (
        initialData?.apiUrl ||
        (settings.instance_type === 'self-hosted' ? settings.readspace_url : '')
      );
    }, [initialData, settings.readspace_url, settings.instance_type]);

    // Local state for checking if the input is non-empty (to enable the submit button)
    const [apiUrl, setApiUrl] = useState(savedUrl);

    // Sync input state when savedUrl changes
    useEffect(() => {
      setApiUrl(savedUrl);
    }, [savedUrl]);

    // Debug: Log when bottom sheet mounts/unmounts
    useEffect(() => {
      console.log('[SelfHostSettingsBottomSheet] Component mounted');
      return () => console.log('[SelfHostSettingsBottomSheet] Component unmounted');
    }, []);

    // Validate form schema (non-empty URL required to enable submit validation)
    const isValid = useMemo(() => {
      return apiUrl.trim().length > 0;
    }, [apiUrl]);

    const handleSave = useCallback(async () => {
      Keyboard.dismiss();
      setIsValidating(true);
      setErrors({});

      try {
        // Validate form schema first
        const data = selfHostSchema.parse({
          apiUrl: apiUrl.trim(),
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
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('NetworkError') || errorMsg.includes('Network request failed')) {
              throw new Error(
                'Network connection failed. Check your internet connection and the server URL.'
              );
            }
            throw new Error(
              'Unable to connect to the Readspace server. Verify the URL is correct and the server is running.'
            );
          }

          if (!configResponse.ok) {
            console.log(
              '[SelfHostSettingsBottomSheet] Config endpoint failed:',
              configResponse.status
            );
            if (configResponse.status === 404) {
              throw new Error('Server endpoint not found (404). Verify the server URL is correct.');
            } else if (configResponse.status >= 500) {
              throw new Error(`Server error (${configResponse.status}). The Readspace server may be down.`);
            }
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
          console.log(
            '[SelfHostSettingsBottomSheet] Resolved Meilisearch URL:',
            resolvedMeilisearchUrl
          );

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
            const error = supabaseValidation.error || 'Database connection failed';
            // Check if it's a network issue vs auth issue
            if (error.toLowerCase().includes('network') || error.toLowerCase().includes('failed to fetch')) {
              throw new Error(`Database connection failed: ${error}. Make sure your self-hosted Supabase is accessible.`);
            }
            throw new Error(`Database connection failed: ${error}`);
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
            6000,
            'Connection timed out. Please check the URL, host availability, and network connectivity.'
          ),
          {
            loading: 'Connecting to server...',
            success: 'Connected!',
            error: 'Connection failed',
          }
        );

        // Save and await if async
        await Promise.resolve(onSave?.(finalConfig));

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

    // Handle text change and clear errors immediately to avoid double re-renders
    const handleTextChange = useCallback(
      (text: string) => {
        setApiUrl(text);
        if (errors.apiUrl) {
          setErrors((prev) => ({ ...prev, apiUrl: '' }));
        }
      },
      [errors.apiUrl]
    );

    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          // Sheet was dismissed
          onClose?.();
          // Reset to current saved setting and trigger a re-render of the input field
          setApiUrl(savedUrl);
          setErrors({});
          setResetCounter((prev) => prev + 1);
        }
      },
      [onClose, savedUrl]
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
          <Text className="font-geist-medium text-grey dark:text-grey text-base">
            Connect to your own Readspace instance URL
          </Text>

          <BottomSheetInput
            key={`${savedUrl}-${resetCounter}`}
            defaultValue={savedUrl}
            onChangeText={handleTextChange}
            placeholder="e.g., http://192.168.1.42:18008"
            keyboardType="url"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            isInvalid={!!errors.apiUrl}
            errorText={errors.apiUrl}
            className="font-geist-mono"
            borderRadius={12}
          />

          {/* Inline Action Button */}
          <View className="mb-1 mt-4">
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
