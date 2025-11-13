import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/Colors';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetTextInput,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';
import { validateSupabaseConnection } from '@/lib/supabase/client';

// Validate JWT format (3 parts separated by dots)
const isValidJWT = (token: string): boolean => {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    // Check that each part is base64url encoded (alphanumeric, -, _)
    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    return parts.every((part) => part.length > 0 && base64urlPattern.test(part));
};

const selfHostSchema = z.object({
    apiUrl: z
        .string()
        .min(1, 'API URL is required')
        .url('Please enter a valid URL (e.g., http://localhost:18008)'),
    supabaseUrl: z
        .string()
        .min(1, 'Supabase URL is required')
        .url('Please enter a valid URL (e.g., http://localhost:18000)'),
    supabaseAnonKey: z
        .string()
        .min(1, 'Supabase Anonymous Key is required')
        .refine(isValidJWT, 'Invalid JWT format - should have three parts separated by dots'),
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
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];

        const [apiUrl, setApiUrl] = useState(initialData?.apiUrl || '');
        const [supabaseUrl, setSupabaseUrl] = useState(initialData?.supabaseUrl || '');
        const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialData?.supabaseAnonKey || '');
        const [errors, setErrors] = useState<Record<string, string>>({});
        const [isValidating, setIsValidating] = useState(false);
        const [touched, setTouched] = useState<Record<string, boolean>>({});

        const snapPoints = useMemo(() => ['90%'], []);

        // Validate individual field with Zod
        const validateField = useCallback(
            (field: 'apiUrl' | 'supabaseUrl' | 'supabaseAnonKey', value: string) => {
                try {
                    // Validate just this field
                    selfHostSchema.shape[field].parse(value);
                    // Clear error if valid
                    setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors[field];
                        return newErrors;
                    });
                } catch (error) {
                    if (error instanceof z.ZodError) {
                        // Set the first error message for this field
                        setErrors((prev) => ({
                            ...prev,
                            [field]: error.issues[0]?.message || 'Invalid value',
                        }));
                    }
                }
            },
            []
        );

        // Handle field change - validate in real-time if field has been touched
        const handleFieldChange = useCallback(
            (
                field: 'apiUrl' | 'supabaseUrl' | 'supabaseAnonKey',
                value: string,
                setter: (value: string) => void
            ) => {
                setter(value);
                // Only validate if field has been touched (user has interacted with it)
                if (touched[field]) {
                    validateField(field, value);
                }
            },
            [touched, validateField]
        );

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
            // Mark all fields as touched
            setTouched({ apiUrl: true, supabaseUrl: true, supabaseAnonKey: true });

            setIsValidating(true);

            try {
                // Validate form schema first with detailed error messages
                const validationResult = selfHostSchema.safeParse({
                    apiUrl,
                    supabaseUrl,
                    supabaseAnonKey,
                });

                if (!validationResult.success) {
                    // Extract and set all field errors
                    const newErrors: Record<string, string> = {};
                    validationResult.error.issues.forEach((issue) => {
                        if (issue.path[0]) {
                            newErrors[issue.path[0] as string] = issue.message;
                        }
                    });
                    setErrors(newErrors);
                    toast.error('Please fix validation errors', { duration: 3000 });
                    setIsValidating(false);
                    return;
                }

                const data = validationResult.data;

                // Test API endpoint
                toast.loading('Validating API endpoint...', { id: 'validation' });
                try {
                    const apiResponse = await fetch(data.apiUrl + '/api/health', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (!apiResponse.ok) {
                        throw new Error(
                            `API endpoint returned ${apiResponse.status}: ${apiResponse.statusText}`
                        );
                    }
                } catch (error) {
                    toast.dismiss('validation');
                    const errorMsg =
                        error instanceof Error
                            ? error.message
                            : 'Unable to connect to API endpoint';
                    toast.error(errorMsg, { duration: 4000 });
                    setErrors((prev) => ({ ...prev, apiUrl: errorMsg }));
                    setIsValidating(false);
                    return;
                }

                // Test Supabase connection
                toast.loading('Validating Supabase connection...', { id: 'validation' });
                const supabaseValidation = await validateSupabaseConnection(
                    data.supabaseUrl,
                    data.supabaseAnonKey
                );

                if (!supabaseValidation.valid) {
                    toast.dismiss('validation');
                    const supabaseError =
                        supabaseValidation.error || 'Unable to connect to Supabase';
                    toast.error(supabaseError, { duration: 4000 });
                    setErrors((prev) => ({
                        ...prev,
                        supabaseUrl: supabaseError,
                        supabaseAnonKey: supabaseError,
                    }));
                    setIsValidating(false);
                    return;
                }

                // All validations passed
                toast.success('Configuration validated successfully', { id: 'validation' });
                onSave?.(data);

                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.dismiss();
                }
            } catch (error) {
                toast.dismiss('validation');
                toast.error('An unexpected error occurred', { duration: 3000 });
            } finally {
                setIsValidating(false);
            }
        }, [apiUrl, supabaseUrl, supabaseAnonKey, onSave, ref]);

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    appearsOnIndex={0}
                    disappearsOnIndex={-1}
                    opacity={0.5}
                />
            ),
            []
        );

        // Handle field blur - validate only if field has been touched
        const handleFieldBlur = useCallback(
            (field: 'apiUrl' | 'supabaseUrl' | 'supabaseAnonKey', value: string) => {
                setTouched((prev) => ({ ...prev, [field]: true }));
                validateField(field, value);
            },
            [validateField]
        );

        return (
            <BottomSheetModal
                ref={ref}
                snapPoints={snapPoints}
                enablePanDownToClose
                enableDismissOnClose={true}
                stackBehavior="push"
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.white }}
                handleIndicatorStyle={{ backgroundColor: colors.green_grey }}>
                <BottomSheetView className="flex-1 bg-white px-6 py-4 dark:bg-white-dark">
                    <Text className="mb-2 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
                        Self-hosted connection
                    </Text>
                    <Text className="mb-6 font-geist text-base text-grey dark:text-grey-dark">
                        Connect to your own Readspace instance
                    </Text>

                    <View style={{ gap: 16 }}>
                        <View>
                            <Text className="mb-2 font-geist-medium text-sm text-black dark:text-black-dark">
                                API URL
                            </Text>
                            <BottomSheetTextInput
                                value={apiUrl}
                                onChangeText={(value) =>
                                    handleFieldChange('apiUrl', value, setApiUrl)
                                }
                                onBlur={() => handleFieldBlur('apiUrl', apiUrl)}
                                placeholder="http://localhost:18008"
                                placeholderTextColor={colors.grey}
                                keyboardType="url"
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                style={{
                                    borderRadius: 16,
                                    backgroundColor: colors['mid-grey'],
                                    paddingHorizontal: 20,
                                    paddingVertical: 16,
                                    fontSize: 16,
                                    fontFamily: 'GeistMono_400Regular',
                                    color: colors.black,
                                    borderWidth: errors.apiUrl ? 2 : 0,
                                    borderColor: errors.apiUrl ? colors.red : 'transparent',
                                }}
                            />
                            {errors.apiUrl && (
                                <Text className="mt-2 font-geist text-sm text-red dark:text-red">
                                    {errors.apiUrl}
                                </Text>
                            )}
                        </View>

                        <View>
                            <Text className="mb-2 font-geist-medium text-sm text-black dark:text-black-dark">
                                Supabase URL
                            </Text>
                            <BottomSheetTextInput
                                value={supabaseUrl}
                                onChangeText={(value) =>
                                    handleFieldChange('supabaseUrl', value, setSupabaseUrl)
                                }
                                onBlur={() => handleFieldBlur('supabaseUrl', supabaseUrl)}
                                placeholder="http://localhost:18000"
                                placeholderTextColor={colors.grey}
                                keyboardType="url"
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                style={{
                                    borderRadius: 16,
                                    backgroundColor: colors['mid-grey'],
                                    paddingHorizontal: 20,
                                    paddingVertical: 16,
                                    fontSize: 16,
                                    fontFamily: 'GeistMono_400Regular',
                                    color: colors.black,
                                    borderWidth: errors.supabaseUrl ? 2 : 0,
                                    borderColor: errors.supabaseUrl ? colors.red : 'transparent',
                                }}
                            />
                            {errors.supabaseUrl && (
                                <Text className="mt-2 font-geist text-sm text-red dark:text-red">
                                    {errors.supabaseUrl}
                                </Text>
                            )}
                        </View>

                        <View>
                            <Text className="mb-2 font-geist-medium text-sm text-black dark:text-black-dark">
                                Supabase Anonymous Key
                            </Text>
                            <BottomSheetTextInput
                                value={supabaseAnonKey}
                                onChangeText={(value) =>
                                    handleFieldChange('supabaseAnonKey', value, setSupabaseAnonKey)
                                }
                                onBlur={() => handleFieldBlur('supabaseAnonKey', supabaseAnonKey)}
                                placeholder="Your anonymous key"
                                placeholderTextColor={colors.grey}
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                style={{
                                    borderRadius: 16,
                                    backgroundColor: colors['mid-grey'],
                                    paddingHorizontal: 20,
                                    paddingVertical: 16,
                                    fontSize: 16,
                                    fontFamily: 'GeistMono_400Regular',
                                    color: colors.black,
                                    borderWidth: errors.supabaseAnonKey ? 2 : 0,
                                    borderColor: errors.supabaseAnonKey
                                        ? colors.red
                                        : 'transparent',
                                }}
                            />
                            {errors.supabaseAnonKey && (
                                <Text className="mt-2 font-geist text-sm text-red dark:text-red">
                                    {errors.supabaseAnonKey}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View className="flex-1" />

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onPress={handleSave}
                        disabled={!isValid || isValidating}
                        className="mt-6">
                        {isValidating ? (
                            <View className="flex-row items-center gap-2">
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text className="font-geist-semibold text-base text-white dark:text-white">
                                    Validating...
                                </Text>
                            </View>
                        ) : (
                            'Save'
                        )}
                    </Button>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

SelfHostSettings.displayName = 'SelfHostSettings';
