/** biome-ignore-all assist/source/organizeImports: false positive */
import 'react-native-url-polyfill/auto';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, ScrollView, Text, TouchableWithoutFeedback, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Modal } from '@components/ui/modal';
import { toast } from '@components/ui/toast';
import { Spinner } from '@components/ui/spinner';
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
  initialData?: {
    apiUrl?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  };
}

export const SelfHostSettings = forwardRef<BottomSheetModal, SelfHostSettingsProps>(
  ({ onSave, initialData }, ref) => {
    // const isDark = useIsDarkMode();

    const [apiUrl, setApiUrl] = useState(initialData?.apiUrl || '');
    const [supabaseUrl, setSupabaseUrl] = useState(initialData?.supabaseUrl || '');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialData?.supabaseAnonKey || '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isValidating, setIsValidating] = useState(false);

    // Debug: Log when modal mounts/unmounts
    useEffect(() => {
      console.log('[SelfHostSettings] Modal component mounted');
      return () => console.log('[SelfHostSettings] Modal component unmounted');
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
          console.log('[SelfHostSettings] Starting validation...');
          console.log('[SelfHostSettings] API URL:', data.apiUrl);
          console.log('[SelfHostSettings] Supabase URL:', data.supabaseUrl);
          console.log('[SelfHostSettings] Platform:', Platform.OS);

          // Test API endpoint
          console.log('[SelfHostSettings] Testing API endpoint...');
          const resolvedApiUrl = resolveHostname(data.apiUrl);
          console.log('[SelfHostSettings] Resolved API URL:', resolvedApiUrl);

          try {
            const apiResponse = await fetch(resolvedApiUrl + '/api/health', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });

            if (!apiResponse.ok) {
              console.log('[SelfHostSettings] API endpoint failed:', apiResponse.status);
              throw new Error(
                `API endpoint returned ${apiResponse.status}: ${apiResponse.statusText}`
              );
            }
            console.log('[SelfHostSettings] API endpoint OK');
          } catch (error) {
            console.log('[SelfHostSettings] API fetch error:', error);
            const errorMsg =
              error instanceof Error ? error.message : 'Unable to connect to API endpoint';
            throw new Error(errorMsg);
          }

          // Test Supabase connection
          console.log('[SelfHostSettings] Testing Supabase connection...');
          const supabaseValidation = await validateSupabaseConnection(
            data.supabaseUrl,
            data.supabaseAnonKey
          );

          console.log('[SelfHostSettings] Supabase validation result:', supabaseValidation);

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

    const handleClose = useCallback(() => {
      if (ref && typeof ref !== 'function' && ref.current) {
        ref.current.close();
      }
    }, [ref]);

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

    return (
      <Modal
        ref={ref}
        headerTitle="Self-hosted connection"
        onClose={handleClose}
        snapPoints={['90%']}
        enablePanDownToClose={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1">
            <Text className="font-geist mb-6 text-base text-grey dark:text-grey">
              Connect to your own Readspace instance
            </Text>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="gap-4 pb-4">
                {/* API URL */}
                <View>
                  <Input
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
                  />
                </View>

                {/* Supabase URL */}
                <View>
                  <Input
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
                  />
                </View>

                {/* Supabase Anonymous Key */}
                <View>
                  <Input
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
                  />
                </View>
              </View>
            </ScrollView>

            {/* Save Button */}
            <View className="pb-6 pt-4">
              <Button
                variant="primary"
                size="large"
                onPress={handleSave}
                disabled={!isValid || isValidating}>
                {isValidating ? (
                  <View className="flex-row items-center gap-2">
                    <Spinner size="small" color={COLORS.white} />
                    <Text className="font-geist-semibold text-base text-white dark:text-white">
                      Validating...
                    </Text>
                  </View>
                ) : (
                  'Save'
                )}
              </Button>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }
);

SelfHostSettings.displayName = 'SelfHostSettings';
