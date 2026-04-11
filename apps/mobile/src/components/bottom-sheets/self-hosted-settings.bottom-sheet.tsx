/** biome-ignore-all assist/source/organizeImports: false positive */
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, Text, TouchableWithoutFeedback, View } from 'react-native';
import 'react-native-url-polyfill/auto';
import { z } from 'zod';

import { BottomSheetFooter } from '@gorhom/bottom-sheet';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { Spinner } from '@components/ui/spinner';
import { toast } from '@components/ui/toast';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { validateSupabaseConnection } from '@lib/supabase/client';

// Helper to resolve hostname for Android emulator
const resolveHostname = (url: string) => {
  const _url = new URL(url);
  if (_url.hostname === 'localhost' && Platform.OS === 'android') {
    _url.hostname = '10.0.2.2';
  }
  // Remove trailing slash to prevent double slashes in API paths
  return _url.toString().replace(/\/$/, '');
};

const selfHostSchema = z.object({
  apiUrl: z
    .url('Please enter a valid URL (e.g., http://localhost:8008)')
    .min(1, 'API URL is required'),
  supabaseUrl: z
    .url('Please enter a valid URL (e.g., http://localhost:18000)')
    .min(1, 'Supabase URL is required'),
  supabaseAnonKey: z
    .string()
    .min(1, 'Supabase Anonymous Key is required')
    .refine((token) => {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      // Check that each part is base64url encoded (alphanumeric, -, _)
      const base64urlPattern = /^[A-Za-z0-9_-]+$/;
      return parts.every((part) => part.length > 0 && base64urlPattern.test(part));
    }, 'Invalid JWT format - should have three parts separated by dots'),
});

export interface SelfHostSettingsProps {
  onSave?: (data: { apiUrl: string; supabaseUrl: string; supabaseAnonKey: string }) => void;
  onClose?: () => void;
  initialData?: {
    apiUrl?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  };
}

