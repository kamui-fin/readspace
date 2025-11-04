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

const selfHostSchema = z.object({
    apiUrl: z.string().url('Invalid API URL'),
    supabaseUrl: z.string().url('Invalid Supabase URL'),
    supabaseAnonKey: z.string().min(1, 'Supabase Anonymous Key is required'),
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

        const snapPoints = useMemo(() => ['90%'], []);

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
                        error instanceof Error ? error.message : 'Failed to connect to API';
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
                    const supabaseError = supabaseValidation.error || 'Connection failed';
                    toast.error(supabaseError, { duration: 4000 });
                    setErrors((prev) => ({
                        ...prev,
                        supabaseUrl: supabaseError,
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
                if (error instanceof z.ZodError) {
                    const newErrors: Record<string, string> = {};
                    error.issues.forEach((err: z.ZodIssue) => {
                        if (err.path[0]) {
                            newErrors[err.path[0] as string] = err.message;
                        }
                    });
                    setErrors(newErrors);
                }
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

        // Clear errors when values change
        useEffect(() => {
            if (errors.apiUrl && apiUrl) setErrors((prev) => ({ ...prev, apiUrl: '' }));
        }, [apiUrl, errors.apiUrl]);

        useEffect(() => {
            if (errors.supabaseUrl && supabaseUrl)
                setErrors((prev) => ({ ...prev, supabaseUrl: '' }));
        }, [supabaseUrl, errors.supabaseUrl]);

        useEffect(() => {
            if (errors.supabaseAnonKey && supabaseAnonKey)
                setErrors((prev) => ({ ...prev, supabaseAnonKey: '' }));
        }, [supabaseAnonKey, errors.supabaseAnonKey]);

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
                                API Url
                            </Text>
                            <BottomSheetTextInput
                                value={apiUrl}
                                onChangeText={setApiUrl}
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
                                <Text className="mt-1 font-geist text-xs text-red dark:text-red">
                                    {errors.apiUrl}
                                </Text>
                            )}
                        </View>

                        <View>
                            <Text className="mb-2 font-geist-medium text-sm text-black dark:text-black-dark">
                                Supabase Url
                            </Text>
                            <BottomSheetTextInput
                                value={supabaseUrl}
                                onChangeText={setSupabaseUrl}
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
                                <Text className="mt-1 font-geist text-xs text-red dark:text-red">
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
                                onChangeText={setSupabaseAnonKey}
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
                                <Text className="mt-1 font-geist text-xs text-red dark:text-red">
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