export const SelfHostSettingsBottomSheet = forwardRef<BottomSheetModal, SelfHostSettingsProps>(
  ({ onSave, onClose, initialData }, ref) => {
    const [apiUrl, setApiUrl] = useState(initialData?.apiUrl || '');
    const [supabaseUrl, setSupabaseUrl] = useState(initialData?.supabaseUrl || '');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialData?.supabaseAnonKey || '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isValidating, setIsValidating] = useState(false);

    // Debug: Log when bottom sheet mounts/unmounts
    useEffect(() => {
      console.log('[SelfHostSettingsBottomSheet] Component mounted');
      return () => console.log('[SelfHostSettingsBottomSheet] Component unmounted');
    }, []);

    // Validate form
    const isValid = useMemo(() => {
      try {
        selfHostSchema.parse({
          apiUrl,
          supabaseUrl,
          supabaseAnonKey,
        });
        return true;
      } catch {
        return false;
      }
    }, [apiUrl, supabaseUrl, supabaseAnonKey]);

    const handleSave = useCallback(async () => {
      setIsValidating(true);
      setErrors({});

      try {
        // Validate form schema first
        const data = selfHostSchema.parse({
          apiUrl,
          supabaseUrl,
          supabaseAnonKey,
        });

        // Wrap validation in promise for toast.promise
        const validationPromise = (async () => {
          console.log('[SelfHostSettingsBottomSheet] Starting validation...');
          console.log('[SelfHostSettingsBottomSheet] API URL:', data.apiUrl);
          console.log('[SelfHostSettingsBottomSheet] Supabase URL:', data.supabaseUrl);
          console.log('[SelfHostSettingsBottomSheet] Platform:', Platform.OS);

          // Test API endpoint
          console.log('[SelfHostSettingsBottomSheet] Testing API endpoint...');
          const resolvedApiUrl = resolveHostname(data.apiUrl);
          console.log('[SelfHostSettingsBottomSheet] Resolved API URL:', resolvedApiUrl);

          try {
            const apiResponse = await fetch(`${resolvedApiUrl}/api/health`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });

            if (!apiResponse.ok) {
              console.log('[SelfHostSettingsBottomSheet] API endpoint failed:', apiResponse.status);
              throw new Error(
                `API endpoint returned ${apiResponse.status}: ${apiResponse.statusText}`
              );
            }
            console.log('[SelfHostSettingsBottomSheet] API endpoint OK');
          } catch (error) {
            console.log('[SelfHostSettingsBottomSheet] API fetch error:', error);
            const errorMsg =
              error instanceof Error ? error.message : 'Unable to connect to API endpoint';
            throw new Error(errorMsg);
          }

          // Test Supabase connection
          console.log('[SelfHostSettingsBottomSheet] Testing Supabase connection...');
          const supabaseValidation = await validateSupabaseConnection(
            data.supabaseUrl,
            data.supabaseAnonKey
          );

          console.log(
            '[SelfHostSettingsBottomSheet] Supabase validation result:',
            supabaseValidation
          );

          if (!supabaseValidation.valid) {
            throw new Error(supabaseValidation.error || 'Connection failed');
          }

          return data;
        })();

        // Use toast.promise for validation
        await toast.promise(validationPromise, {
          loading: 'Validating configuration...',
          success: 'Configuration validated successfully',
          error: 'Validation failed',
        });

        // All validations passed
        onSave?.(data);

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
          // Handle validation errors
          if (error.message.includes('API endpoint')) {
            setErrors((prev) => ({ ...prev, apiUrl: error.message }));
          } else {
            setErrors((prev) => ({ ...prev, supabaseUrl: error.message }));
          }
        }
      } finally {
        setIsValidating(false);
      }
    }, [apiUrl, supabaseUrl, supabaseAnonKey, onSave, ref]);

    // Clear errors when values change
    useEffect(() => {
      if (errors.apiUrl && apiUrl) setErrors((prev) => ({ ...prev, apiUrl: '' }));
    }, [apiUrl, errors.apiUrl]);

    useEffect(() => {
      if (errors.supabaseUrl && supabaseUrl) setErrors((prev) => ({ ...prev, supabaseUrl: '' }));
    }, [supabaseUrl, errors.supabaseUrl]);

    useEffect(() => {
      if (errors.supabaseAnonKey && supabaseAnonKey)
        setErrors((prev) => ({ ...prev, supabaseAnonKey: '' }));
    }, [supabaseAnonKey, errors.supabaseAnonKey]);

    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          // Sheet was dismissed
          onClose?.();
        }
      },
      [onClose]
    );

    const renderFooter = useCallback(
      (props: any) => (
        <BottomSheetFooter {...props} bottomInset={16}>
          <View className="px-6 pb-6 pt-2 bg-screen">
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
                  <Text className="font-geist-semibold text-base text-white">Validating...</Text>
                </View>
              ) : (
                'Save'
              )}
            </Button>
          </View>
        </BottomSheetFooter>
      ),
      [handleSave, isValid, isValidating]
    );

    return (
      <BottomSheet
        ref={ref}
        headerTitle="Self-hosted connection"
        headerTitleAlign="left"
        snapPoints={['50%', '90%']}
        enablePanDownToClose={true}
        onChange={handleSheetChange}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        footerComponent={renderFooter}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ paddingBottom: 60 }}>
            <Text className="font-geist-medium mb-4 text-base text-grey dark:text-grey">
              Connect to your own Readspace instance
            </Text>

            <View className="gap-4">
              {/* API URL */}
              <View>
                <BottomSheetInput
                  label="API URL"
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  placeholder="http://localhost:18008"
                  keyboardType="url"
                  autoCapitalize="none"
                  autocomplete="off"
                  autoCorrect={false}
                  isInvalid={!!errors.apiUrl}
                  errorText={errors.apiUrl}
                  className="font-geist-mono"
                  borderRadius={12}
                />
              </View>

              {/* Supabase URL */}
              <View>
                <BottomSheetInput
                  label="Supabase URL"
                  value={supabaseUrl}
                  onChangeText={setSupabaseUrl}
                  placeholder="http://localhost:18000"
                  keyboardType="url"
                  autoCapitalize="none"
                  autocomplete="off"
                  autoCorrect={false}
                  isInvalid={!!errors.supabaseUrl}
                  errorText={errors.supabaseUrl}
                  className="font-geist-mono"
                  borderRadius={12}
                />
              </View>

              {/* Supabase Anonymous Key */}
              <View>
                <BottomSheetInput
                  label="Supabase Anonymous Key"
                  value={supabaseAnonKey}
                  onChangeText={setSupabaseAnonKey}
                  placeholder="Your anonymous key"
                  autoCapitalize="none"
                  autocomplete="off"
                  autoCorrect={false}
                  multiline
                  isInvalid={!!errors.supabaseAnonKey}
                  errorText={errors.supabaseAnonKey}
                  className="font-geist-mono"
                  inputStyle={{ height: 80, textAlignVertical: 'top' }}
                  borderRadius={12}
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </BottomSheet>
    );
  }
);

SelfHostSettingsBottomSheet.displayName = 'SelfHostSettingsBottomSheet';
